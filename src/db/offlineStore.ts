import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  INITIAL_AUDIT_LOG,
  INITIAL_CHECKINS,
  INITIAL_CONFIG,
  INITIAL_EQUIPMENT,
  INITIAL_LEADS,
  INITIAL_MEMBERS,
  INITIAL_PLANS,
  INITIAL_SESSIONS,
  INITIAL_STAFF,
  INITIAL_TRANSACTIONS,
  INITIAL_ZONES,
} from '../data/initialSeedData.ts';
import type {
  AuditEntry,
  CheckInLog,
  EquipmentItem,
  EquipmentStatus,
  GymConfig,
  GymNotification,
  GymZone,
  Lead,
  Member,
  MembershipPlan,
  NotificationCategory,
  NotificationChannel,
  ScreenView,
  StaffMember,
  StudioSession,
  UserRole,
  ZoneId,
} from '../types/gym.ts';
import type { WorkspacePayload } from './crmRepo.ts';

export type OfflineLoginProvider = 'google' | 'phone' | 'microsoft';

interface StoredOfflineProfile {
  numericId: number;
  profileId: string;
  provider: OfflineLoginProvider;
  identifier: string;
  displayName: string;
  pinHash?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface OfflineProfileSummary {
  numericId: number;
  profileId: string;
  provider: OfflineLoginProvider;
  identifier: string;
  displayName: string;
  hasPin: boolean;
  createdAt: string;
  lastActiveAt: string;
}

function nowTimeStr() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function nowDateTimeStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveDataDir(): string {
  const dir = process.env.KINETIX_DATA_DIR?.trim() || path.join(os.homedir(), '.kinetix-data');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function getVaultEncryptionKey(): Buffer {
  const dataDir = resolveDataDir();
  let secret = process.env.KINETIX_VAULT_SECRET?.trim();
  if (!secret) {
    const keyFile = path.join(dataDir, 'vault.key');
    if (fs.existsSync(keyFile)) {
      secret = fs.readFileSync(keyFile, 'utf8').trim();
    } else {
      secret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyFile, secret, { encoding: 'utf8', mode: 0o600 });
    }
  }
  const saltFile = path.join(dataDir, 'vault.salt');
  let salt: string;
  if (fs.existsSync(saltFile)) {
    salt = fs.readFileSync(saltFile, 'utf8').trim();
  } else {
    salt = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(saltFile, salt, { encoding: 'utf8', mode: 0o600 });
  }
  return crypto.scryptSync(secret, salt, 32);
}

function encryptEnvelope(plaintext: string): string {
  const key = getVaultEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  });
}

function decryptEnvelope(raw: string): string {
  const envelope = JSON.parse(raw) as {
    v: number;
    iv: string;
    tag: string;
    data: string;
  };
  const key = getVaultEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function writeEncryptedAtomic(filePath: string, payload: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const envelope = encryptEnvelope(JSON.stringify(payload));
  fs.writeFileSync(tmpPath, envelope, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

function readEncryptedFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(decryptEnvelope(raw)) as T;
}

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, hex] = storedHash.split(':');
  if (!salt || !hex) return false;
  const candidate = crypto.scryptSync(pin, salt, 32);
  const target = Buffer.from(hex, 'hex');
  if (candidate.length !== target.length) return false;
  return crypto.timingSafeEqual(candidate, target);
}

function getProfilesIndexPath(): string {
  return path.join(resolveDataDir(), 'profiles-index.enc');
}

function toProfileSummary(p: StoredOfflineProfile): OfflineProfileSummary {
  return {
    numericId: p.numericId,
    profileId: p.profileId,
    provider: p.provider,
    identifier: p.identifier,
    displayName: p.displayName,
    hasPin: Boolean(p.pinHash),
    createdAt: p.createdAt,
    lastActiveAt: p.lastActiveAt,
  };
}

function readProfilesIndex(): StoredOfflineProfile[] {
  const indexPath = getProfilesIndexPath();
  if (!fs.existsSync(indexPath)) {
    return [];
  }
  const list = readEncryptedFile<StoredOfflineProfile[]>(indexPath);
  return Array.isArray(list) ? list : [];
}

function saveProfilesIndex(profiles: StoredOfflineProfile[]): void {
  writeEncryptedAtomic(getProfilesIndexPath(), profiles);
}

let profileIndexQueue: Promise<unknown> = Promise.resolve();

function withProfileIndexLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const next = profileIndexQueue.then(() => fn());
  profileIndexQueue = next.catch(() => undefined);
  return next;
}

function normalizeIdentifier(provider: OfflineLoginProvider, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Please enter your account identifier.');
  }
  if (provider === 'phone') {
    const cleaned = trimmed.replace(/[^\d+]/g, '');
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      throw new Error('Please enter a valid phone number (7 to 15 digits, including country code).');
    }
    return cleaned.startsWith('+') ? cleaned : `+${digitsOnly}`;
  }
  const lower = trimmed.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) {
    throw new Error(
      provider === 'google'
        ? 'Please enter a valid Gmail or Google Workspace email address.'
        : 'Please enter a valid Microsoft account email address.'
    );
  }
  return lower;
}

export async function listOfflineProfiles(): Promise<OfflineProfileSummary[]> {
  return withProfileIndexLock(() => {
    const list = readProfilesIndex();
    return list
      .slice()
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
      .map(toProfileSummary);
  });
}

export async function getOfflineProfileById(profileId: string): Promise<OfflineProfileSummary | null> {
  const cleanId = profileId.trim();
  if (!/^[a-f0-9]{24}$/.test(cleanId)) return null;
  return withProfileIndexLock(() => {
    const found = readProfilesIndex().find((p) => p.profileId === cleanId);
    return found ? toProfileSummary(found) : null;
  });
}

export async function loginOrCreateOfflineProfile(input: {
  provider: OfflineLoginProvider;
  identifier: string;
  displayName?: string;
  pin?: string;
}): Promise<OfflineProfileSummary> {
  if (!['google', 'phone', 'microsoft'].includes(input.provider)) {
    throw new Error('Unsupported login method.');
  }
  const normalized = normalizeIdentifier(input.provider, input.identifier);
  const profileId = crypto
    .createHash('sha256')
    .update(`${input.provider}:${normalized}`)
    .digest('hex')
    .slice(0, 24);
  const cleanPin = input.pin?.trim() || '';

  return withProfileIndexLock(() => {
    const profiles = readProfilesIndex();
    const existing = profiles.find((p) => p.profileId === profileId);
    const now = new Date().toISOString();

    if (existing) {
      if (existing.pinHash) {
        if (!cleanPin || !verifyPin(cleanPin, existing.pinHash)) {
          throw new Error('Incorrect passcode for this profile.');
        }
      }
      if (input.displayName?.trim()) {
        existing.displayName = input.displayName.trim().slice(0, 64);
      }
      existing.lastActiveAt = now;
      saveProfilesIndex(profiles);
      return toProfileSummary(existing);
    }

    if (cleanPin && cleanPin.length < 4) {
      throw new Error('Passcode must be at least 4 characters (or leave blank for quick unlock).');
    }

    const nextNumericId =
      profiles.reduce((max, p) => Math.max(max, p.numericId), 0) + 1;
    const defaultLabel =
      input.provider === 'phone'
        ? normalized
        : normalized.split('@')[0] || 'Club Operator';

    const created: StoredOfflineProfile = {
      numericId: nextNumericId,
      profileId,
      provider: input.provider,
      identifier: normalized,
      displayName: (input.displayName?.trim() || defaultLabel).slice(0, 64),
      pinHash: cleanPin ? hashPin(cleanPin) : undefined,
      createdAt: now,
      lastActiveAt: now,
    };

    // Migrate legacy single-company vault into first created profile if present
    const legacyVault = path.join(resolveDataDir(), 'company-workspace.enc');
    const newVault = getProfileVaultPath(created.profileId);
    if (nextNumericId === 1 && fs.existsSync(legacyVault) && !fs.existsSync(newVault)) {
      fs.mkdirSync(path.dirname(newVault), { recursive: true, mode: 0o700 });
      fs.copyFileSync(legacyVault, newVault);
      fs.chmodSync(newVault, 0o600);
    }

    profiles.push(created);
    saveProfilesIndex(profiles);
    return toProfileSummary(created);
  });
}

export async function switchOfflineProfile(input: {
  profileId: string;
  pin?: string;
}): Promise<OfflineProfileSummary> {
  const cleanId = input.profileId.trim();
  if (!/^[a-f0-9]{24}$/.test(cleanId)) {
    throw new Error('Invalid profile identifier.');
  }
  const cleanPin = input.pin?.trim() || '';

  return withProfileIndexLock(() => {
    const profiles = readProfilesIndex();
    const existing = profiles.find((p) => p.profileId === cleanId);
    if (!existing) {
      throw new Error('Profile not found on this device.');
    }
    if (existing.pinHash && (!cleanPin || !verifyPin(cleanPin, existing.pinHash))) {
      throw new Error('Incorrect passcode for this profile.');
    }
    existing.lastActiveAt = new Date().toISOString();
    saveProfilesIndex(profiles);
    return toProfileSummary(existing);
  });
}

function resolveProfileIdByNumericId(profileNumId: number): string {
  const profiles = readProfilesIndex();
  const match = profiles.find((p) => p.numericId === profileNumId);
  if (match) return match.profileId;
  return `profile-${Math.max(1, Math.floor(profileNumId))}`;
}

function getProfileVaultPath(profileId: string): string {
  const safeId = profileId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) throw new Error('Invalid profile storage path.');
  return path.join(resolveDataDir(), 'profiles', safeId, 'workspace.enc');
}

function buildSeedWorkspace(): WorkspacePayload {
  const seededNotifications: GymNotification[] = [
    {
      id: 'notif-seed-1',
      category: 'expiring_membership',
      channel: 'both',
      severity: 'critical',
      recipientName: 'Julian Mercer',
      recipientEmail: 'jmercer@ateliervc.com',
      title: 'Expiring & Past-Due Renewal Notice',
      message:
        'Corporate Athlete subscription expires 2026-11-28 ($230.00 past-due). Automated email reminder queued.',
      status: 'unread',
      targetScreen: 'billing',
      ruleKey: 'expiring:mem-104',
      createdAt: '2026-11-15 09:00',
    },
    {
      id: 'notif-seed-2',
      category: 'upcoming_booking',
      channel: 'email',
      severity: 'info',
      recipientName: 'Maya Lin',
      recipientEmail: 'maya.lin@kinetix.club',
      title: 'Upcoming Class Booking Reminder',
      message:
        'Metabolic 45 Interval begins at 11:30 AM in Studio A · Cycle & Turf with Coach Maya Lin.',
      status: 'sent',
      targetScreen: 'schedule',
      ruleKey: 'booking:ses-2',
      createdAt: '2026-11-15 08:30',
    },
  ];

  return structuredClone({
    config: INITIAL_CONFIG,
    activeRole: 'Director',
    activeFacilityId: 'soho',
    zonesByFacility: INITIAL_ZONES,
    equipment: INITIAL_EQUIPMENT,
    staff: INITIAL_STAFF,
    members: INITIAL_MEMBERS,
    leads: INITIAL_LEADS,
    plans: INITIAL_PLANS,
    transactions: INITIAL_TRANSACTIONS,
    checkIns: INITIAL_CHECKINS,
    sessions: INITIAL_SESSIONS,
    notifications: seededNotifications,
    auditLog: INITIAL_AUDIT_LOG,
  });
}

function readEncryptedWorkspace(profileNumId: number): WorkspacePayload {
  const profileId = resolveProfileIdByNumericId(profileNumId);
  const filePath = getProfileVaultPath(profileId);
  if (!fs.existsSync(filePath)) {
    const initial = buildSeedWorkspace();
    writeEncryptedAtomic(filePath, initial);
    return initial;
  }
  return readEncryptedFile<WorkspacePayload>(filePath);
}

function writeEncryptedWorkspace(profileNumId: number, payload: WorkspacePayload): void {
  const profileId = resolveProfileIdByNumericId(profileNumId);
  const filePath = getProfileVaultPath(profileId);
  writeEncryptedAtomic(filePath, payload);
}

const profileWriteQueues = new Map<number, Promise<unknown>>();

function withOfflineWrite<T>(
  profileNumId: number,
  fn: (ws: WorkspacePayload) => T | Promise<T>
): Promise<T> {
  const prior = profileWriteQueues.get(profileNumId) || Promise.resolve();
  const next = prior.then(async () => {
    const ws = readEncryptedWorkspace(profileNumId);
    const res = await fn(ws);
    writeEncryptedWorkspace(profileNumId, ws);
    return res;
  });
  profileWriteQueues.set(
    profileNumId,
    next.catch(() => undefined)
  );
  return next;
}

function pushAudit(
  ws: WorkspacePayload,
  actor: string,
  role: UserRole,
  category: AuditEntry['category'],
  action: string,
  target: string
): AuditEntry {
  const entry: AuditEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowTimeStr(),
    actor,
    role,
    category,
    action,
    target,
  };
  ws.auditLog = [entry, ...ws.auditLog].slice(0, 500);
  return entry;
}

function pushNotification(
  ws: WorkspacePayload,
  input: {
    category: NotificationCategory;
    channel: NotificationChannel;
    severity: 'info' | 'warning' | 'critical';
    recipientName: string;
    recipientEmail: string;
    title: string;
    message: string;
    status?: 'unread' | 'read' | 'sent';
    targetScreen: ScreenView;
    ruleKey: string;
  }
): GymNotification {
  const notif: GymNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: input.category,
    channel: input.channel,
    severity: input.severity,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    title: input.title,
    message: input.message,
    status: input.status ?? (input.channel === 'email' ? 'sent' : 'unread'),
    targetScreen: input.targetScreen,
    ruleKey: input.ruleKey,
    createdAt: nowDateTimeStr(),
  };
  ws.notifications = [notif, ...ws.notifications].slice(0, 300);
  return notif;
}

export async function loadWorkspaceOffline(profileNumId: number): Promise<WorkspacePayload> {
  return readEncryptedWorkspace(profileNumId);
}

export async function appendAuditOffline(
  profileNumId: number,
  actor: string,
  role: UserRole,
  category: AuditEntry['category'],
  action: string,
  target: string
): Promise<AuditEntry> {
  return withOfflineWrite(profileNumId, (ws) => pushAudit(ws, actor, role, category, action, target));
}

export async function createNotificationOffline(
  profileNumId: number,
  input: {
    category: NotificationCategory;
    channel: NotificationChannel;
    severity: 'info' | 'warning' | 'critical';
    recipientName: string;
    recipientEmail: string;
    title: string;
    message: string;
    status?: 'unread' | 'read' | 'sent';
    targetScreen: ScreenView;
    ruleKey: string;
  }
): Promise<GymNotification> {
  return withOfflineWrite(profileNumId, (ws) => pushNotification(ws, input));
}

export async function updateConfigOffline(
  profileNumId: number,
  patch: Partial<GymConfig> & { activeRole?: UserRole; activeFacilityId?: string },
  actorName: string
): Promise<void> {
  await withOfflineWrite(profileNumId, (ws) => {
    if (patch.operatingHours !== undefined) ws.config.operatingHours = patch.operatingHours;
    if (patch.maxOccupancyThresholdPct !== undefined)
      ws.config.maxOccupancyThresholdPct = patch.maxOccupancyThresholdPct;
    if (patch.autoWaitlistPromote !== undefined)
      ws.config.autoWaitlistPromote = patch.autoWaitlistPromote;
    if (patch.gracePeriodDays !== undefined) ws.config.gracePeriodDays = patch.gracePeriodDays;
    if (patch.taxRatePct !== undefined) ws.config.taxRatePct = patch.taxRatePct;
    if (patch.requireSignedWaiver !== undefined)
      ws.config.requireSignedWaiver = patch.requireSignedWaiver;
    if (patch.activeRole !== undefined) ws.activeRole = patch.activeRole;
    if (patch.activeFacilityId !== undefined) ws.activeFacilityId = patch.activeFacilityId;
    pushAudit(ws, actorName, ws.activeRole, 'System', 'Updated club settings', 'Local Profile Vault');
  });
}

export async function recordCheckInOffline(
  profileNumId: number,
  memberId: string,
  zoneId: ZoneId,
  facilityId: string,
  actorName: string,
  actorRole: UserRole
): Promise<CheckInLog> {
  return withOfflineWrite(profileNumId, (ws) => {
    const member = ws.members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} not found.`);
    const facZones = ws.zonesByFacility[facilityId] || ws.zonesByFacility.soho || [];
    const zone = facZones.find((z) => z.id === zoneId);
    if (!zone) throw new Error(`Zone ${zoneId} not found for facility ${facilityId}.`);

    const timeStr = nowTimeStr();
    const checkIn: CheckInLog = {
      id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      memberId: member.id,
      memberName: member.name,
      memberAvatar: member.avatarUrl,
      memberInitials: member.initials,
      tier: member.tier,
      zoneId,
      zoneName: zone.shortName,
      timestamp: timeStr,
      date: todayIsoDate(),
      facilityId,
    };

    ws.checkIns = [checkIn, ...ws.checkIns];
    member.checkIns30d += 1;
    member.lastVisit = `Today, ${timeStr}`;
    member.status = 'Active';
    member.activityLog = [
      { id: `act-${Date.now()}`, date: `Today, ${timeStr}`, summary: `Checked into ${zone.name}` },
      ...member.activityLog,
    ];
    zone.occupancy = Math.min(zone.capacity, zone.occupancy + 1);
    pushAudit(ws, actorName, actorRole, 'Check-In', 'Logged gate check-in', `${member.name} -> ${zone.shortName}`);
    return checkIn;
  });
}

export async function adjustZoneOccupancyOffline(
  profileNumId: number,
  facilityId: string,
  zoneKey: ZoneId,
  delta: number
): Promise<GymZone> {
  return withOfflineWrite(profileNumId, (ws) => {
    const facZones = ws.zonesByFacility[facilityId] || ws.zonesByFacility.soho || [];
    const zone = facZones.find((z) => z.id === zoneKey);
    if (!zone) throw new Error(`Zone ${zoneKey} not found.`);
    zone.occupancy = Math.max(0, Math.min(zone.capacity, zone.occupancy + delta));
    return { ...zone };
  });
}

export async function cycleEquipmentStatusOffline(
  profileNumId: number,
  externalId: string,
  actorName: string,
  actorRole: UserRole,
  explicitStatus?: EquipmentStatus
): Promise<EquipmentItem> {
  return withOfflineWrite(profileNumId, (ws) => {
    const eq = ws.equipment.find((e) => e.id === externalId);
    if (!eq) throw new Error(`Equipment ${externalId} not found.`);
    const order: EquipmentStatus[] = ['Operational', 'In Use', 'Maintenance'];
    eq.status = explicitStatus || order[(order.indexOf(eq.status) + 1) % order.length];
    pushAudit(ws, actorName, actorRole, 'System', `Marked equipment ${eq.status}`, eq.name);
    return { ...eq };
  });
}

export async function createMemberOffline(
  profileNumId: number,
  member: Member,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  return withOfflineWrite(profileNumId, (ws) => {
    ws.members = [member, ...ws.members];
    ws.transactions = [
      {
        id: `txn-${Date.now()}`,
        memberId: member.id,
        memberName: member.name,
        planName: member.tier,
        amount: member.monthlyRate,
        date: todayIsoDate(),
        status: 'Paid',
        method: 'Card ••4242',
      },
      ...ws.transactions,
    ];
    pushAudit(ws, actorName, actorRole, 'Member', 'Created new member profile', member.name);
    return member;
  });
}

export async function updateMemberOffline(
  profileNumId: number,
  updated: Member,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  return withOfflineWrite(profileNumId, (ws) => {
    const idx = ws.members.findIndex((m) => m.id === updated.id);
    if (idx === -1) throw new Error(`Member ${updated.id} not found.`);
    ws.members[idx] = updated;
    pushAudit(ws, actorName, actorRole, 'Member', auditSummary, updated.name);
    return updated;
  });
}

export async function importMembersOffline(
  profileNumId: number,
  imported: Member[],
  facilityName: string,
  actorName: string,
  actorRole: UserRole
): Promise<void> {
  await withOfflineWrite(profileNumId, (ws) => {
    ws.members = [...imported, ...ws.members];
    pushAudit(ws, actorName, actorRole, 'Member', `Imported ${imported.length} CSV members`, facilityName);
  });
}

export async function createLeadOffline(
  profileNumId: number,
  lead: Lead,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  return withOfflineWrite(profileNumId, (ws) => {
    ws.leads = [lead, ...ws.leads];
    pushAudit(ws, actorName, actorRole, 'Lead', 'Added new prospect', `${lead.name} (${lead.source})`);
    return lead;
  });
}

export async function updateLeadOffline(
  profileNumId: number,
  updated: Lead,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  return withOfflineWrite(profileNumId, (ws) => {
    const idx = ws.leads.findIndex((l) => l.id === updated.id);
    if (idx === -1) throw new Error(`Lead ${updated.id} not found.`);
    ws.leads[idx] = updated;
    pushAudit(ws, actorName, actorRole, 'Lead', auditSummary, updated.name);
    return updated;
  });
}

export async function convertLeadOffline(
  profileNumId: number,
  leadExternalId: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  return withOfflineWrite(profileNumId, (ws) => {
    const lead = ws.leads.find((l) => l.id === leadExternalId);
    if (!lead) throw new Error(`Lead ${leadExternalId} not found.`);
    lead.stage = 'Converted';
    lead.trialStatus = 'Trial Completed';

    const today = todayIsoDate();
    const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
    const initials =
      lead.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || 'KM';

    const member: Member = {
      id: `mem-${Date.now()}`,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      initials,
      tier: lead.estimatedValue >= 250 ? 'Performance Unlimited' : 'Corporate Athlete',
      monthlyRate: lead.estimatedValue || 230,
      status: 'Active',
      checkIns30d: 1,
      weeklySpark: [0, 0, 0, 0, 0, 0, 1],
      lastVisit: 'Joined today',
      preferredZone: 'lifting',
      joinedDate: today,
      facilityId: lead.facilityId,
      notes: `Converted from ${lead.source} inquiry. ${lead.notes}`,
      goals: ['Complete 30-day onboarding checkup'],
      emergencyContact: { name: 'On File', relation: 'Primary', phone: lead.phone },
      documents: [
        {
          id: `doc-${Date.now()}`,
          title: 'Liability & Studio Waiver',
          type: 'Waiver',
          status: 'Signed',
          updatedAt: today,
        },
      ],
      assessments: [],
      subscription: {
        planName: lead.estimatedValue >= 250 ? 'Performance Unlimited' : 'Corporate Athlete',
        startDate: today,
        endDate: nextYear,
        nextRenewal: today,
        paymentStatus: 'Paid',
        autoRenew: true,
      },
      assignedCoachId: lead.assignedStaffId || 'stf-1',
      activityLog: [{ id: `act-${Date.now()}`, date: 'Today', summary: `Converted from ${lead.source}` }],
    };

    ws.members = [member, ...ws.members];
    ws.transactions = [
      {
        id: `txn-${Date.now()}`,
        memberId: member.id,
        memberName: member.name,
        planName: member.tier,
        amount: member.monthlyRate,
        date: today,
        status: 'Paid',
        method: 'Card ••4242',
      },
      ...ws.transactions,
    ];
    pushAudit(ws, actorName, actorRole, 'Lead', 'Converted prospect to active member', member.name);
    return member;
  });
}

export async function createPlanOffline(
  profileNumId: number,
  plan: MembershipPlan,
  actorName: string,
  actorRole: UserRole
): Promise<MembershipPlan> {
  return withOfflineWrite(profileNumId, (ws) => {
    ws.plans = [...ws.plans, plan];
    pushAudit(ws, actorName, actorRole, 'Billing', 'Created membership plan', plan.name);
    return plan;
  });
}

export async function performSubscriptionActionOffline(
  profileNumId: number,
  memberExternalId: string,
  action: 'renew' | 'freeze' | 'cancel' | 'retry',
  actorName: string,
  actorRole: UserRole
): Promise<string> {
  return withOfflineWrite(profileNumId, (ws) => {
    const target = ws.members.find((m) => m.id === memberExternalId);
    if (!target) throw new Error(`Member ${memberExternalId} not found.`);
    const statusMap: Record<
      typeof action,
      { mem: Member['status']; pay: Member['subscription']['paymentStatus']; msg: string }
    > = {
      renew: { mem: 'Active', pay: 'Paid', msg: `Renewed subscription for ${target.name}` },
      freeze: { mem: 'Frozen', pay: 'Paused', msg: `Froze subscription for ${target.name}` },
      cancel: { mem: 'Cancelled', pay: 'Cancelled', msg: `Cancelled subscription for ${target.name}` },
      retry: { mem: 'Active', pay: 'Paid', msg: `Processed payment retry for ${target.name}` },
    };
    const next = statusMap[action];
    target.status = next.mem;
    target.subscription = { ...target.subscription, paymentStatus: next.pay };
    if (action === 'renew' || action === 'retry') {
      ws.transactions = [
        {
          id: `txn-${Date.now()}`,
          memberId: target.id,
          memberName: target.name,
          planName: target.tier,
          amount: target.monthlyRate,
          date: todayIsoDate(),
          status: 'Paid',
          method: 'Auto-Charge',
        },
        ...ws.transactions,
      ];
    }
    pushAudit(ws, actorName, actorRole, 'Billing', next.msg, target.tier);
    return next.msg;
  });
}

export async function createSessionOffline(
  profileNumId: number,
  session: StudioSession,
  actorName: string,
  actorRole: UserRole
): Promise<StudioSession> {
  return withOfflineWrite(profileNumId, (ws) => {
    ws.sessions = [...ws.sessions, session];
    pushAudit(ws, actorName, actorRole, 'Schedule', 'Published new studio session', `${session.title} (${session.startTime})`);
    return session;
  });
}

export async function performSessionActionOffline(
  profileNumId: number,
  sessionExternalId: string,
  action: 'enroll' | 'waitlist' | 'promote' | 'cancel',
  actorName: string,
  actorRole: UserRole,
  athleteName?: string
): Promise<string> {
  return withOfflineWrite(profileNumId, (ws) => {
    const s = ws.sessions.find((ses) => ses.id === sessionExternalId);
    if (!s) throw new Error(`Session ${sessionExternalId} not found.`);
    let msg = '';
    if (action === 'enroll') {
      if (s.enrolled >= s.capacity) throw new Error(`${s.title} is already at capacity.`);
      s.bookings = [...s.bookings, athleteName || 'Walk-In Athlete'];
      s.enrolled += 1;
      msg = `Booked spot in ${s.title}`;
      pushAudit(ws, actorName, actorRole, 'Schedule', 'Booked athlete into class', s.title);
    } else if (action === 'waitlist') {
      const nextName = athleteName || `Athlete #${s.waitlist.length + 1}`;
      s.waitlist = [...s.waitlist, nextName];
      msg = `Added ${nextName} to waitlist for ${s.title}`;
      pushAudit(ws, actorName, actorRole, 'Schedule', 'Added athlete to waitlist', s.title);
    } else if (action === 'promote') {
      if (s.waitlist.length === 0) throw new Error(`No waitlist entries for ${s.title}.`);
      const [promoted, ...rest] = s.waitlist;
      s.waitlist = rest;
      s.bookings = [...s.bookings, promoted];
      s.enrolled = Math.min(s.capacity, s.enrolled + 1);
      msg = `Promoted ${promoted} into ${s.title}`;
      pushAudit(ws, actorName, actorRole, 'Schedule', `Promoted ${promoted} from waitlist`, s.title);
      pushNotification(ws, {
        category: 'waitlist_opening',
        channel: 'both',
        severity: 'info',
        recipientName: promoted,
        recipientEmail: 'athlete@kinetix.club',
        title: `Waitlist Spot Confirmed: ${s.title}`,
        message: `${promoted} has been promoted from the waitlist into ${s.title} (${s.startTime} · ${s.room}).`,
        targetScreen: 'schedule',
        ruleKey: `waitlist-promoted:${s.id}:${promoted}:${Date.now()}`,
      });
    } else if (action === 'cancel') {
      s.status = 'Cancelled';
      msg = `Cancelled ${s.title}`;
      pushAudit(ws, actorName, actorRole, 'Schedule', 'Cancelled studio session', s.title);
      pushNotification(ws, {
        category: 'upcoming_booking',
        channel: 'both',
        severity: 'warning',
        recipientName: `${s.bookings.length} Booked Athletes`,
        recipientEmail: 'members@kinetix.club',
        title: `Session Cancelled: ${s.title}`,
        message: `${s.title} at ${s.startTime} with ${s.coach} was cancelled. Automatic booking alert sent to roster.`,
        targetScreen: 'schedule',
        ruleKey: `session-cancelled:${s.id}:${Date.now()}`,
      });
    }
    return msg;
  });
}

export async function createStaffOffline(
  profileNumId: number,
  member: StaffMember,
  actorName: string,
  actorRole: UserRole
): Promise<StaffMember> {
  return withOfflineWrite(profileNumId, (ws) => {
    ws.staff = [...ws.staff, member];
    pushAudit(ws, actorName, actorRole, 'System', 'Added team member', `${member.name} (${member.role})`);
    return member;
  });
}

export async function evaluateAutomatedNotificationsOffline(
  profileNumId: number,
  actorName: string,
  actorRole: UserRole
): Promise<{ created: GymNotification[]; evaluatedCount: number }> {
  return withOfflineWrite(profileNumId, (ws) => {
    const existingKeys = new Set(ws.notifications.map((n) => n.ruleKey));
    const created: GymNotification[] = [];

    for (const m of ws.members) {
      if (m.subscription.paymentStatus === 'Past Due' || m.status === 'At-Risk') {
        const ruleKey = `expiring:${m.id}`;
        if (!existingKeys.has(ruleKey)) {
          created.push(
            pushNotification(ws, {
              category: 'expiring_membership',
              channel: 'both',
              severity: 'critical',
              recipientName: m.name,
              recipientEmail: m.email,
              title: 'Membership Renewal & Payment Reminder',
              message: `${m.name}'s ${m.tier} plan ($${m.monthlyRate}/mo) needs attention before ${m.subscription.nextRenewal}.`,
              targetScreen: 'billing',
              ruleKey,
            })
          );
          existingKeys.add(ruleKey);
        }
      }
    }

    const today = todayIsoDate();
    for (const l of ws.leads) {
      if (l.stage !== 'Converted' && l.stage !== 'Lost' && l.followUpDate <= today) {
        const ruleKey = `followup:${l.id}`;
        if (!existingKeys.has(ruleKey)) {
          created.push(
            pushNotification(ws, {
              category: 'overdue_followup',
              channel: 'in_app',
              severity: 'warning',
              recipientName: l.name,
              recipientEmail: l.email,
              title: 'Prospect Follow-Up Due',
              message: `${l.name} (${l.stage}) was scheduled for follow-up on ${l.followUpDate}.`,
              targetScreen: 'leads',
              ruleKey,
            })
          );
          existingKeys.add(ruleKey);
        }
      }
    }

    for (const eq of ws.equipment) {
      if (eq.status === 'Maintenance') {
        const ruleKey = `equip:${eq.id}`;
        if (!existingKeys.has(ruleKey)) {
          created.push(
            pushNotification(ws, {
              category: 'operational_alert',
              channel: 'in_app',
              severity: 'warning',
              recipientName: 'Club Operations Team',
              recipientEmail: 'ops@kinetix.club',
              title: `Equipment Service Needed: ${eq.name}`,
              message: `${eq.name} in ${eq.bay} is marked for maintenance (last serviced ${eq.lastServiced}).`,
              targetScreen: 'floor',
              ruleKey,
            })
          );
          existingKeys.add(ruleKey);
        }
      }
    }

    if (created.length > 0) {
      pushAudit(ws, actorName, actorRole, 'System', `Generated ${created.length} automated reminder(s)`, 'Automated Rules');
    }
    return { created, evaluatedCount: created.length };
  });
}

export async function updateNotificationStatusOffline(
  profileNumId: number,
  externalId: string,
  status: 'unread' | 'read' | 'sent'
): Promise<void> {
  await withOfflineWrite(profileNumId, (ws) => {
    const n = ws.notifications.find((item) => item.id === externalId);
    if (n) n.status = status;
  });
}

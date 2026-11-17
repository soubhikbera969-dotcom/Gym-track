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

function getVaultFilePath(): string {
  return path.join(resolveDataDir(), 'company-workspace.enc');
}

function readEncryptedWorkspace(): WorkspacePayload {
  const filePath = getVaultFilePath();
  if (!fs.existsSync(filePath)) {
    const initial = buildSeedWorkspace();
    writeEncryptedWorkspace(initial);
    return initial;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
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
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(decrypted) as WorkspacePayload;
}

function writeEncryptedWorkspace(payload: WorkspacePayload): void {
  const filePath = getVaultFilePath();
  const tmpPath = `${filePath}.tmp`;
  const key = getVaultEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope = JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  });

  fs.writeFileSync(tmpPath, envelope, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

let writeQueue: Promise<unknown> = Promise.resolve();

function withOfflineWrite<T>(fn: (ws: WorkspacePayload) => T | Promise<T>): Promise<T> {
  const next = writeQueue.then(async () => {
    const ws = readEncryptedWorkspace();
    const res = await fn(ws);
    writeEncryptedWorkspace(ws);
    return res;
  });
  writeQueue = next.catch(() => undefined);
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

export async function loadWorkspaceOffline(): Promise<WorkspacePayload> {
  return readEncryptedWorkspace();
}

export async function appendAuditOffline(
  actor: string,
  role: UserRole,
  category: AuditEntry['category'],
  action: string,
  target: string
): Promise<AuditEntry> {
  return withOfflineWrite((ws) => pushAudit(ws, actor, role, category, action, target));
}

export async function createNotificationOffline(input: {
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
}): Promise<GymNotification> {
  return withOfflineWrite((ws) => pushNotification(ws, input));
}

export async function updateConfigOffline(
  patch: Partial<GymConfig> & { activeRole?: UserRole; activeFacilityId?: string },
  actorName: string
): Promise<void> {
  await withOfflineWrite((ws) => {
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
    pushAudit(ws, actorName, ws.activeRole, 'System', 'Updated club settings', 'Local Company Settings');
  });
}

export async function recordCheckInOffline(
  memberId: string,
  zoneId: ZoneId,
  facilityId: string,
  actorName: string,
  actorRole: UserRole
): Promise<CheckInLog> {
  return withOfflineWrite((ws) => {
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
  facilityId: string,
  zoneKey: ZoneId,
  delta: number
): Promise<GymZone> {
  return withOfflineWrite((ws) => {
    const facZones = ws.zonesByFacility[facilityId] || ws.zonesByFacility.soho || [];
    const zone = facZones.find((z) => z.id === zoneKey);
    if (!zone) throw new Error(`Zone ${zoneKey} not found.`);
    zone.occupancy = Math.max(0, Math.min(zone.capacity, zone.occupancy + delta));
    return { ...zone };
  });
}

export async function cycleEquipmentStatusOffline(
  externalId: string,
  actorName: string,
  actorRole: UserRole,
  explicitStatus?: EquipmentStatus
): Promise<EquipmentItem> {
  return withOfflineWrite((ws) => {
    const eq = ws.equipment.find((e) => e.id === externalId);
    if (!eq) throw new Error(`Equipment ${externalId} not found.`);
    const order: EquipmentStatus[] = ['Operational', 'In Use', 'Maintenance'];
    eq.status = explicitStatus || order[(order.indexOf(eq.status) + 1) % order.length];
    pushAudit(ws, actorName, actorRole, 'System', `Marked equipment ${eq.status}`, eq.name);
    return { ...eq };
  });
}

export async function createMemberOffline(
  member: Member,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  return withOfflineWrite((ws) => {
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
  updated: Member,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  return withOfflineWrite((ws) => {
    const idx = ws.members.findIndex((m) => m.id === updated.id);
    if (idx === -1) throw new Error(`Member ${updated.id} not found.`);
    ws.members[idx] = updated;
    pushAudit(ws, actorName, actorRole, 'Member', auditSummary, updated.name);
    return updated;
  });
}

export async function importMembersOffline(
  imported: Member[],
  facilityName: string,
  actorName: string,
  actorRole: UserRole
): Promise<void> {
  await withOfflineWrite((ws) => {
    ws.members = [...imported, ...ws.members];
    pushAudit(ws, actorName, actorRole, 'Member', `Imported ${imported.length} CSV members`, facilityName);
  });
}

export async function createLeadOffline(
  lead: Lead,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  return withOfflineWrite((ws) => {
    ws.leads = [lead, ...ws.leads];
    pushAudit(ws, actorName, actorRole, 'Lead', 'Added new prospect', `${lead.name} (${lead.source})`);
    return lead;
  });
}

export async function updateLeadOffline(
  updated: Lead,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  return withOfflineWrite((ws) => {
    const idx = ws.leads.findIndex((l) => l.id === updated.id);
    if (idx === -1) throw new Error(`Lead ${updated.id} not found.`);
    ws.leads[idx] = updated;
    pushAudit(ws, actorName, actorRole, 'Lead', auditSummary, updated.name);
    return updated;
  });
}

export async function convertLeadOffline(
  leadExternalId: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  return withOfflineWrite((ws) => {
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
  plan: MembershipPlan,
  actorName: string,
  actorRole: UserRole
): Promise<MembershipPlan> {
  return withOfflineWrite((ws) => {
    ws.plans = [...ws.plans, plan];
    pushAudit(ws, actorName, actorRole, 'Billing', 'Created membership plan', plan.name);
    return plan;
  });
}

export async function performSubscriptionActionOffline(
  memberExternalId: string,
  action: 'renew' | 'freeze' | 'cancel' | 'retry',
  actorName: string,
  actorRole: UserRole
): Promise<string> {
  return withOfflineWrite((ws) => {
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
  session: StudioSession,
  actorName: string,
  actorRole: UserRole
): Promise<StudioSession> {
  return withOfflineWrite((ws) => {
    ws.sessions = [...ws.sessions, session];
    pushAudit(ws, actorName, actorRole, 'Schedule', 'Published new studio session', `${session.title} (${session.startTime})`);
    return session;
  });
}

export async function performSessionActionOffline(
  sessionExternalId: string,
  action: 'enroll' | 'waitlist' | 'promote' | 'cancel',
  actorName: string,
  actorRole: UserRole,
  athleteName?: string
): Promise<string> {
  return withOfflineWrite((ws) => {
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
  member: StaffMember,
  actorName: string,
  actorRole: UserRole
): Promise<StaffMember> {
  return withOfflineWrite((ws) => {
    ws.staff = [...ws.staff, member];
    pushAudit(ws, actorName, actorRole, 'System', 'Added team member', `${member.name} (${member.role})`);
    return member;
  });
}

export async function evaluateAutomatedNotificationsOffline(
  actorName: string,
  actorRole: UserRole
): Promise<{ created: GymNotification[]; evaluatedCount: number }> {
  return withOfflineWrite((ws) => {
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
  externalId: string,
  status: 'unread' | 'read' | 'sent'
): Promise<void> {
  await withOfflineWrite((ws) => {
    const n = ws.notifications.find((item) => item.id === externalId);
    if (n) n.status = status;
  });
}

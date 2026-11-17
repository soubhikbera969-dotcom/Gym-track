import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  checkInLogs,
  equipment,
  gymConfigs,
  leads,
  members,
  membershipPlans,
  notifications,
  staff,
  studioSessions,
  transactions,
  zones,
} from './schema.ts';
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
  TransactionRecord,
  UserRole,
  ZoneId,
} from '../types/gym.ts';

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

export async function appendAuditDb(
  userId: number,
  actor: string,
  role: UserRole,
  category: AuditEntry['category'],
  action: string,
  target: string
): Promise<AuditEntry> {
  try {
    const entry: AuditEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTimeStr(),
      actor,
      role,
      category,
      action,
      target,
    };
    await db.insert(auditLogs).values({
      userId,
      externalId: entry.id,
      timestamp: entry.timestamp,
      actor: entry.actor,
      role: entry.role,
      category: entry.category,
      action: entry.action,
      target: entry.target,
    });
    return entry;
  } catch (error) {
    console.error('Database query failed in appendAuditDb:', error);
    throw new Error('Failed to write audit log entry.', { cause: error });
  }
}

export async function createNotificationDb(
  userId: number,
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
  try {
    const externalId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = nowDateTimeStr();
    const status = input.status ?? (input.channel === 'email' ? 'sent' : 'unread');
    await db.insert(notifications).values({
      userId,
      externalId,
      category: input.category,
      channel: input.channel,
      severity: input.severity,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      title: input.title,
      message: input.message,
      status,
      targetScreen: input.targetScreen,
      ruleKey: input.ruleKey,
      createdAt,
    });
    return {
      id: externalId,
      category: input.category,
      channel: input.channel,
      severity: input.severity,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      title: input.title,
      message: input.message,
      status,
      targetScreen: input.targetScreen,
      ruleKey: input.ruleKey,
      createdAt,
    };
  } catch (error) {
    console.error('Database query failed in createNotificationDb:', error);
    throw new Error('Failed to create notification record.', { cause: error });
  }
}

export interface WorkspacePayload {
  config: GymConfig;
  activeRole: UserRole;
  activeFacilityId: string;
  zonesByFacility: Record<string, GymZone[]>;
  equipment: EquipmentItem[];
  staff: StaffMember[];
  members: Member[];
  leads: Lead[];
  plans: MembershipPlan[];
  transactions: TransactionRecord[];
  checkIns: CheckInLog[];
  sessions: StudioSession[];
  notifications: GymNotification[];
  auditLog: AuditEntry[];
}

export async function loadWorkspaceData(userId: number): Promise<WorkspacePayload> {
  try {
    const [
      cfgRows,
      zoneRows,
      equipRows,
      staffRows,
      memberRows,
      leadRows,
      planRows,
      txnRows,
      checkInRows,
      sessionRows,
      notifRows,
      auditRows,
    ] = await Promise.all([
      db.select().from(gymConfigs).where(eq(gymConfigs.userId, userId)),
      db.select().from(zones).where(eq(zones.userId, userId)),
      db.select().from(equipment).where(eq(equipment.userId, userId)),
      db.select().from(staff).where(eq(staff.userId, userId)),
      db.select().from(members).where(eq(members.userId, userId)).orderBy(desc(members.id)),
      db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.id)),
      db.select().from(membershipPlans).where(eq(membershipPlans.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.id)),
      db.select().from(checkInLogs).where(eq(checkInLogs.userId, userId)).orderBy(desc(checkInLogs.id)),
      db.select().from(studioSessions).where(eq(studioSessions.userId, userId)),
      db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.id)),
      db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.id)),
    ]);

    const cfgRow = cfgRows[0];
    const config: GymConfig = cfgRow
      ? {
          operatingHours: cfgRow.operatingHours,
          maxOccupancyThresholdPct: cfgRow.maxOccupancyThresholdPct,
          autoWaitlistPromote: cfgRow.autoWaitlistPromote,
          gracePeriodDays: cfgRow.gracePeriodDays,
          taxRatePct: cfgRow.taxRatePct,
          requireSignedWaiver: cfgRow.requireSignedWaiver,
        }
      : {
          operatingHours: '05:30 – 22:30 Daily',
          maxOccupancyThresholdPct: 85,
          autoWaitlistPromote: true,
          gracePeriodDays: 7,
          taxRatePct: 8.875,
          requireSignedWaiver: true,
        };

    const zonesByFacility: Record<string, GymZone[]> = {};
    for (const z of zoneRows) {
      if (!zonesByFacility[z.facilityId]) zonesByFacility[z.facilityId] = [];
      zonesByFacility[z.facilityId].push({
        id: z.zoneKey as ZoneId,
        name: z.name,
        shortName: z.shortName,
        description: z.description,
        occupancy: z.occupancy,
        capacity: z.capacity,
        tempF: z.tempF,
        co2Ppm: z.co2Ppm,
        activeCoach: z.activeCoach,
        currentProgram: z.currentProgram,
        accentHex: z.accentHex,
      });
    }

    return {
      config,
      activeRole: (cfgRow?.activeRole as UserRole) || 'Director',
      activeFacilityId: cfgRow?.activeFacilityId || 'soho',
      zonesByFacility,
      equipment: equipRows.map((e) => ({
        id: e.externalId,
        name: e.name,
        bay: e.bay,
        zoneId: e.zoneId as ZoneId,
        status: e.status as EquipmentStatus,
        cyclesToday: e.cyclesToday,
        lastServiced: e.lastServiced,
      })),
      staff: staffRows.map((s) => ({
        id: s.externalId,
        name: s.name,
        role: s.role as StaffMember['role'],
        specialty: s.specialty,
        email: s.email,
        avatarUrl: s.avatarUrl ?? undefined,
        initials: s.initials,
        availability: s.availability,
        status: s.status as StaffMember['status'],
        sessionsThisMonth: s.sessionsThisMonth,
        retentionRate: s.retentionRate,
        conversionRate: s.conversionRate,
      })),
      members: memberRows.map((m) => ({
        id: m.externalId,
        name: m.name,
        email: m.email,
        phone: m.phone,
        avatarUrl: m.avatarUrl ?? undefined,
        initials: m.initials,
        tier: m.tier as Member['tier'],
        monthlyRate: m.monthlyRate,
        status: m.status as Member['status'],
        checkIns30d: m.checkIns30d,
        weeklySpark: m.weeklySpark,
        lastVisit: m.lastVisit,
        preferredZone: m.preferredZone as ZoneId,
        joinedDate: m.joinedDate,
        facilityId: m.facilityId,
        notes: m.notes,
        goals: m.goals,
        emergencyContact: m.emergencyContact,
        documents: m.documents,
        assessments: m.assessments,
        subscription: m.subscription,
        assignedCoachId: m.assignedCoachId,
        activityLog: m.activityLog,
      })),
      leads: leadRows.map((l) => ({
        id: l.externalId,
        name: l.name,
        email: l.email,
        phone: l.phone,
        source: l.source as Lead['source'],
        stage: l.stage as Lead['stage'],
        trialStatus: l.trialStatus as Lead['trialStatus'],
        followUpDate: l.followUpDate,
        assignedStaffId: l.assignedStaffId,
        estimatedValue: l.estimatedValue,
        notes: l.notes,
        createdAt: l.createdAt,
        facilityId: l.facilityId,
      })),
      plans: planRows.map((p) => ({
        id: p.externalId,
        name: p.name,
        price: p.price,
        billingCycle: p.billingCycle as MembershipPlan['billingCycle'],
        accessHours: p.accessHours,
        includedClasses: p.includedClasses,
        activeSubscribers: p.activeSubscribers,
      })),
      transactions: txnRows.map((t) => ({
        id: t.externalId,
        memberId: t.memberId,
        memberName: t.memberName,
        planName: t.planName,
        amount: t.amount,
        date: t.date,
        status: t.status as TransactionRecord['status'],
        method: t.method,
      })),
      checkIns: checkInRows.map((c) => ({
        id: c.externalId,
        memberId: c.memberId,
        memberName: c.memberName,
        memberAvatar: c.memberAvatar ?? undefined,
        memberInitials: c.memberInitials,
        tier: c.tier as Member['tier'],
        zoneId: c.zoneId as ZoneId,
        zoneName: c.zoneName,
        timestamp: c.timestamp,
        date: c.date,
        facilityId: c.facilityId,
      })),
      sessions: sessionRows.map((s) => ({
        id: s.externalId,
        title: s.title,
        room: s.room,
        zoneId: s.zoneId as ZoneId,
        coach: s.coach,
        coachAvatar: s.coachAvatar ?? undefined,
        startTime: s.startTime,
        durationMin: s.durationMin,
        enrolled: s.enrolled,
        capacity: s.capacity,
        intensity: s.intensity as StudioSession['intensity'],
        facilityId: s.facilityId,
        bookings: s.bookings,
        waitlist: s.waitlist,
        status: s.status as StudioSession['status'],
      })),
      notifications: notifRows.map((n) => ({
        id: n.externalId,
        category: n.category as NotificationCategory,
        channel: n.channel as NotificationChannel,
        severity: n.severity as GymNotification['severity'],
        recipientName: n.recipientName,
        recipientEmail: n.recipientEmail,
        title: n.title,
        message: n.message,
        status: n.status as GymNotification['status'],
        targetScreen: n.targetScreen as ScreenView,
        ruleKey: n.ruleKey,
        createdAt: n.createdAt,
      })),
      auditLog: auditRows.map((a) => ({
        id: a.externalId,
        timestamp: a.timestamp,
        actor: a.actor,
        role: a.role as UserRole,
        category: a.category as AuditEntry['category'],
        action: a.action,
        target: a.target,
      })),
    };
  } catch (error) {
    console.error('Database query failed in loadWorkspaceData:', error);
    throw new Error('Failed to load CRM workspace data.', { cause: error });
  }
}

export async function updateConfigDb(
  userId: number,
  patch: Partial<GymConfig> & { activeRole?: UserRole; activeFacilityId?: string },
  actorName: string
) {
  try {
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.operatingHours !== undefined) updateSet.operatingHours = patch.operatingHours;
    if (patch.maxOccupancyThresholdPct !== undefined)
      updateSet.maxOccupancyThresholdPct = patch.maxOccupancyThresholdPct;
    if (patch.autoWaitlistPromote !== undefined)
      updateSet.autoWaitlistPromote = patch.autoWaitlistPromote;
    if (patch.gracePeriodDays !== undefined) updateSet.gracePeriodDays = patch.gracePeriodDays;
    if (patch.taxRatePct !== undefined) updateSet.taxRatePct = patch.taxRatePct;
    if (patch.requireSignedWaiver !== undefined)
      updateSet.requireSignedWaiver = patch.requireSignedWaiver;
    if (patch.activeRole !== undefined) updateSet.activeRole = patch.activeRole;
    if (patch.activeFacilityId !== undefined) updateSet.activeFacilityId = patch.activeFacilityId;

    await db.update(gymConfigs).set(updateSet).where(eq(gymConfigs.userId, userId));

    const role = patch.activeRole ?? 'Director';
    if (patch.operatingHours !== undefined || patch.maxOccupancyThresholdPct !== undefined) {
      await appendAuditDb(
        userId,
        actorName,
        role,
        'System',
        'Updated gym configuration',
        `Threshold ${patch.maxOccupancyThresholdPct ?? 85}%`
      );
    } else if (patch.activeRole !== undefined) {
      await appendAuditDb(
        userId,
        actorName,
        patch.activeRole,
        'System',
        'Switched workspace role',
        patch.activeRole
      );
    }
  } catch (error) {
    console.error('Database update failed in updateConfigDb:', error);
    throw new Error('Failed to update configuration.', { cause: error });
  }
}

export async function recordCheckInDb(
  userId: number,
  memberId: string,
  zoneId: ZoneId,
  facilityId: string,
  actorName: string,
  actorRole: UserRole
): Promise<CheckInLog> {
  try {
    const memberRows = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.externalId, memberId)));
    const member = memberRows[0];
    if (!member) {
      throw new Error(`Member ${memberId} not found.`);
    }

    const zoneRows = await db
      .select()
      .from(zones)
      .where(
        and(
          eq(zones.userId, userId),
          eq(zones.facilityId, facilityId),
          eq(zones.zoneKey, zoneId)
        )
      );
    const zone = zoneRows[0];
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found for facility ${facilityId}.`);
    }

    const timeStr = nowTimeStr();
    const dateStr = todayIsoDate();
    const checkIn: CheckInLog = {
      id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      memberId: member.externalId,
      memberName: member.name,
      memberAvatar: member.avatarUrl ?? undefined,
      memberInitials: member.initials,
      tier: member.tier as Member['tier'],
      zoneId,
      zoneName: zone.shortName,
      timestamp: timeStr,
      date: dateStr,
      facilityId,
    };

    await db.insert(checkInLogs).values({
      userId,
      externalId: checkIn.id,
      memberId: checkIn.memberId,
      memberName: checkIn.memberName,
      memberAvatar: checkIn.memberAvatar ?? null,
      memberInitials: checkIn.memberInitials,
      tier: checkIn.tier,
      zoneId: checkIn.zoneId,
      zoneName: checkIn.zoneName,
      timestamp: checkIn.timestamp,
      date: checkIn.date,
      facilityId: checkIn.facilityId,
    });

    const nextActivity = [
      { id: `act-${Date.now()}`, date: `Today, ${timeStr}`, summary: `Checked into ${zone.name}` },
      ...member.activityLog,
    ];

    await db
      .update(members)
      .set({
        checkIns30d: member.checkIns30d + 1,
        lastVisit: `Today, ${timeStr}`,
        status: 'Active',
        activityLog: nextActivity,
      })
      .where(eq(members.id, member.id));

    const nextOccupancy = Math.min(zone.capacity, zone.occupancy + 1);
    await db
      .update(zones)
      .set({ occupancy: nextOccupancy })
      .where(eq(zones.id, zone.id));

    await appendAuditDb(
      userId,
      actorName,
      actorRole,
      'Check-In',
      'Logged gate check-in',
      `${member.name} -> ${zone.shortName}`
    );

    return checkIn;
  } catch (error) {
    console.error('Database query failed in recordCheckInDb:', error);
    throw new Error('Failed to log member check-in.', { cause: error });
  }
}

export async function adjustZoneOccupancyDb(
  userId: number,
  facilityId: string,
  zoneKey: ZoneId,
  delta: number
): Promise<GymZone> {
  try {
    const rows = await db
      .select()
      .from(zones)
      .where(
        and(
          eq(zones.userId, userId),
          eq(zones.facilityId, facilityId),
          eq(zones.zoneKey, zoneKey)
        )
      );
    const z = rows[0];
    if (!z) throw new Error(`Zone ${zoneKey} not found.`);
    const nextOcc = Math.max(0, Math.min(z.capacity, z.occupancy + delta));
    await db.update(zones).set({ occupancy: nextOcc }).where(eq(zones.id, z.id));
    return {
      id: z.zoneKey as ZoneId,
      name: z.name,
      shortName: z.shortName,
      description: z.description,
      occupancy: nextOcc,
      capacity: z.capacity,
      tempF: z.tempF,
      co2Ppm: z.co2Ppm,
      activeCoach: z.activeCoach,
      currentProgram: z.currentProgram,
      accentHex: z.accentHex,
    };
  } catch (error) {
    console.error('Database query failed in adjustZoneOccupancyDb:', error);
    throw new Error('Failed to adjust zone occupancy.', { cause: error });
  }
}

export async function cycleEquipmentStatusDb(
  userId: number,
  externalId: string,
  actorName: string,
  actorRole: UserRole,
  explicitStatus?: EquipmentStatus
): Promise<EquipmentItem> {
  try {
    const rows = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.userId, userId), eq(equipment.externalId, externalId)));
    const item = rows[0];
    if (!item) throw new Error(`Equipment ${externalId} not found.`);

    const order: EquipmentStatus[] = ['Operational', 'In Use', 'Maintenance'];
    const nextStatus =
      explicitStatus ?? order[(order.indexOf(item.status as EquipmentStatus) + 1) % order.length];

    await db
      .update(equipment)
      .set({ status: nextStatus })
      .where(eq(equipment.id, item.id));

    await appendAuditDb(userId, actorName, actorRole, 'Equipment', `Set status to ${nextStatus}`, item.name);

    if (nextStatus === 'Maintenance') {
      await createNotificationDb(userId, {
        category: 'operational_alert',
        channel: 'in_app',
        severity: 'warning',
        recipientName: 'Facility Operations',
        recipientEmail: 'ops@kinetix.club',
        title: `Equipment Maintenance Flagged: ${item.bay}`,
        message: `${item.name} (${item.bay}) was switched to Maintenance status and requires technician inspection.`,
        targetScreen: 'floor',
        ruleKey: `equip:${item.externalId}:${Date.now()}`,
      });
    }

    return {
      id: item.externalId,
      name: item.name,
      bay: item.bay,
      zoneId: item.zoneId as ZoneId,
      status: nextStatus,
      cyclesToday: item.cyclesToday,
      lastServiced: item.lastServiced,
    };
  } catch (error) {
    console.error('Database query failed in cycleEquipmentStatusDb:', error);
    throw new Error('Failed to update equipment status.', { cause: error });
  }
}

export async function createMemberDb(
  userId: number,
  member: Member,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  try {
    await db.insert(members).values({
      userId,
      externalId: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      avatarUrl: member.avatarUrl ?? null,
      initials: member.initials,
      tier: member.tier,
      monthlyRate: member.monthlyRate,
      status: member.status,
      checkIns30d: member.checkIns30d,
      weeklySpark: member.weeklySpark,
      lastVisit: member.lastVisit,
      preferredZone: member.preferredZone,
      joinedDate: member.joinedDate,
      facilityId: member.facilityId,
      notes: member.notes,
      goals: member.goals,
      emergencyContact: member.emergencyContact,
      documents: member.documents,
      assessments: member.assessments,
      subscription: member.subscription,
      assignedCoachId: member.assignedCoachId,
      activityLog: member.activityLog,
    });

    await db.insert(transactions).values({
      userId,
      externalId: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      memberId: member.id,
      memberName: member.name,
      planName: member.tier,
      amount: member.monthlyRate,
      date: todayIsoDate(),
      status: 'Paid',
      method: 'Card on file',
    });

    await appendAuditDb(
      userId,
      actorName,
      actorRole,
      'Member',
      'Enrolled new member',
      `${member.name} (${member.tier})`
    );
    return member;
  } catch (error) {
    console.error('Database query failed in createMemberDb:', error);
    throw new Error('Failed to create member record.', { cause: error });
  }
}

export async function updateMemberDb(
  userId: number,
  updated: Member,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  try {
    await db
      .update(members)
      .set({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        tier: updated.tier,
        monthlyRate: updated.monthlyRate,
        status: updated.status,
        checkIns30d: updated.checkIns30d,
        weeklySpark: updated.weeklySpark,
        lastVisit: updated.lastVisit,
        preferredZone: updated.preferredZone,
        notes: updated.notes,
        goals: updated.goals,
        emergencyContact: updated.emergencyContact,
        documents: updated.documents,
        assessments: updated.assessments,
        subscription: updated.subscription,
        assignedCoachId: updated.assignedCoachId,
        activityLog: updated.activityLog,
      })
      .where(and(eq(members.userId, userId), eq(members.externalId, updated.id)));

    await appendAuditDb(userId, actorName, actorRole, 'Member', auditSummary, updated.name);
    return updated;
  } catch (error) {
    console.error('Database query failed in updateMemberDb:', error);
    throw new Error('Failed to update member profile.', { cause: error });
  }
}

export async function importMembersDb(
  userId: number,
  imported: Member[],
  facilityName: string,
  actorName: string,
  actorRole: UserRole
): Promise<void> {
  try {
    if (imported.length === 0) return;
    await db.insert(members).values(
      imported.map((m) => ({
        userId,
        externalId: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        avatarUrl: m.avatarUrl ?? null,
        initials: m.initials,
        tier: m.tier,
        monthlyRate: m.monthlyRate,
        status: m.status,
        checkIns30d: m.checkIns30d,
        weeklySpark: m.weeklySpark,
        lastVisit: m.lastVisit,
        preferredZone: m.preferredZone,
        joinedDate: m.joinedDate,
        facilityId: m.facilityId,
        notes: m.notes,
        goals: m.goals,
        emergencyContact: m.emergencyContact,
        documents: m.documents,
        assessments: m.assessments,
        subscription: m.subscription,
        assignedCoachId: m.assignedCoachId,
        activityLog: m.activityLog,
      }))
    );

    await appendAuditDb(
      userId,
      actorName,
      actorRole,
      'Member',
      `Imported ${imported.length} members via CSV`,
      facilityName
    );
  } catch (error) {
    console.error('Database query failed in importMembersDb:', error);
    throw new Error('Failed to import members.', { cause: error });
  }
}

export async function createLeadDb(
  userId: number,
  lead: Lead,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  try {
    await db.insert(leads).values({
      userId,
      externalId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      stage: lead.stage,
      trialStatus: lead.trialStatus,
      followUpDate: lead.followUpDate,
      assignedStaffId: lead.assignedStaffId,
      estimatedValue: lead.estimatedValue,
      notes: lead.notes,
      createdAt: lead.createdAt,
      facilityId: lead.facilityId,
    });
    await appendAuditDb(
      userId,
      actorName,
      actorRole,
      'Lead',
      'Added prospect inquiry',
      `${lead.name} (${lead.source})`
    );
    return lead;
  } catch (error) {
    console.error('Database query failed in createLeadDb:', error);
    throw new Error('Failed to create lead record.', { cause: error });
  }
}

export async function updateLeadDb(
  userId: number,
  updated: Lead,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  try {
    await db
      .update(leads)
      .set({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        source: updated.source,
        stage: updated.stage,
        trialStatus: updated.trialStatus,
        followUpDate: updated.followUpDate,
        assignedStaffId: updated.assignedStaffId,
        estimatedValue: updated.estimatedValue,
        notes: updated.notes,
      })
      .where(and(eq(leads.userId, userId), eq(leads.externalId, updated.id)));

    await appendAuditDb(userId, actorName, actorRole, 'Lead', auditSummary, updated.name);
    return updated;
  } catch (error) {
    console.error('Database query failed in updateLeadDb:', error);
    throw new Error('Failed to update lead record.', { cause: error });
  }
}

export async function convertLeadDb(
  userId: number,
  leadExternalId: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  try {
    const leadRows = await db
      .select()
      .from(leads)
      .where(and(eq(leads.userId, userId), eq(leads.externalId, leadExternalId)));
    const lead = leadRows[0];
    if (!lead) throw new Error(`Lead ${leadExternalId} not found.`);

    await db
      .update(leads)
      .set({ stage: 'Converted', trialStatus: 'Trial Completed' })
      .where(eq(leads.id, lead.id));

    const initials = lead.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('');
    const today = todayIsoDate();
    const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;

    const newMember: Member = {
      id: `mem-${Date.now()}`,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      initials: initials || 'KM',
      tier: 'Performance Unlimited',
      monthlyRate: lead.estimatedValue || 265,
      status: 'Active',
      checkIns30d: 1,
      weeklySpark: [0, 0, 0, 0, 0, 0, 1],
      lastVisit: 'Converted today',
      preferredZone: 'lifting',
      joinedDate: today,
      facilityId: lead.facilityId,
      notes: `Converted from ${lead.source} pipeline. ${lead.notes}`,
      goals: ['Complete 30-day onboarding assessment'],
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
        planName: 'Performance Unlimited',
        startDate: today,
        endDate: nextYear,
        nextRenewal: today,
        paymentStatus: 'Paid',
        autoRenew: true,
      },
      assignedCoachId: lead.assignedStaffId,
      activityLog: [
        { id: `act-${Date.now()}`, date: 'Today', summary: `Converted from ${lead.source} prospect` },
      ],
    };

    await db.insert(members).values({
      userId,
      externalId: newMember.id,
      name: newMember.name,
      email: newMember.email,
      phone: newMember.phone,
      avatarUrl: null,
      initials: newMember.initials,
      tier: newMember.tier,
      monthlyRate: newMember.monthlyRate,
      status: newMember.status,
      checkIns30d: newMember.checkIns30d,
      weeklySpark: newMember.weeklySpark,
      lastVisit: newMember.lastVisit,
      preferredZone: newMember.preferredZone,
      joinedDate: newMember.joinedDate,
      facilityId: newMember.facilityId,
      notes: newMember.notes,
      goals: newMember.goals,
      emergencyContact: newMember.emergencyContact,
      documents: newMember.documents,
      assessments: newMember.assessments,
      subscription: newMember.subscription,
      assignedCoachId: newMember.assignedCoachId,
      activityLog: newMember.activityLog,
    });

    await db.insert(transactions).values({
      userId,
      externalId: `txn-${Date.now()}`,
      memberId: newMember.id,
      memberName: newMember.name,
      planName: newMember.tier,
      amount: newMember.monthlyRate,
      date: today,
      status: 'Paid',
      method: 'Onboarding Card',
    });

    await appendAuditDb(userId, actorName, actorRole, 'Lead', 'Converted prospect to active member', lead.name);
    return newMember;
  } catch (error) {
    console.error('Database query failed in convertLeadDb:', error);
    throw new Error('Failed to convert lead.', { cause: error });
  }
}

export async function createPlanDb(
  userId: number,
  plan: MembershipPlan,
  actorName: string,
  actorRole: UserRole
): Promise<MembershipPlan> {
  try {
    await db.insert(membershipPlans).values({
      userId,
      externalId: plan.id,
      name: plan.name,
      price: plan.price,
      billingCycle: plan.billingCycle,
      accessHours: plan.accessHours,
      includedClasses: plan.includedClasses,
      activeSubscribers: plan.activeSubscribers,
    });
    await appendAuditDb(userId, actorName, actorRole, 'Billing', 'Created membership plan', `${plan.name} ($${plan.price})`);
    return plan;
  } catch (error) {
    console.error('Database query failed in createPlanDb:', error);
    throw new Error('Failed to create membership plan.', { cause: error });
  }
}

export async function performSubscriptionActionDb(
  userId: number,
  memberExternalId: string,
  action: 'renew' | 'freeze' | 'cancel' | 'retry',
  actorName: string,
  actorRole: UserRole
): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.externalId, memberExternalId)));
    const target = rows[0];
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
    const nextSub = { ...target.subscription, paymentStatus: next.pay };
    await db
      .update(members)
      .set({ status: next.mem, subscription: nextSub })
      .where(eq(members.id, target.id));

    if (action === 'renew' || action === 'retry') {
      await db.insert(transactions).values({
        userId,
        externalId: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        memberId: target.externalId,
        memberName: target.name,
        planName: target.tier,
        amount: target.monthlyRate,
        date: todayIsoDate(),
        status: 'Paid',
        method: 'Auto-Charge',
      });
    }

    await appendAuditDb(userId, actorName, actorRole, 'Billing', next.msg, target.tier);
    return next.msg;
  } catch (error) {
    console.error('Database query failed in performSubscriptionActionDb:', error);
    throw new Error('Failed to update member subscription.', { cause: error });
  }
}

export async function createSessionDb(
  userId: number,
  session: StudioSession,
  actorName: string,
  actorRole: UserRole
): Promise<StudioSession> {
  try {
    await db.insert(studioSessions).values({
      userId,
      externalId: session.id,
      title: session.title,
      room: session.room,
      zoneId: session.zoneId,
      coach: session.coach,
      coachAvatar: session.coachAvatar ?? null,
      startTime: session.startTime,
      durationMin: session.durationMin,
      enrolled: session.enrolled,
      capacity: session.capacity,
      intensity: session.intensity,
      facilityId: session.facilityId,
      bookings: session.bookings,
      waitlist: session.waitlist,
      status: session.status,
    });

    await appendAuditDb(
      userId,
      actorName,
      actorRole,
      'Schedule',
      'Published new studio session',
      `${session.title} (${session.startTime})`
    );
    return session;
  } catch (error) {
    console.error('Database query failed in createSessionDb:', error);
    throw new Error('Failed to create studio session.', { cause: error });
  }
}

export async function performSessionActionDb(
  userId: number,
  sessionExternalId: string,
  action: 'enroll' | 'waitlist' | 'promote' | 'cancel',
  actorName: string,
  actorRole: UserRole,
  athleteName?: string
): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(studioSessions)
      .where(and(eq(studioSessions.userId, userId), eq(studioSessions.externalId, sessionExternalId)));
    const s = rows[0];
    if (!s) throw new Error(`Session ${sessionExternalId} not found.`);

    let msg = '';
    if (action === 'enroll') {
      if (s.enrolled >= s.capacity) {
        throw new Error(`${s.title} is already at capacity.`);
      }
      const nextBookings = [...s.bookings, athleteName || 'Walk-In Athlete'];
      await db
        .update(studioSessions)
        .set({ enrolled: s.enrolled + 1, bookings: nextBookings })
        .where(eq(studioSessions.id, s.id));
      msg = `Booked spot in ${s.title}`;
      await appendAuditDb(userId, actorName, actorRole, 'Schedule', 'Booked athlete into class', s.title);
    } else if (action === 'waitlist') {
      const nextName = athleteName || `Athlete #${s.waitlist.length + 1}`;
      await db
        .update(studioSessions)
        .set({ waitlist: [...s.waitlist, nextName] })
        .where(eq(studioSessions.id, s.id));
      msg = `Added ${nextName} to waitlist for ${s.title}`;
      await appendAuditDb(userId, actorName, actorRole, 'Schedule', 'Added athlete to waitlist', s.title);
    } else if (action === 'promote') {
      if (s.waitlist.length === 0) {
        throw new Error(`No waitlist entries for ${s.title}.`);
      }
      const [promoted, ...rest] = s.waitlist;
      await db
        .update(studioSessions)
        .set({
          waitlist: rest,
          bookings: [...s.bookings, promoted],
          enrolled: Math.min(s.capacity, s.enrolled + 1),
        })
        .where(eq(studioSessions.id, s.id));
      msg = `Promoted ${promoted} into ${s.title}`;
      await appendAuditDb(userId, actorName, actorRole, 'Schedule', `Promoted ${promoted} from waitlist`, s.title);
      await createNotificationDb(userId, {
        category: 'waitlist_opening',
        channel: 'both',
        severity: 'info',
        recipientName: promoted,
        recipientEmail: 'athlete@kinetix.club',
        title: `Waitlist Spot Confirmed: ${s.title}`,
        message: `${promoted} has been promoted from the waitlist into ${s.title} (${s.startTime} · ${s.room}).`,
        targetScreen: 'schedule',
        ruleKey: `waitlist-promoted:${s.externalId}:${promoted}:${Date.now()}`,
      });
    } else if (action === 'cancel') {
      await db.update(studioSessions).set({ status: 'Cancelled' }).where(eq(studioSessions.id, s.id));
      msg = `Cancelled ${s.title}`;
      await appendAuditDb(userId, actorName, actorRole, 'Schedule', 'Cancelled studio session', s.title);
      await createNotificationDb(userId, {
        category: 'upcoming_booking',
        channel: 'both',
        severity: 'warning',
        recipientName: `${s.bookings.length} Booked Athletes`,
        recipientEmail: 'members@kinetix.club',
        title: `Session Cancelled: ${s.title}`,
        message: `${s.title} at ${s.startTime} with ${s.coach} was cancelled. Automatic booking alert sent to roster.`,
        targetScreen: 'schedule',
        ruleKey: `session-cancelled:${s.externalId}:${Date.now()}`,
      });
    }

    return msg;
  } catch (error) {
    console.error('Database query failed in performSessionActionDb:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update session.', { cause: error });
  }
}

export async function createStaffDb(
  userId: number,
  stf: StaffMember,
  actorName: string,
  actorRole: UserRole
): Promise<StaffMember> {
  try {
    await db.insert(staff).values({
      userId,
      externalId: stf.id,
      name: stf.name,
      role: stf.role,
      specialty: stf.specialty,
      email: stf.email,
      avatarUrl: stf.avatarUrl ?? null,
      initials: stf.initials,
      availability: stf.availability,
      status: stf.status,
      sessionsThisMonth: stf.sessionsThisMonth,
      retentionRate: stf.retentionRate,
      conversionRate: stf.conversionRate,
    });
    await appendAuditDb(userId, actorName, actorRole, 'System', 'Added staff member', `${stf.name} (${stf.role})`);
    return stf;
  } catch (error) {
    console.error('Database query failed in createStaffDb:', error);
    throw new Error('Failed to create staff member.', { cause: error });
  }
}

export async function evaluateAutomatedNotificationsDb(
  userId: number,
  actorName: string,
  actorRole: UserRole
): Promise<{ created: GymNotification[]; evaluatedCount: number }> {
  try {
    const [memberRows, leadRows, sessionRows, equipRows, zoneRows, cfgRows, existingNotifs] =
      await Promise.all([
        db.select().from(members).where(eq(members.userId, userId)),
        db.select().from(leads).where(eq(leads.userId, userId)),
        db.select().from(studioSessions).where(eq(studioSessions.userId, userId)),
        db.select().from(equipment).where(eq(equipment.userId, userId)),
        db.select().from(zones).where(eq(zones.userId, userId)),
        db.select().from(gymConfigs).where(eq(gymConfigs.userId, userId)),
        db.select().from(notifications).where(eq(notifications.userId, userId)),
      ]);

    const existingRuleKeys = new Set(existingNotifs.map((n) => n.ruleKey));
    const thresholdPct = cfgRows[0]?.maxOccupancyThresholdPct ?? 85;
    const today = new Date();
    const todayIso = todayIsoDate();
    const created: GymNotification[] = [];

    // 1. Expiring memberships (endDate within 35 days) & Past Due
    for (const m of memberRows) {
      const endMs = Date.parse(m.subscription.endDate);
      const daysUntilEnd = Number.isNaN(endMs)
        ? 999
        : Math.ceil((endMs - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilEnd <= 35 || m.subscription.paymentStatus === 'Past Due') {
        const ruleKey = `expiring:${m.externalId}`;
        if (!existingRuleKeys.has(ruleKey)) {
          const n = await createNotificationDb(userId, {
            category: 'expiring_membership',
            channel: 'both',
            severity: m.subscription.paymentStatus === 'Past Due' ? 'critical' : 'warning',
            recipientName: m.name,
            recipientEmail: m.email,
            title:
              m.subscription.paymentStatus === 'Past Due'
                ? `Past-Due Renewal Reminder: ${m.name}`
                : `Membership Expiring Soon: ${m.name}`,
            message: `${m.tier} ($${m.monthlyRate}/mo) ${
              m.subscription.paymentStatus === 'Past Due'
                ? 'has a past-due balance.'
                : `expires on ${m.subscription.endDate}.`
            } Reminder queued for ${m.email}.`,
            targetScreen: 'billing',
            ruleKey,
          });
          created.push(n);
          existingRuleKeys.add(ruleKey);
        }
      }
    }

    // 2. Upcoming class bookings & Waitlist openings
    for (const s of sessionRows) {
      if (s.status === 'Cancelled') continue;
      if (s.bookings.length > 0) {
        const ruleKey = `upcoming-booking:${s.externalId}`;
        if (!existingRuleKeys.has(ruleKey)) {
          const n = await createNotificationDb(userId, {
            category: 'upcoming_booking',
            channel: 'email',
            severity: 'info',
            recipientName: `${s.bookings.length} Booked Athletes`,
            recipientEmail: 'roster@kinetix.club',
            title: `Upcoming Booking Reminder: ${s.title}`,
            message: `Reminder dispatched for ${s.title} (${s.startTime} · ${s.room}) coached by ${s.coach}.`,
            targetScreen: 'schedule',
            ruleKey,
          });
          created.push(n);
          existingRuleKeys.add(ruleKey);
        }
      }

      if (s.waitlist.length > 0 && s.enrolled < s.capacity) {
        const ruleKey = `waitlist-opening:${s.externalId}:${s.enrolled}`;
        if (!existingRuleKeys.has(ruleKey)) {
          const n = await createNotificationDb(userId, {
            category: 'waitlist_opening',
            channel: 'both',
            severity: 'info',
            recipientName: s.waitlist[0],
            recipientEmail: 'waitlist@kinetix.club',
            title: `Waitlist Spot Opened: ${s.title}`,
            message: `Open seat detected in ${s.title} (${s.enrolled}/${s.capacity}). ${s.waitlist[0]} is next in queue for promotion.`,
            targetScreen: 'schedule',
            ruleKey,
          });
          created.push(n);
          existingRuleKeys.add(ruleKey);
        }
      }
    }

    // 3. Overdue lead follow-ups
    for (const l of leadRows) {
      if (l.stage === 'Converted' || l.stage === 'Lost') continue;
      if (l.followUpDate <= todayIso) {
        const ruleKey = `overdue-followup:${l.externalId}:${l.followUpDate}`;
        if (!existingRuleKeys.has(ruleKey)) {
          const n = await createNotificationDb(userId, {
            category: 'overdue_followup',
            channel: 'in_app',
            severity: 'warning',
            recipientName: 'Sales Desk',
            recipientEmail: 'liam.carter@kinetix.club',
            title: `Follow-Up Due: ${l.name}`,
            message: `${l.stage} prospect ${l.name} (${l.source}) had follow-up scheduled for ${l.followUpDate}.`,
            targetScreen: 'leads',
            ruleKey,
          });
          created.push(n);
          existingRuleKeys.add(ruleKey);
        }
      }
    }

    // 4. Operational alerts (Maintenance equipment or high zone occupancy)
    for (const e of equipRows) {
      if (e.status === 'Maintenance') {
        const ruleKey = `equip:${e.externalId}`;
        if (!existingRuleKeys.has(ruleKey)) {
          const n = await createNotificationDb(userId, {
            category: 'operational_alert',
            channel: 'in_app',
            severity: 'warning',
            recipientName: 'Facility Operations',
            recipientEmail: 'ops@kinetix.club',
            title: `Maintenance Alert: ${e.name}`,
            message: `${e.name} in ${e.bay} is offline for maintenance.`,
            targetScreen: 'floor',
            ruleKey,
          });
          created.push(n);
          existingRuleKeys.add(ruleKey);
        }
      }
    }

    for (const z of zoneRows) {
      const pct = Math.round((z.occupancy / Math.max(1, z.capacity)) * 100);
      if (pct >= thresholdPct) {
        const ruleKey = `zone-cap:${z.facilityId}:${z.zoneKey}:${pct}`;
        if (!existingRuleKeys.has(ruleKey)) {
          const n = await createNotificationDb(userId, {
            category: 'operational_alert',
            channel: 'in_app',
            severity: 'warning',
            recipientName: z.activeCoach,
            recipientEmail: 'ops@kinetix.club',
            title: `High Occupancy (${pct}%): ${z.shortName} (${z.facilityId.toUpperCase()})`,
            message: `${z.name} reached ${z.occupancy}/${z.capacity} athletes (threshold ${thresholdPct}%).`,
            targetScreen: 'floor',
            ruleKey,
          });
          created.push(n);
          existingRuleKeys.add(ruleKey);
        }
      }
    }

    if (created.length > 0) {
      await appendAuditDb(
        userId,
        actorName,
        actorRole,
        'System',
        `Evaluated automated communication rules`,
        `${created.length} new reminder(s) queued`
      );
    }

    return { created, evaluatedCount: created.length };
  } catch (error) {
    console.error('Database query failed in evaluateAutomatedNotificationsDb:', error);
    throw new Error('Failed to evaluate notification rules.', { cause: error });
  }
}

export async function updateNotificationStatusDb(
  userId: number,
  externalId: string,
  status: 'unread' | 'read' | 'sent'
): Promise<void> {
  try {
    if (externalId === 'all') {
      await db
        .update(notifications)
        .set({ status: 'read' })
        .where(eq(notifications.userId, userId));
      return;
    }
    await db
      .update(notifications)
      .set({ status })
      .where(and(eq(notifications.userId, userId), eq(notifications.externalId, externalId)));
  } catch (error) {
    console.error('Database query failed in updateNotificationStatusDb:', error);
    throw new Error('Failed to update notification status.', { cause: error });
  }
}

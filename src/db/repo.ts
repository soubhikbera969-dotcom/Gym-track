import {
  adjustZoneOccupancyDb as pgAdjustZoneOccupancy,
  appendAuditDb as pgAppendAudit,
  convertLeadDb as pgConvertLead,
  createLeadDb as pgCreateLead,
  createMemberDb as pgCreateMember,
  createNotificationDb as pgCreateNotification,
  createPlanDb as pgCreatePlan,
  createSessionDb as pgCreateSession,
  createStaffDb as pgCreateStaff,
  cycleEquipmentStatusDb as pgCycleEquipmentStatus,
  evaluateAutomatedNotificationsDb as pgEvaluateNotifications,
  importMembersDb as pgImportMembers,
  loadWorkspaceData as pgLoadWorkspaceData,
  performSessionActionDb as pgPerformSessionAction,
  performSubscriptionActionDb as pgPerformSubscriptionAction,
  recordCheckInDb as pgRecordCheckIn,
  updateConfigDb as pgUpdateConfig,
  updateLeadDb as pgUpdateLead,
  updateMemberDb as pgUpdateMember,
  updateNotificationStatusDb as pgUpdateNotificationStatus,
  type WorkspacePayload,
} from './crmRepo.ts';
import {
  adjustZoneOccupancyOffline,
  appendAuditOffline,
  convertLeadOffline,
  createLeadOffline,
  createMemberOffline,
  createNotificationOffline,
  createPlanOffline,
  createSessionOffline,
  createStaffOffline,
  cycleEquipmentStatusOffline,
  evaluateAutomatedNotificationsOffline,
  importMembersOffline,
  loadWorkspaceOffline,
  performSessionActionOffline,
  performSubscriptionActionOffline,
  recordCheckInOffline,
  updateConfigOffline,
  updateLeadOffline,
  updateMemberOffline,
  updateNotificationStatusOffline,
} from './offlineStore.ts';
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

export type { WorkspacePayload };

export function isOfflineStorageActive(): boolean {
  return process.env.LOCAL_OFFLINE === 'true' && !process.env.SQL_HOST;
}

export async function appendAuditDb(
  userId: number,
  actor: string,
  role: UserRole,
  category: AuditEntry['category'],
  action: string,
  target: string
): Promise<AuditEntry> {
  if (isOfflineStorageActive()) {
    return appendAuditOffline(userId, actor, role, category, action, target);
  }
  return pgAppendAudit(userId, actor, role, category, action, target);
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
  if (isOfflineStorageActive()) {
    return createNotificationOffline(userId, input);
  }
  return pgCreateNotification(userId, input);
}

export async function loadWorkspaceData(userId: number): Promise<WorkspacePayload> {
  if (isOfflineStorageActive()) {
    return loadWorkspaceOffline(userId);
  }
  return pgLoadWorkspaceData(userId);
}

export async function updateConfigDb(
  userId: number,
  patch: Partial<GymConfig> & { activeRole?: UserRole; activeFacilityId?: string },
  actorName: string
): Promise<void> {
  if (isOfflineStorageActive()) {
    return updateConfigOffline(userId, patch, actorName);
  }
  return pgUpdateConfig(userId, patch, actorName);
}

export async function recordCheckInDb(
  userId: number,
  memberId: string,
  zoneId: ZoneId,
  facilityId: string,
  actorName: string,
  actorRole: UserRole
): Promise<CheckInLog> {
  if (isOfflineStorageActive()) {
    return recordCheckInOffline(userId, memberId, zoneId, facilityId, actorName, actorRole);
  }
  return pgRecordCheckIn(userId, memberId, zoneId, facilityId, actorName, actorRole);
}

export async function adjustZoneOccupancyDb(
  userId: number,
  facilityId: string,
  zoneKey: ZoneId,
  delta: number
): Promise<GymZone> {
  if (isOfflineStorageActive()) {
    return adjustZoneOccupancyOffline(userId, facilityId, zoneKey, delta);
  }
  return pgAdjustZoneOccupancy(userId, facilityId, zoneKey, delta);
}

export async function cycleEquipmentStatusDb(
  userId: number,
  externalId: string,
  actorName: string,
  actorRole: UserRole,
  explicitStatus?: EquipmentStatus
): Promise<EquipmentItem> {
  if (isOfflineStorageActive()) {
    return cycleEquipmentStatusOffline(userId, externalId, actorName, actorRole, explicitStatus);
  }
  return pgCycleEquipmentStatus(userId, externalId, actorName, actorRole, explicitStatus);
}

export async function createMemberDb(
  userId: number,
  member: Member,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  if (isOfflineStorageActive()) {
    return createMemberOffline(userId, member, actorName, actorRole);
  }
  return pgCreateMember(userId, member, actorName, actorRole);
}

export async function updateMemberDb(
  userId: number,
  updated: Member,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  if (isOfflineStorageActive()) {
    return updateMemberOffline(userId, updated, auditSummary, actorName, actorRole);
  }
  return pgUpdateMember(userId, updated, auditSummary, actorName, actorRole);
}

export async function importMembersDb(
  userId: number,
  imported: Member[],
  facilityName: string,
  actorName: string,
  actorRole: UserRole
): Promise<void> {
  if (isOfflineStorageActive()) {
    return importMembersOffline(userId, imported, facilityName, actorName, actorRole);
  }
  return pgImportMembers(userId, imported, facilityName, actorName, actorRole);
}

export async function createLeadDb(
  userId: number,
  lead: Lead,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  if (isOfflineStorageActive()) {
    return createLeadOffline(userId, lead, actorName, actorRole);
  }
  return pgCreateLead(userId, lead, actorName, actorRole);
}

export async function updateLeadDb(
  userId: number,
  updated: Lead,
  auditSummary: string,
  actorName: string,
  actorRole: UserRole
): Promise<Lead> {
  if (isOfflineStorageActive()) {
    return updateLeadOffline(userId, updated, auditSummary, actorName, actorRole);
  }
  return pgUpdateLead(userId, updated, auditSummary, actorName, actorRole);
}

export async function convertLeadDb(
  userId: number,
  leadExternalId: string,
  actorName: string,
  actorRole: UserRole
): Promise<Member> {
  if (isOfflineStorageActive()) {
    return convertLeadOffline(userId, leadExternalId, actorName, actorRole);
  }
  return pgConvertLead(userId, leadExternalId, actorName, actorRole);
}

export async function createPlanDb(
  userId: number,
  plan: MembershipPlan,
  actorName: string,
  actorRole: UserRole
): Promise<MembershipPlan> {
  if (isOfflineStorageActive()) {
    return createPlanOffline(userId, plan, actorName, actorRole);
  }
  return pgCreatePlan(userId, plan, actorName, actorRole);
}

export async function performSubscriptionActionDb(
  userId: number,
  memberExternalId: string,
  action: 'renew' | 'freeze' | 'cancel' | 'retry',
  actorName: string,
  actorRole: UserRole
): Promise<string> {
  if (isOfflineStorageActive()) {
    return performSubscriptionActionOffline(userId, memberExternalId, action, actorName, actorRole);
  }
  return pgPerformSubscriptionAction(userId, memberExternalId, action, actorName, actorRole);
}

export async function createSessionDb(
  userId: number,
  session: StudioSession,
  actorName: string,
  actorRole: UserRole
): Promise<StudioSession> {
  if (isOfflineStorageActive()) {
    return createSessionOffline(userId, session, actorName, actorRole);
  }
  return pgCreateSession(userId, session, actorName, actorRole);
}

export async function performSessionActionDb(
  userId: number,
  sessionExternalId: string,
  action: 'enroll' | 'waitlist' | 'promote' | 'cancel',
  actorName: string,
  actorRole: UserRole,
  athleteName?: string
): Promise<string> {
  if (isOfflineStorageActive()) {
    return performSessionActionOffline(
      userId,
      sessionExternalId,
      action,
      actorName,
      actorRole,
      athleteName
    );
  }
  return pgPerformSessionAction(
    userId,
    sessionExternalId,
    action,
    actorName,
    actorRole,
    athleteName
  );
}

export async function createStaffDb(
  userId: number,
  member: StaffMember,
  actorName: string,
  actorRole: UserRole
): Promise<StaffMember> {
  if (isOfflineStorageActive()) {
    return createStaffOffline(userId, member, actorName, actorRole);
  }
  return pgCreateStaff(userId, member, actorName, actorRole);
}

export async function evaluateAutomatedNotificationsDb(
  userId: number,
  actorName: string,
  actorRole: UserRole
): Promise<{ created: GymNotification[]; evaluatedCount: number }> {
  if (isOfflineStorageActive()) {
    return evaluateAutomatedNotificationsOffline(userId, actorName, actorRole);
  }
  return pgEvaluateNotifications(userId, actorName, actorRole);
}

export async function updateNotificationStatusDb(
  userId: number,
  externalId: string,
  status: 'unread' | 'read' | 'sent'
): Promise<void> {
  if (isOfflineStorageActive()) {
    return updateNotificationStatusOffline(userId, externalId, status);
  }
  return pgUpdateNotificationStatus(userId, externalId, status);
}

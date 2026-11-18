import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  Bell,
  Box,
  Calendar,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  Target,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  COACH_AVATAR,
  FACILITIES,
  INITIAL_ALERTS,
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
  resolveAvatarUrl,
} from './data/gymData';
import type {
  AgentChatMessage,
  AgentPersona,
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
  ReportDomain,
  ScreenView,
  StaffMember,
  StudioSession,
  TimeRange,
  TransactionRecord,
  UserRole,
  ZoneId,
} from './types/gym';
import { useAuth } from './contexts/AuthContext';
import { BillingScreen } from './components/BillingScreen';
import { FloorScreen } from './components/FloorScreen';
import { GeminiAgentDrawer } from './components/GeminiAgentDrawer';
import { LeadsScreen } from './components/LeadsScreen';
import { MemberAvatar } from './components/MemberAvatar';
import { MembersScreen } from './components/MembersScreen';
import {
  AddMemberModal,
  CheckInModal,
  ScheduleSessionModal,
} from './components/Modals';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { OverviewScreen } from './components/OverviewScreen';
import { ReportCenterScreen } from './components/ReportCenterScreen';
import { ScheduleAndStaffScreen } from './components/ScheduleAndStaffScreen';
import { SettingsAuditScreen } from './components/SettingsAuditScreen';
import { SignInGate } from './components/SignInGate';
import { buildSafeCsv } from './utils/csv';

interface WorkspaceResponse {
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

const NAV_GROUPS: {
  group: string;
  items: { id: ScreenView; label: string; icon: React.FC<{ className?: string }> }[];
}[] = [
  {
    group: 'Command',
    items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'floor', label: '3D Floor & Access', icon: Box },
    ],
  },
  {
    group: 'CRM & Revenue',
    items: [
      { id: 'members', label: 'Members & Profiles', icon: Users },
      { id: 'leads', label: 'Leads Pipeline', icon: Target },
      { id: 'billing', label: 'Plans & Billing', icon: CreditCard },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'schedule', label: 'Classes & Staff', icon: Calendar },
      { id: 'reports', label: 'Report Center', icon: BarChart3 },
      { id: 'settings', label: 'Settings & Audit', icon: Settings },
    ],
  },
];

export default function App() {
  const { user, loading: authLoading, logout, apiFetch } = useAuth();

  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const [activeScreen, setActiveScreen] = useState<ScreenView>('overview');
  const [activeRole, setActiveRole] = useState<UserRole>('Director');
  const [facilityId, setFacilityId] = useState<string>(FACILITIES[0].id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [zonesByFacility, setZonesByFacility] =
    useState<Record<string, GymZone[]>>(INITIAL_ZONES);
  const [selectedZone, setSelectedZone] = useState<ZoneId | 'all'>('all');
  const [chartRange, setChartRange] = useState<TimeRange>('7D');

  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [plans, setPlans] = useState<MembershipPlan[]>(INITIAL_PLANS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [checkIns, setCheckIns] = useState<CheckInLog[]>(INITIAL_CHECKINS);
  const [equipment, setEquipment] = useState<EquipmentItem[]>(INITIAL_EQUIPMENT);
  const [sessions, setSessions] = useState<StudioSession[]>(INITIAL_SESSIONS);
  const [notifications, setNotifications] = useState<GymNotification[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(INITIAL_AUDIT_LOG);
  const [config, setConfig] = useState<GymConfig>(INITIAL_CONFIG);

  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);
  const [agentSending, setAgentSending] = useState(false);
  const [agentPersona, setAgentPersona] = useState<AgentPersona>('Club Manager');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const applyWorkspace = useCallback((ws: WorkspaceResponse) => {
    if (!ws) return;
    setConfig(ws.config);
    setActiveRole(ws.activeRole);
    setFacilityId(ws.activeFacilityId);
    if (ws.zonesByFacility && Object.keys(ws.zonesByFacility).length > 0) {
      setZonesByFacility(ws.zonesByFacility);
    }
    setEquipment(ws.equipment);
    setStaff(
      ws.staff.map((s) => ({
        ...s,
        avatarUrl: resolveAvatarUrl(s.avatarUrl),
      }))
    );
    setMembers(
      ws.members.map((m) => ({
        ...m,
        avatarUrl: resolveAvatarUrl(m.avatarUrl),
      }))
    );
    setLeads(ws.leads);
    setPlans(ws.plans);
    setTransactions(ws.transactions);
    setCheckIns(
      ws.checkIns.map((c) => ({
        ...c,
        memberAvatar: resolveAvatarUrl(c.memberAvatar),
      }))
    );
    setSessions(
      ws.sessions.map((s) => ({
        ...s,
        coachAvatar: resolveAvatarUrl(s.coachAvatar),
      }))
    );
    setNotifications(ws.notifications || []);
    setAuditLog(ws.auditLog);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      const data = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/bootstrap');
      applyWorkspace(data.workspace);
    } catch (err) {
      setBootstrapError(
        err instanceof Error ? err.message : 'Unable to load workspace data.'
      );
    } finally {
      setBootstrapping(false);
    }
  }, [apiFetch, applyWorkspace]);

  useEffect(() => {
    if (user) {
      void loadWorkspace();
    } else {
      setAgentMessages([]);
      setActiveScreen('overview');
    }
  }, [user, loadWorkspace]);

  const facility = useMemo(
    () => FACILITIES.find((f) => f.id === facilityId) ?? FACILITIES[0],
    [facilityId]
  );

  const currentZones = zonesByFacility[facility.id] ?? INITIAL_ZONES.soho;

  const extraMembersCount = Math.max(0, members.length - INITIAL_MEMBERS.length);
  const activeMemberCount = facility.activeMembers + extraMembersCount;
  const extraMrr = members
    .slice(0, extraMembersCount)
    .reduce((acc, m) => acc + m.monthlyRate, 0);
  const mrrTotal = facility.mrr + extraMrr;
  const todayCheckIns =
    facility.checkInsToday + Math.max(0, checkIns.length - INITIAL_CHECKINS.length);
  const openLeadsCount = leads.filter(
    (l) => l.stage !== 'Converted' && l.stage !== 'Lost'
  ).length;
  const unreadNotificationCount = notifications.filter(
    (n) => n.status === 'unread'
  ).length;

  const handleChangeRole = async (role: UserRole) => {
    setActiveRole(role);
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/config', {
        method: 'PUT',
        body: JSON.stringify({ activeRole: role }),
      });
      applyWorkspace(res.workspace);
      showToast(`Switched workspace view to ${role}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to switch role');
    }
  };

  const handleChangeFacility = async (nextFacilityId: string) => {
    setFacilityId(nextFacilityId);
    setSelectedZone('all');
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/config', {
        method: 'PUT',
        body: JSON.stringify({ activeFacilityId: nextFacilityId }),
      });
      applyWorkspace(res.workspace);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to switch facility');
    }
  };

  const handleLogCheckIn = async (memberId: string, zoneId: ZoneId) => {
    const member = members.find((m) => m.id === memberId);
    const zone = currentZones.find((z) => z.id === zoneId);
    if (!member || !zone) return;

    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/check-in', {
        method: 'POST',
        body: JSON.stringify({
          memberId: member.id,
          zoneId,
          facilityId: facility.id,
          role: activeRole,
        }),
      });
      applyWorkspace(res.workspace);
      showToast(`${member.name} checked into ${zone.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  const handleQuickMemberCheckIn = (member: Member) => {
    void handleLogCheckIn(member.id, member.preferredZone);
  };

  const handleAdjustOccupancy = async (zoneId: ZoneId, delta: number) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>(
        `/api/crm/zones/${zoneId}/occupancy`,
        {
          method: 'PATCH',
          body: JSON.stringify({ facilityId: facility.id, delta }),
        }
      );
      applyWorkspace(res.workspace);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update occupancy');
    }
  };

  const handleCycleEquipmentStatus = async (equipmentId: string) => {
    const order: EquipmentStatus[] = ['Operational', 'In Use', 'Maintenance'];
    const current = equipment.find((e) => e.id === equipmentId);
    const next = current
      ? order[(order.indexOf(current.status) + 1) % order.length]
      : undefined;
    try {
      const res = await apiFetch<{ item: EquipmentItem; workspace: WorkspaceResponse }>(
        `/api/crm/equipment/${equipmentId}/cycle`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: activeRole, status: next }),
        }
      );
      applyWorkspace(res.workspace);
      showToast(`${res.item.name} set to ${res.item.status}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update equipment');
    }
  };

  const handleAddMember = async (member: Member) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/members', {
        method: 'POST',
        body: JSON.stringify({ member, role: activeRole }),
      });
      applyWorkspace(res.workspace);
      showToast(`${member.name} enrolled in ${member.tier}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to enroll member');
    }
  };

  const handleUpdateMember = async (updated: Member, auditSummary: string) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>(
        `/api/crm/members/${updated.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ member: updated, auditSummary, role: activeRole }),
        }
      );
      applyWorkspace(res.workspace);
      showToast(auditSummary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update member');
    }
  };

  const handleAddLead = async (lead: Lead) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/leads', {
        method: 'POST',
        body: JSON.stringify({ lead, role: activeRole }),
      });
      applyWorkspace(res.workspace);
      showToast(`Added prospect ${lead.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create prospect');
    }
  };

  const handleUpdateLead = async (updated: Lead, auditSummary: string) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>(
        `/api/crm/leads/${updated.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ lead: updated, auditSummary, role: activeRole }),
        }
      );
      applyWorkspace(res.workspace);
      showToast(auditSummary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update lead');
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>(
        `/api/crm/leads/${lead.id}/convert`,
        {
          method: 'POST',
          body: JSON.stringify({ role: activeRole }),
        }
      );
      applyWorkspace(res.workspace);
      showToast(`${lead.name} converted to active member`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to convert lead');
    }
  };

  const handleCreatePlan = async (plan: MembershipPlan) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/plans', {
        method: 'POST',
        body: JSON.stringify({ plan, role: activeRole }),
      });
      applyWorkspace(res.workspace);
      showToast(`Created plan ${plan.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create plan');
    }
  };

  const handleSubscriptionAction = async (
    memberId: string,
    action: 'renew' | 'freeze' | 'cancel' | 'retry'
  ) => {
    try {
      const res = await apiFetch<{ message: string; workspace: WorkspaceResponse }>(
        `/api/crm/members/${memberId}/subscription`,
        {
          method: 'POST',
          body: JSON.stringify({ action, role: activeRole }),
        }
      );
      applyWorkspace(res.workspace);
      showToast(res.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update subscription');
    }
  };

  const handleSessionAction = async (
    sessionId: string,
    action: 'enroll' | 'waitlist' | 'promote' | 'cancel'
  ) => {
    try {
      const res = await apiFetch<{ message: string; workspace: WorkspaceResponse }>(
        `/api/crm/sessions/${sessionId}/action`,
        {
          method: 'POST',
          body: JSON.stringify({ action, role: activeRole }),
        }
      );
      applyWorkspace(res.workspace);
      showToast(res.message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update session');
    }
  };

  const handleAddSession = async (session: StudioSession) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/sessions', {
        method: 'POST',
        body: JSON.stringify({ session, role: activeRole }),
      });
      applyWorkspace(res.workspace);
      showToast(`Scheduled ${session.title} at ${session.startTime}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to schedule session');
    }
  };

  const handleAddStaff = async (stf: StaffMember) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/staff', {
        method: 'POST',
        body: JSON.stringify({ staffMember: stf, role: activeRole }),
      });
      applyWorkspace(res.workspace);
      showToast(`Added ${stf.name} to staff roster`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add staff member');
    }
  };

  const handleSaveConfig = async (next: GymConfig) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/config', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      applyWorkspace(res.workspace);
      showToast('Facility configuration saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  };

  const handleImportMembers = async (imported: Member[]) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/members/import', {
        method: 'POST',
        body: JSON.stringify({
          members: imported,
          facilityName: facility.name,
          role: activeRole,
        }),
      });
      applyWorkspace(res.workspace);
      showToast(`Imported ${imported.length} member(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import members');
    }
  };

  const recordAudit = async (
    category: AuditEntry['category'],
    action: string,
    target: string
  ) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/crm/audit', {
        method: 'POST',
        body: JSON.stringify({ category, action, target, role: activeRole }),
      });
      applyWorkspace(res.workspace);
    } catch {
      // Non-blocking audit sync
    }
  };

  const handleExportMembersCsv = () => {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Tier', 'MonthlyRate', 'Status', 'CheckIns30d'];
    const rows = members.map((m) => [
      m.id,
      m.name,
      m.email,
      m.phone,
      m.tier,
      m.monthlyRate,
      m.status,
      m.checkIns30d,
    ]);
    const csv = buildSafeCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kinetix-members-ledger.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    void recordAudit('Member', 'Exported members CSV', `${members.length} records`);
    showToast('Exported members CSV');
  };

  const handleExportLeadsCsv = () => {
    const headers = ['ID', 'Name', 'Email', 'Source', 'Stage', 'TrialStatus', 'FollowUp'];
    const rows = leads.map((l) => [
      l.id,
      l.name,
      l.email,
      l.source,
      l.stage,
      l.trialStatus,
      l.followUpDate,
    ]);
    const csv = buildSafeCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kinetix-leads-pipeline.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    void recordAudit('Lead', 'Exported leads CSV', `${leads.length} records`);
    showToast('Exported leads CSV');
  };

  const handleEvaluateRules = async () => {
    try {
      const res = await apiFetch<{ evaluatedCount: number; workspace: WorkspaceResponse }>(
        '/api/notifications/evaluate',
        {
          method: 'POST',
          body: JSON.stringify({ role: activeRole }),
        }
      );
      applyWorkspace(res.workspace);
      showToast(
        res.evaluatedCount > 0
          ? `Queued ${res.evaluatedCount} new automated reminder(s)`
          : 'All automated communication rules are up to date'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to evaluate rules');
    }
  };

  const handleSendNotification = async (payload: {
    category: NotificationCategory;
    channel: NotificationChannel;
    severity: 'info' | 'warning' | 'critical';
    recipientName: string;
    recipientEmail: string;
    title: string;
    message: string;
    targetScreen: ScreenView;
  }) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>('/api/notifications/send', {
        method: 'POST',
        body: JSON.stringify({ ...payload, role: activeRole }),
      });
      applyWorkspace(res.workspace);
      showToast(`Sent reminder to ${payload.recipientName}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send notification');
    }
  };

  const handleMarkNotificationStatus = async (
    id: string,
    status: 'read' | 'unread' | 'sent'
  ) => {
    try {
      const res = await apiFetch<{ workspace: WorkspaceResponse }>(
        `/api/notifications/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );
      applyWorkspace(res.workspace);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update notification');
    }
  };

  const handleSendAgentMessage = async (text: string): Promise<string | null> => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: AgentChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text,
      timestamp: timeStr,
    };
    const nextHistory = agentMessages
      .filter((m) => !m.id.endsWith('-e') && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    setAgentMessages((prev) => [...prev, userMsg]);
    setAgentSending(true);

    try {
      const res = await apiFetch<{
        reply: string;
        toolActions?: AgentChatMessage['toolActions'];
        didMutate?: boolean;
        workspace?: WorkspaceResponse;
      }>('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: nextHistory,
          activeRole,
          activeFacilityId: facility.id,
          persona: agentPersona,
        }),
      });

      if (res.workspace) {
        applyWorkspace(res.workspace);
      }

      const assistantMsg: AgentChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolActions: res.toolActions,
      };
      setAgentMessages((prev) => [...prev, assistantMsg]);
      return res.reply;
    } catch (err) {
      const errMsg: AgentChatMessage = {
        id: `msg-${Date.now()}-e`,
        role: 'assistant',
        content:
          err instanceof Error
            ? `Sorry, I ran into an issue: ${err.message}`
            : 'Sorry, I could not complete that right now.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setAgentMessages((prev) => [...prev, errMsg]);
      return null;
    } finally {
      setAgentSending(false);
    }
  };

  const handleTranscribeAudio = async (
    audioBase64: string,
    mimeType: string
  ): Promise<string> => {
    const res = await apiFetch<{ transcript: string }>('/api/agent/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    return res.transcript || '';
  };

  const handleSpeakText = async (
    text: string
  ): Promise<{ audioBase64: string; mimeType: string; useBrowserVoice?: boolean }> => {
    return apiFetch<{ audioBase64: string; mimeType: string; useBrowserVoice?: boolean }>(
      '/api/agent/speak',
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    );
  };

  const globalResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return { members: [], leads: [], sessions: [] };
    return {
      members: members
        .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
        .slice(0, 4),
      leads: leads.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 3),
      sessions: sessions.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 3),
    };
  }, [globalQuery, members, leads, sessions]);

  const screenTitleMap: Record<ScreenView, string> = {
    overview: 'Dashboard',
    floor: '3D Floor & Access',
    members: 'Members & Profiles',
    leads: 'Leads Pipeline',
    billing: 'Plans & Billing',
    schedule: 'Classes & Staff',
    reports: 'Report Center',
    settings: 'Settings & Audit',
  };

  if (authLoading) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-sm font-semibold text-[#64748B]"
          >
            Loading Kinetix...
          </motion.div>
        </div>
      </MotionConfig>
    );
  }

  if (!user) {
    return (
      <MotionConfig reducedMotion="user">
        <SignInGate />
      </MotionConfig>
    );
  }

  const operatorName =
    user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Club Operator';
  const operatorInitials = operatorName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Persistent Desktop Utility Sidebar (260px) */}
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col border-r border-[#E2E8F0] bg-white sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center gap-2.5 border-b border-[#E2E8F0]">
          <div className="h-8 w-8 rounded-lg bg-[#059669] text-white flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold tracking-[-0.02em] text-[#0F172A] whitespace-nowrap">
            Kinetix
          </span>
        </div>

        <div className="px-4 py-4 flex-1 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group}>
              <div className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                {grp.group}
              </div>
              <nav className="space-y-0.5" aria-label={grp.group}>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveScreen(item.id)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#ECFDF5] text-[#047857]'
                          : 'text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? 'text-[#059669]' : 'text-[#64748B]'
                        }`}
                      />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}

          <div className="pt-2 border-t border-[#F1F5F9]">
            <label
              htmlFor="sidebar-facility"
              className="block px-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]"
            >
              Active Facility
            </label>
            <div className="px-1">
              <select
                id="sidebar-facility"
                value={facilityId}
                onChange={(e) => void handleChangeFacility(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#059669] cursor-pointer"
              >
                {FACILITIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 px-2 text-[11px] text-[#64748B] truncate">
                {facility.neighborhood}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <MemberAvatar
              name={operatorName}
              initials={operatorInitials || 'DB'}
              src={user.photoURL || COACH_AVATAR}
              size="md"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#0F172A] truncate">
                {operatorName}
              </div>
              <div className="text-[11px] text-[#059669] font-semibold truncate">
                {activeRole}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            title="Switch profile or sign out"
            aria-label="Switch profile or sign out"
            className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] cursor-pointer shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex lg:hidden bg-[#0F172A]/30"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.aside
              initial={{ x: -24, opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-68 bg-white h-full border-r border-[#E2E8F0] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="h-16 px-5 flex items-center justify-between border-b border-[#E2E8F0]">
              <span className="font-display text-lg font-bold text-[#0F172A]">Kinetix</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-4 space-y-4 flex-1 overflow-y-auto">
              {NAV_GROUPS.map((grp) => (
                <div key={grp.group} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    {grp.group}
                  </div>
                  {grp.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeScreen === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveScreen(item.id);
                          setMobileNavOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                          active ? 'bg-[#ECFDF5] text-[#047857]' : 'text-[#334155]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="p-4 border-t border-[#E2E8F0] space-y-2">
              <select
                value={facilityId}
                onChange={(e) => void handleChangeFacility(e.target.value)}
                aria-label="Select facility"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A]"
              >
                {FACILITIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] py-2 text-xs font-semibold text-[#334155]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Switch Profile / Sign Out
              </button>
            </div>
          </motion.aside>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumbs on left, Search + Communications + AI Agent + Primary CTA on right */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg p-2 text-[#334155] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="font-medium text-[#64748B] hidden sm:inline whitespace-nowrap">
                {facility.name}
              </span>
              <span className="text-[#CBD5E1] hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display text-base sm:text-lg font-semibold text-[#0F172A] truncate">
                {screenTitleMap[activeScreen]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] cursor-pointer whitespace-nowrap"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Search CRM...</span>
            </button>

            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Open notifications and automated reminders"
              className="relative inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap"
            >
              <Bell className="h-3.5 w-3.5 text-[#059669]" />
              <span className="hidden sm:inline">Reminders</span>
              {unreadNotificationCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#059669] px-1 text-[10px] font-bold text-white tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAgentOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1E293B] cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#84CC16]" />
              <span className="hidden sm:inline">Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => setCheckInModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#047857] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Check In Member</span>
            </button>
          </div>
        </header>

        {/* Localized error recovery banner without hiding the workspace */}
        {bootstrapError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#B91C1C]">
              {bootstrapError}
            </span>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="rounded-lg bg-white border border-[#FECACA] px-3 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Pinned 1600px Max-Width Content Canvas */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {bootstrapping ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center text-sm text-[#64748B]">
              Syncing workspace records...
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeScreen}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeScreen === 'overview' && (
                <OverviewScreen
                  activeRole={activeRole}
                  onChangeRole={(r) => void handleChangeRole(r)}
                  facility={facility}
                  zones={currentZones}
                  selectedZone={selectedZone}
                  onSelectZone={setSelectedZone}
                  chartRange={chartRange}
                  onChartRangeChange={setChartRange}
                  recentCheckIns={checkIns}
                  alerts={INITIAL_ALERTS}
                  recentAudit={auditLog}
                  activeMemberCount={activeMemberCount}
                  mrrTotal={mrrTotal}
                  todayCheckIns={todayCheckIns}
                  openLeadsCount={openLeadsCount}
                  onNavigate={setActiveScreen}
                  onOpenCheckInModal={() => setCheckInModalOpen(true)}
                  onOpenAddMember={() => setAddMemberModalOpen(true)}
                  onOpenScheduleModal={() => setScheduleModalOpen(true)}
                />
              )}

              {activeScreen === 'floor' && (
                <FloorScreen
                  facilityName={facility.name}
                  zones={currentZones}
                  selectedZone={selectedZone}
                  onSelectZone={setSelectedZone}
                  onAdjustOccupancy={(z, d) => void handleAdjustOccupancy(z, d)}
                  equipment={equipment}
                  onCycleEquipmentStatus={(id) => void handleCycleEquipmentStatus(id)}
                  checkIns={checkIns}
                  onOpenCheckInModal={() => setCheckInModalOpen(true)}
                />
              )}

              {activeScreen === 'members' && (
                <MembersScreen
                  members={members}
                  staff={staff}
                  onOpenAddMember={() => setAddMemberModalOpen(true)}
                  onCheckInMember={handleQuickMemberCheckIn}
                  onUpdateMember={(m, sum) => void handleUpdateMember(m, sum)}
                  onExportCsv={handleExportMembersCsv}
                />
              )}

              {activeScreen === 'leads' && (
                <LeadsScreen
                  leads={leads}
                  staff={staff}
                  facilityId={facility.id}
                  onAddLead={(l) => void handleAddLead(l)}
                  onUpdateLead={(l, sum) => void handleUpdateLead(l, sum)}
                  onConvertLead={(l) => void handleConvertLead(l)}
                />
              )}

              {activeScreen === 'billing' && (
                <BillingScreen
                  plans={plans}
                  members={members}
                  transactions={transactions}
                  onCreatePlan={(p) => void handleCreatePlan(p)}
                  onSubscriptionAction={(id, act) => void handleSubscriptionAction(id, act)}
                />
              )}

              {activeScreen === 'schedule' && (
                <ScheduleAndStaffScreen
                  sessions={sessions}
                  staff={staff}
                  members={members}
                  onEnrollSession={(id) => void handleSessionAction(id, 'enroll')}
                  onAddWaitlist={(id) => void handleSessionAction(id, 'waitlist')}
                  onPromoteWaitlist={(id) => void handleSessionAction(id, 'promote')}
                  onCancelSession={(id) => void handleSessionAction(id, 'cancel')}
                  onOpenScheduleModal={() => setScheduleModalOpen(true)}
                  onAddStaff={(s) => void handleAddStaff(s)}
                />
              )}

              {activeScreen === 'reports' && (
                <ReportCenterScreen
                  facilityName={facility.name}
                  onAuditExport={(domain: ReportDomain) => {
                    void recordAudit('System', 'Exported report summary CSV', domain);
                    showToast(`Exported ${domain} report summary`);
                  }}
                />
              )}

              {activeScreen === 'settings' && (
                <SettingsAuditScreen
                  config={config}
                  onSaveConfig={(c) => void handleSaveConfig(c)}
                  activeRole={activeRole}
                  onChangeRole={(r) => void handleChangeRole(r)}
                  auditLog={auditLog}
                  members={members}
                  leads={leads}
                  facilityId={facility.id}
                  onImportMembers={(imp) => void handleImportMembers(imp)}
                  onExportMembersCsv={handleExportMembersCsv}
                  onExportLeadsCsv={handleExportLeadsCsv}
                />
              )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      <AnimatePresence>
        {globalSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-[#0F172A]/35 pt-20 p-4"
            onClick={() => setGlobalSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.985 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="modal-elevated w-full max-w-lg rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0]">
              <Search className="h-4 w-4 text-[#64748B]" />
              <input
                type="text"
                autoFocus
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search members, prospects, or studio classes..."
                className="flex-1 text-sm text-[#0F172A] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(false)}
                className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#F1F5F9]">
              {!globalQuery.trim() ? (
                <div className="p-6 text-center text-xs text-[#64748B]">
                  Type a name, email, or class title to jump directly to a CRM record.
                </div>
              ) : (
                <>
                  {globalResults.members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setActiveScreen('members');
                        setGlobalSearchOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#0F172A]">{m.name}</div>
                        <div className="text-xs text-[#64748B]">Member · {m.tier}</div>
                      </div>
                      <span className="text-xs font-semibold text-[#059669]">Open Members</span>
                    </button>
                  ))}
                  {globalResults.leads.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setActiveScreen('leads');
                        setGlobalSearchOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#0F172A]">{l.name}</div>
                        <div className="text-xs text-[#64748B]">Prospect · {l.stage}</div>
                      </div>
                      <span className="text-xs font-semibold text-[#2563EB]">Open Pipeline</span>
                    </button>
                  ))}
                  {globalResults.sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setActiveScreen('schedule');
                        setGlobalSearchOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#0F172A]">{s.title}</div>
                        <div className="text-xs text-[#64748B]">Class · {s.startTime}</div>
                      </div>
                      <span className="text-xs font-semibold text-[#334155]">Open Schedule</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Automated Gym Communications Drawer */}
      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        members={members}
        leads={leads}
        onEvaluateRules={handleEvaluateRules}
        onSendNotification={handleSendNotification}
        onMarkStatus={handleMarkNotificationStatus}
        onNavigate={setActiveScreen}
      />

      {/* Gemini AI Operations Agent Drawer */}
      <GeminiAgentDrawer
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        messages={agentMessages}
        sending={agentSending}
        persona={agentPersona}
        onChangePersona={setAgentPersona}
        onClearChat={() => setAgentMessages([])}
        onSendMessage={handleSendAgentMessage}
        onTranscribeAudio={handleTranscribeAudio}
        onSpeakText={handleSpeakText}
      />

      {/* Action Modals */}
      <CheckInModal
        open={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        members={members}
        zones={currentZones}
        onSubmitCheckIn={(mid, zid) => void handleLogCheckIn(mid, zid)}
      />
      <AddMemberModal
        open={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        facilityId={facility.id}
        staff={staff}
        onAddMember={(m) => void handleAddMember(m)}
      />
      <ScheduleSessionModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        facilityId={facility.id}
        onAddSession={(s) => void handleAddSession(s)}
      />

      {/* Ephemeral Action Feedback Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key={toastMessage}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 z-50 rounded-lg border border-[#E2E8F0] bg-[#0F172A] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_24px_-4px_rgba(15,23,42,0.18)]"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

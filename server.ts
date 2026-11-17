import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { ensureWorkspaceSeeded } from './src/db/seed.ts';
import {
  adjustZoneOccupancyDb,
  appendAuditDb,
  convertLeadDb,
  createLeadDb,
  createMemberDb,
  createNotificationDb,
  createPlanDb,
  createSessionDb,
  createStaffDb,
  cycleEquipmentStatusDb,
  evaluateAutomatedNotificationsDb,
  importMembersDb,
  loadWorkspaceData,
  performSessionActionDb,
  performSubscriptionActionDb,
  recordCheckInDb,
  updateConfigDb,
  updateLeadDb,
  updateMemberDb,
  updateNotificationStatusDb,
} from './src/db/crmRepo.ts';
import {
  runGymAgentChat,
  synthesizeSpeechReply,
  transcribeVoiceAudio,
} from './src/server/geminiAgent.ts';
import type {
  AgentPersona,
  EquipmentStatus,
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
} from './src/types/gym.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

async function resolveDbUser(req: AuthRequest) {
  const uid = req.user?.uid;
  const email = req.user?.email || 'operator@kinetix.club';
  const name = (req.user?.name as string | undefined) || email.split('@')[0] || 'Devon Brooks';
  if (!uid) {
    throw new Error('Missing authenticated user UID.');
  }
  const dbUser = await getOrCreateUser(uid, email, name);
  await ensureWorkspaceSeeded(dbUser.id);
  return dbUser;
}

app.get('/api/crm/bootstrap', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({
      user: {
        uid: dbUser.uid,
        email: dbUser.email,
        displayName: dbUser.displayName,
      },
      workspace,
    });
  } catch (error) {
    console.error('Bootstrap failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load workspace.' });
  }
});

app.put('/api/crm/config', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    await updateConfigDb(dbUser.id, req.body || {}, dbUser.displayName);
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Config update failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update config.' });
  }
});

app.post('/api/crm/check-in', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { memberId, zoneId, facilityId, role } = req.body as {
      memberId: string;
      zoneId: ZoneId;
      facilityId: string;
      role?: UserRole;
    };
    const checkIn = await recordCheckInDb(
      dbUser.id,
      memberId,
      zoneId,
      facilityId || 'soho',
      dbUser.displayName,
      role || 'Director'
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ checkIn, workspace });
  } catch (error) {
    console.error('Check-in failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to log check-in.' });
  }
});

app.patch('/api/crm/zones/:zoneKey/occupancy', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { facilityId, delta } = req.body as { facilityId: string; delta: number };
    const zone = await adjustZoneOccupancyDb(
      dbUser.id,
      facilityId || 'soho',
      req.params.zoneKey as ZoneId,
      Number(delta) || 0
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ zone, workspace });
  } catch (error) {
    console.error('Zone occupancy update failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to adjust occupancy.' });
  }
});

app.patch('/api/crm/equipment/:externalId/cycle', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { role, status } = req.body as { role?: UserRole; status?: EquipmentStatus };
    const item = await cycleEquipmentStatusDb(
      dbUser.id,
      req.params.externalId,
      dbUser.displayName,
      role || 'Director',
      status
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ item, workspace });
  } catch (error) {
    console.error('Equipment status update failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update equipment.' });
  }
});

app.post('/api/crm/members', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { member, role } = req.body as { member: Member; role?: UserRole };
    await createMemberDb(dbUser.id, member, dbUser.displayName, role || 'Director');
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Create member failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create member.' });
  }
});

app.patch('/api/crm/members/:externalId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { member, auditSummary, role } = req.body as {
      member: Member;
      auditSummary: string;
      role?: UserRole;
    };
    await updateMemberDb(
      dbUser.id,
      { ...member, id: req.params.externalId },
      auditSummary || 'Updated member profile',
      dbUser.displayName,
      role || 'Director'
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Update member failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update member.' });
  }
});

app.post('/api/crm/members/import', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { members: imported, facilityName, role } = req.body as {
      members: Member[];
      facilityName: string;
      role?: UserRole;
    };
    await importMembersDb(
      dbUser.id,
      imported || [],
      facilityName || 'Flagship — SoHo',
      dbUser.displayName,
      role || 'Director'
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Import members failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to import members.' });
  }
});

app.post('/api/crm/leads', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { lead, role } = req.body as { lead: Lead; role?: UserRole };
    await createLeadDb(dbUser.id, lead, dbUser.displayName, role || 'Director');
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Create lead failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create lead.' });
  }
});

app.patch('/api/crm/leads/:externalId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { lead, auditSummary, role } = req.body as {
      lead: Lead;
      auditSummary: string;
      role?: UserRole;
    };
    await updateLeadDb(
      dbUser.id,
      { ...lead, id: req.params.externalId },
      auditSummary || 'Updated lead',
      dbUser.displayName,
      role || 'Director'
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Update lead failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update lead.' });
  }
});

app.post('/api/crm/leads/:externalId/convert', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { role } = req.body as { role?: UserRole };
    const member = await convertLeadDb(
      dbUser.id,
      req.params.externalId,
      dbUser.displayName,
      role || 'Director'
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ member, workspace });
  } catch (error) {
    console.error('Convert lead failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to convert lead.' });
  }
});

app.post('/api/crm/plans', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { plan, role } = req.body as { plan: MembershipPlan; role?: UserRole };
    await createPlanDb(dbUser.id, plan, dbUser.displayName, role || 'Director');
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Create plan failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create plan.' });
  }
});

app.post('/api/crm/members/:externalId/subscription', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { action, role } = req.body as {
      action: 'renew' | 'freeze' | 'cancel' | 'retry';
      role?: UserRole;
    };
    const message = await performSubscriptionActionDb(
      dbUser.id,
      req.params.externalId,
      action,
      dbUser.displayName,
      role || 'Director'
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ message, workspace });
  } catch (error) {
    console.error('Subscription action failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update subscription.' });
  }
});

app.post('/api/crm/sessions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { session, role } = req.body as { session: StudioSession; role?: UserRole };
    await createSessionDb(dbUser.id, session, dbUser.displayName, role || 'Director');
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Create session failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create session.' });
  }
});

app.post('/api/crm/sessions/:externalId/action', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { action, athleteName, role } = req.body as {
      action: 'enroll' | 'waitlist' | 'promote' | 'cancel';
      athleteName?: string;
      role?: UserRole;
    };
    const message = await performSessionActionDb(
      dbUser.id,
      req.params.externalId,
      action,
      dbUser.displayName,
      role || 'Director',
      athleteName
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ message, workspace });
  } catch (error) {
    console.error('Session action failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update session.' });
  }
});

app.post('/api/crm/staff', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { staffMember, role } = req.body as { staffMember: StaffMember; role?: UserRole };
    await createStaffDb(dbUser.id, staffMember, dbUser.displayName, role || 'Director');
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Create staff failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add staff member.' });
  }
});

app.post('/api/crm/audit', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { category, action, target, role } = req.body as {
      category: 'Member' | 'Check-In' | 'Lead' | 'Billing' | 'Schedule' | 'Equipment' | 'System';
      action: string;
      target: string;
      role?: UserRole;
    };
    await appendAuditDb(dbUser.id, dbUser.displayName, role || 'Director', category, action, target);
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Audit append failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record audit entry.' });
  }
});

app.post('/api/notifications/evaluate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { role } = req.body as { role?: UserRole };
    const result = await evaluateAutomatedNotificationsDb(
      dbUser.id,
      dbUser.displayName,
      role || 'Director'
    );
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ ...result, workspace });
  } catch (error) {
    console.error('Notification evaluation failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to evaluate rules.' });
  }
});

app.post('/api/notifications/send', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const {
      category,
      channel,
      severity,
      recipientName,
      recipientEmail,
      title,
      message,
      targetScreen,
      role,
    } = req.body as {
      category: NotificationCategory;
      channel: NotificationChannel;
      severity: 'info' | 'warning' | 'critical';
      recipientName: string;
      recipientEmail: string;
      title: string;
      message: string;
      targetScreen?: ScreenView;
      role?: UserRole;
    };

    const notification = await createNotificationDb(dbUser.id, {
      category: category || 'custom',
      channel: channel || 'both',
      severity: severity || 'info',
      recipientName: recipientName || 'Member',
      recipientEmail: recipientEmail || 'member@kinetix.club',
      title,
      message,
      targetScreen: targetScreen || 'overview',
      ruleKey: `manual:${Date.now()}`,
    });

    await appendAuditDb(
      dbUser.id,
      dbUser.displayName,
      role || 'Director',
      'System',
      `Dispatched ${channel || 'both'} reminder`,
      `${recipientName}: ${title}`
    );

    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ notification, workspace });
  } catch (error) {
    console.error('Notification send failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send notification.' });
  }
});

app.patch('/api/notifications/:externalId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { status } = req.body as { status?: 'unread' | 'read' | 'sent' };
    await updateNotificationStatusDb(dbUser.id, req.params.externalId, status || 'read');
    const workspace = await loadWorkspaceData(dbUser.id);
    res.json({ workspace });
  } catch (error) {
    console.error('Notification status update failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update notification.' });
  }
});

app.post('/api/agent/chat', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await resolveDbUser(req);
    const { message, history, activeRole, activeFacilityId, persona } = req.body as {
      message: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
      activeRole?: UserRole;
      activeFacilityId?: string;
      persona?: AgentPersona;
    };

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Please type or speak a question first.' });
    }

    const agentResult = await runGymAgentChat({
      userId: dbUser.id,
      actorName: dbUser.displayName,
      actorRole: activeRole || 'Director',
      activeFacilityId: activeFacilityId || 'soho',
      persona: persona || 'Club Manager',
      history: history || [],
      message: message.trim(),
    });

    const workspace = agentResult.didMutate ? await loadWorkspaceData(dbUser.id) : undefined;
    res.json({
      reply: agentResult.reply,
      toolActions: agentResult.toolActions,
      didMutate: agentResult.didMutate,
      workspace,
    });
  } catch (error) {
    console.error('Gemini agent chat failed:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Sorry, I could not complete that right now.',
    });
  }
});

app.post('/api/agent/transcribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    await resolveDbUser(req);
    const { audioBase64, mimeType } = req.body as {
      audioBase64?: string;
      mimeType?: string;
    };
    if (!audioBase64) {
      return res.status(400).json({ error: 'No audio recording was received.' });
    }
    const transcript = await transcribeVoiceAudio(audioBase64, mimeType || 'audio/webm');
    res.json({ transcript });
  } catch (error) {
    console.error('Voice transcription failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not understand the recording.',
    });
  }
});

app.post('/api/agent/speak', requireAuth, async (req: AuthRequest, res) => {
  try {
    await resolveDbUser(req);
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for speech playback.' });
    }
    const audio = await synthesizeSpeechReply(text);
    res.json(audio);
  } catch (error) {
    console.error('Speech synthesis failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Voice playback is unavailable right now.',
    });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kinetix server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

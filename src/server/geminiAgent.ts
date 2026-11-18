import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
  type Schema,
} from '@google/genai';
import {
  adjustZoneOccupancyDb,
  appendAuditDb,
  convertLeadDb,
  createLeadDb,
  createMemberDb,
  createNotificationDb,
  createSessionDb,
  cycleEquipmentStatusDb,
  evaluateAutomatedNotificationsDb,
  loadWorkspaceData,
  performSessionActionDb,
  performSubscriptionActionDb,
  recordCheckInDb,
  updateConfigDb,
  updateLeadDb,
  updateMemberDb,
} from '../db/repo.ts';
import { TIER_RATES_INR, formatInr, formatTempC } from '../utils/units.ts';
import type {
  AgentPersona,
  AgentToolAction,
  EquipmentStatus,
  Lead,
  LeadSource,
  LeadStage,
  Member,
  MembershipTier,
  NotificationCategory,
  NotificationChannel,
  ScreenView,
  StudioSession,
  UserRole,
  ZoneId,
} from '../types/gym.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'query_crm_overview',
    description:
      'Get high-level club summary: current floor crowd size, active members, monthly revenue, open inquiries, overdue bills, upcoming classes, unread reminders, club hours, and recent activity.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        facilityId: {
          type: Type.STRING,
          description: 'Optional club location: soho, tribeca, or brooklyn',
        },
      },
    },
  },
  {
    name: 'search_members',
    description:
      'Search or list gym members with their goals, fitness checkups, emergency contacts, documents, memberships, and recent visits.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Member name, email, or note keyword' },
        status: { type: Type.STRING, description: 'Active, At-Risk, Frozen, or Cancelled' },
        tier: { type: Type.STRING, description: 'Membership plan name' },
        preferredZone: { type: Type.STRING, description: 'lifting, cardio, studio, or recovery' },
      },
    },
  },
  {
    name: 'search_leads',
    description:
      'Find prospective members in the sales pipeline by name, stage, source, or overdue follow-ups.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Prospect name or email' },
        stage: {
          type: Type.STRING,
          description: 'New Inquiry, Tour Booked, 7-Day Trial, Proposal Sent, Converted, or Lost',
        },
        overdueOnly: {
          type: Type.BOOLEAN,
          description: 'True to show only open prospects whose follow-up date is today or earlier',
        },
      },
    },
  },
  {
    name: 'query_schedule_and_staff',
    description:
      'Check today’s studio class schedule, open spots, waitlists, booked members, and staff/trainer schedules.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        facilityId: { type: Type.STRING, description: 'Optional club location' },
        zoneId: { type: Type.STRING, description: 'Optional area: lifting, cardio, studio, recovery' },
      },
    },
  },
  {
    name: 'query_billing_and_plans',
    description:
      'Check membership plans, subscription statuses, recent payments, and overdue or paused memberships.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        statusFilter: { type: Type.STRING, description: 'Paid, Pending, Failed, Refunded, or Past Due' },
      },
    },
  },
  {
    name: 'query_floor_and_checkins',
    description:
      'Check how busy each gym area is right now, equipment availability, and recent member check-ins.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        facilityId: { type: Type.STRING, description: 'soho, tribeca, or brooklyn' },
      },
    },
  },
  {
    name: 'query_notifications',
    description:
      'Check upcoming or sent reminders and alerts (expiring memberships, upcoming classes, waitlist openings, overdue follow-ups, equipment alerts).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: 'unread, read, or sent' },
        category: { type: Type.STRING, description: 'Optional reminder category' },
      },
    },
  },
  {
    name: 'create_member',
    description: 'Sign up a new gym member and record their first membership payment.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Full name of the member' },
        email: { type: Type.STRING, description: 'Email address' },
        phone: { type: Type.STRING, description: 'Phone number' },
        tier: {
          type: Type.STRING,
          description: 'Performance Unlimited, Studio + Floor, Off-Peak Lab, or Corporate Athlete',
        },
        preferredZone: {
          type: Type.STRING,
          description: 'lifting, cardio, studio, or recovery',
        },
        facilityId: { type: Type.STRING, description: 'soho, tribeca, or brooklyn' },
        goals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Fitness goals list',
        },
        notes: { type: Type.STRING, description: 'Helpful member notes' },
      },
      required: ['name', 'email'],
    },
  },
  {
    name: 'update_member_profile_or_assessment',
    description:
      'Update a member profile (status, notes, goals) or record a new fitness checkup (weight, body fat, fitness score, heart rate, squat weight).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        memberIdentifier: { type: Type.STRING, description: 'Member name or ID' },
        status: { type: Type.STRING, description: 'Active, At-Risk, Frozen, or Cancelled' },
        notes: { type: Type.STRING, description: 'Updated notes' },
        addGoal: { type: Type.STRING, description: 'New fitness goal to add' },
        assessment: {
          type: Type.OBJECT,
          description: 'Optional fitness checkup numbers to record',
          properties: {
            coach: { type: Type.STRING },
            weightLbs: { type: Type.NUMBER, description: 'Body weight in kg' },
            weightKg: { type: Type.NUMBER, description: 'Body weight in kg' },
            bodyFatPct: { type: Type.NUMBER },
            vo2Max: { type: Type.NUMBER },
            restingHr: { type: Type.NUMBER },
            squat1Rm: { type: Type.NUMBER, description: 'Squat 1RM in kg' },
            notes: { type: Type.STRING },
          },
        },
      },
      required: ['memberIdentifier'],
    },
  },
  {
    name: 'log_member_checkin',
    description: 'Check a member into a gym area and update the live headcount.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        memberIdentifier: { type: Type.STRING, description: 'Member name or ID' },
        zoneId: { type: Type.STRING, description: 'lifting, cardio, studio, or recovery' },
        facilityId: { type: Type.STRING, description: 'Optional club location' },
      },
      required: ['memberIdentifier', 'zoneId'],
    },
  },
  {
    name: 'create_or_update_lead',
    description: 'Add a new prospect inquiry OR update an existing prospect stage, trial status, follow-up date, or notes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        leadIdentifier: { type: Type.STRING, description: 'Existing prospect name or ID (leave empty to add a new prospect)' },
        name: { type: Type.STRING, description: 'Prospect full name when adding someone new' },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        source: { type: Type.STRING, description: 'Referral, Instagram, Walk-In, Corporate, or Web Trial' },
        stage: {
          type: Type.STRING,
          description: 'New Inquiry, Tour Booked, 7-Day Trial, Proposal Sent, Converted, or Lost',
        },
        trialStatus: { type: Type.STRING, description: 'Not Started, Active Trial, Trial Completed, or Expired' },
        followUpDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        estimatedValue: { type: Type.NUMBER, description: 'Estimated monthly plan value in INR (₹)' },
        notes: { type: Type.STRING },
      },
    },
  },
  {
    name: 'convert_lead_to_member',
    description: 'Upgrade a prospect into a full active gym member.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        leadIdentifier: { type: Type.STRING, description: 'Prospect name or ID' },
      },
      required: ['leadIdentifier'],
    },
  },
  {
    name: 'manage_subscription',
    description: 'Renew, freeze, cancel, or retry a payment on a member’s plan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        memberIdentifier: { type: Type.STRING, description: 'Member name or ID' },
        action: { type: Type.STRING, description: 'renew, freeze, cancel, or retry' },
      },
      required: ['memberIdentifier', 'action'],
    },
  },
  {
    name: 'manage_class_session',
    description:
      'Schedule a new class OR book someone into a class, add them to a waitlist, promote from the waitlist, or cancel a class.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation: {
          type: Type.STRING,
          description: 'create, enroll, waitlist, promote, or cancel',
        },
        sessionIdentifier: { type: Type.STRING, description: 'Class name or ID (required except create)' },
        athleteName: { type: Type.STRING, description: 'Optional member name for booking or waitlist' },
        title: { type: Type.STRING, description: 'Class title when scheduling a new class' },
        room: { type: Type.STRING, description: 'Room name' },
        zoneId: { type: Type.STRING, description: 'lifting, cardio, studio, or recovery' },
        coach: { type: Type.STRING, description: 'Coach name' },
        startTime: { type: Type.STRING, description: 'e.g. 04:00 PM' },
        durationMin: { type: Type.NUMBER },
        capacity: { type: Type.NUMBER },
        intensity: { type: Type.STRING, description: 'Endurance, Strength, HIIT, or Recovery' },
      },
      required: ['operation'],
    },
  },
  {
    name: 'update_equipment_or_zone',
    description: 'Mark equipment as Operational, In Use, or Maintenance, or adjust how many people are in an area.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        equipmentIdentifier: { type: Type.STRING, description: 'Equipment name or ID' },
        equipmentStatus: { type: Type.STRING, description: 'Operational, In Use, or Maintenance' },
        zoneId: { type: Type.STRING, description: 'Area key if adjusting crowd count' },
        occupancyDelta: { type: Type.NUMBER, description: 'How many people to add or subtract' },
      },
    },
  },
  {
    name: 'dispatch_notification_or_evaluate_rules',
    description:
      'Send an email or in-app reminder to a member, prospect, or team, OR run an automatic check for expiring plans, upcoming classes, waitlist openings, and overdue follow-ups.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        evaluateAutomatedRules: {
          type: Type.BOOLEAN,
          description: 'True to run an automatic check for all upcoming reminders and alerts',
        },
        recipientName: { type: Type.STRING },
        recipientEmail: { type: Type.STRING },
        title: { type: Type.STRING },
        message: { type: Type.STRING },
        category: {
          type: Type.STRING,
          description:
            'expiring_membership, upcoming_booking, waitlist_opening, overdue_followup, operational_alert, or custom',
        },
        channel: { type: Type.STRING, description: 'in_app, email, or both' },
        severity: { type: Type.STRING, description: 'info, warning, or critical' },
      },
    },
  },
  {
    name: 'update_gym_config',
    description:
      'Update club settings like opening hours, crowd alert limits, auto-waitlist promotion, billing grace days, GST/tax rate, or waiver requirement.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operatingHours: { type: Type.STRING },
        maxOccupancyThresholdPct: { type: Type.NUMBER },
        autoWaitlistPromote: { type: Type.BOOLEAN },
        gracePeriodDays: { type: Type.NUMBER },
        taxRatePct: { type: Type.NUMBER, description: 'GST rate percentage (e.g. 18)' },
        requireSignedWaiver: { type: Type.BOOLEAN },
      },
    },
  },
];

function schemaToJsonSchema(schema: Schema): Record<string, unknown> {
  const typeMap: Record<string, string> = {
    [Type.OBJECT]: 'object',
    [Type.STRING]: 'string',
    [Type.NUMBER]: 'number',
    [Type.INTEGER]: 'integer',
    [Type.BOOLEAN]: 'boolean',
    [Type.ARRAY]: 'array',
  };
  const result: Record<string, unknown> = {
    type: typeMap[schema.type as string] || 'string',
  };
  if (schema.description) result.description = schema.description;
  if (schema.properties) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      props[k] = schemaToJsonSchema(v);
    }
    result.properties = props;
  }
  if (schema.items) {
    result.items = schemaToJsonSchema(schema.items);
  }
  if (schema.required) {
    result.required = schema.required;
  }
  return result;
}

const GROQ_TOOLS = TOOL_DECLARATIONS.map((td) => ({
  type: 'function' as const,
  function: {
    name: td.name,
    description: td.description,
    parameters: td.parameters ? schemaToJsonSchema(td.parameters) : { type: 'object', properties: {} },
  },
}));

function matchByIdOrName<T extends { id: string; name: string }>(
  items: T[],
  identifier: string
): T | undefined {
  const q = identifier.trim().toLowerCase();
  return (
    items.find((i) => i.id.toLowerCase() === q) ||
    items.find((i) => i.name.toLowerCase() === q) ||
    items.find((i) => i.name.toLowerCase().includes(q))
  );
}

const TIER_RATES = TIER_RATES_INR;

const FACILITY_NAMES: Record<string, string> = {
  soho: 'Flagship SoHo',
  tribeca: 'Performance Lab Tribeca',
  brooklyn: 'Endurance Loft Brooklyn',
};

const ZONE_FRIENDLY: Record<string, string> = {
  lifting: 'Strength & Lifting Area',
  cardio: 'Cardio Row',
  studio: 'Studio A (Cycle & HIIT)',
  recovery: 'Recovery & Sauna Suite',
};

const PERSONA_GUIDANCE: Record<AgentPersona, string> = {
  'Club Manager':
    'You act as an experienced, warm Club Manager helping the gym owner stay effortlessly on top of members, billing, classes, staff, and daily operations.',
  'Front Desk Helper':
    'You act as a friendly, sharp Front Desk Coordinator helping quickly check members in, manage class spots and waitlists, and handle everyday member questions.',
  'Sales Coach':
    'You act as a supportive Membership & Sales Advisor helping track new inquiries, free trials, overdue follow-ups, and converting visitors into loyal members.',
  'Head Trainer':
    'You act as an encouraging Head Coach focusing on member fitness goals, workout checkups, class readiness, and helping members who missed sessions get back on track.',
};

interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

const GROQ_PREFERRED_CHAT_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
];

const groqModelsCache = new Map<string, { models: string[]; fetchedAt: number }>();

async function getGroqAvailableModels(groqKey: string): Promise<string[]> {
  const cacheKey = groqKey.slice(0, 12);
  const cached = groqModelsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
    return cached.models;
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${groqKey}` },
    });
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (json.data || []).map((m) => m.id).filter((id): id is string => Boolean(id));
    groqModelsCache.set(cacheKey, { models: ids, fetchedAt: Date.now() });
    return ids;
  } catch {
    return [];
  }
}

function isNonChatGroqModel(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes('whisper') ||
    lower.includes('tts') ||
    lower.includes('orpheus') ||
    lower.includes('playai') ||
    lower.includes('guard') ||
    lower.includes('safeguard') ||
    lower.includes('embed') ||
    lower.includes('compound') ||
    lower.includes('allam') ||
    lower.includes('distil')
  );
}

function cleanAssistantReply(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

async function getGroqChatModelCandidates(groqKey: string): Promise<string[]> {
  const available = await getGroqAvailableModels(groqKey);
  const envPreferred = process.env.GROQ_MODEL?.trim();
  const ranked = envPreferred
    ? [envPreferred, ...GROQ_PREFERRED_CHAT_MODELS.filter((m) => m !== envPreferred)]
    : GROQ_PREFERRED_CHAT_MODELS;

  if (available.length === 0) {
    return ranked;
  }

  const chatAvailable = available.filter((id) => !isNonChatGroqModel(id));
  const preferredAvailable = ranked.filter((id) => chatAvailable.includes(id));
  const remainingAvailable = chatAvailable.filter((id) => !preferredAvailable.includes(id));
  const candidates = [...preferredAvailable, ...remainingAvailable];
  return candidates.length > 0 ? candidates : ranked;
}

function isGroqModelRetryableError(status: number, errBody: string): boolean {
  if (status === 404) return true;
  if (status === 400) {
    const lower = errBody.toLowerCase();
    return (
      lower.includes('model_not_found') ||
      lower.includes('does not exist') ||
      lower.includes('tool_use_failed') ||
      lower.includes('tool') ||
      lower.includes('not supported')
    );
  }
  return false;
}

export async function runGymAgentChat(params: {
  userId: number;
  actorName: string;
  actorRole: UserRole;
  activeFacilityId: string;
  persona?: AgentPersona;
  history: { role: 'user' | 'assistant'; content: string }[];
  message: string;
}): Promise<{
  reply: string;
  toolActions: AgentToolAction[];
  didMutate: boolean;
}> {
  const {
    userId,
    actorName,
    actorRole,
    activeFacilityId,
    persona = 'Club Manager',
    history,
    message,
  } = params;

  const toolActions: AgentToolAction[] = [];
  let didMutate = false;

  const clubLabel = FACILITY_NAMES[activeFacilityId] || activeFacilityId;

  const systemInstruction = `You are Kinetix Assistant, a polished, warm, executive gym operations assistant inside the Kinetix club platform.
${PERSONA_GUIDANCE[persona]}
You are helping ${actorName} (${actorRole} view, looking at ${clubLabel}).

COMMUNICATION STYLE (ALWAYS FOLLOW):
1. Speak like a thoughtful, professional colleague talking to a busy gym owner or front-desk manager. Use clear, everyday English — zero technical jargon.
2. NEVER mention software or developer words like "database", "PostgreSQL", "SQL", "CRM", "API", "query", "records", "IDs", "schema", "payload", "telemetry", "externalId", or "CO2 ppm".
3. NEVER display internal IDs like "mem-104", "lead-1", "eq-4", "ses-5", or "stf-1". Always use real member, prospect, class, and equipment names.
4. Translate jargon into natural human phrasing:
   - "At-Risk" -> "haven't visited in a while"
   - "Past Due" -> "overdue payment"
   - "MRR" -> "monthly membership revenue"
   - "VO2 Max" / "1RM" -> "cardio fitness score" / "top squat weight" (unless asked directly)
5. Response Structure:
   - Start with a crisp 1–2 sentence direct answer.
   - Use clean bullet points with **bold names** and specific dates, rupee (₹) figures, weights in kg, and room temperatures in °C whenever listing items.
   - Offer one clear, practical next step at the end when relevant (e.g., "Would you like me to send Julian a friendly payment reminder?").
6. Always verify live information using your tools before answering, and never claim an action succeeded unless your tool returned success.`;

  let cachedWorkspace: Awaited<ReturnType<typeof loadWorkspaceData>> | null = null;

  async function getWorkspace() {
    if (!cachedWorkspace) {
      cachedWorkspace = await loadWorkspaceData(userId);
    }
    return cachedWorkspace;
  }

  async function executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const ws = await getWorkspace();
    const facId =
      typeof args.facilityId === 'string' && args.facilityId
        ? args.facilityId
        : activeFacilityId || ws.activeFacilityId;
    const facFriendly = FACILITY_NAMES[facId] || facId;

    const result = await (async (): Promise<Record<string, unknown>> => {

    switch (name) {
      case 'query_crm_overview': {
        const zones = ws.zonesByFacility[facId] ?? ws.zonesByFacility.soho ?? [];
        const totalOcc = zones.reduce((s, z) => s + z.occupancy, 0);
        const totalCap = zones.reduce((s, z) => s + z.capacity, 0);
        const activeMembers = ws.members.filter((m) => m.status === 'Active');
        const atRiskMembers = ws.members.filter((m) => m.status === 'At-Risk');
        const openLeads = ws.leads.filter((l) => l.stage !== 'Converted' && l.stage !== 'Lost');
        const pastDue = ws.members.filter((m) => m.subscription.paymentStatus === 'Past Due');
        const unreadNotifs = ws.notifications.filter((n) => n.status === 'unread');
        toolActions.push({ name, summary: `Checked ${facFriendly} overview`, mutated: false });
        return {
          club: facFriendly,
          peopleInClubNow: `${totalOcc} out of ${totalCap} spots filled (${Math.round((totalOcc / Math.max(1, totalCap)) * 100)}%)`,
          totalTrackedMembers: ws.members.length,
          activeMembersCount: activeMembers.length,
          membersWhoNeedCheckIn: atRiskMembers.map((m) => ({
            name: m.name,
            lastVisit: m.lastVisit,
            notes: m.notes,
          })),
          openProspectsCount: openLeads.length,
          overduePayments: pastDue.map((m) => ({
            name: m.name,
            monthlyAmount: formatInr(m.monthlyRate),
            plan: m.tier,
          })),
          upcomingClassesCount: ws.sessions.filter((s) => s.status !== 'Cancelled').length,
          unreadRemindersCount: unreadNotifs.length,
          clubHours: ws.config.operatingHours,
          recentActivity: ws.auditLog.slice(0, 5).map((a) => `${a.timestamp}: ${a.action} — ${a.target}`),
        };
      }

      case 'search_members': {
        const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
        const status = typeof args.status === 'string' ? args.status : '';
        const tier = typeof args.tier === 'string' ? args.tier : '';
        const zone = typeof args.preferredZone === 'string' ? args.preferredZone : '';
        const filtered = ws.members.filter((m) => {
          if (
            q &&
            !m.name.toLowerCase().includes(q) &&
            !m.email.toLowerCase().includes(q) &&
            !m.notes.toLowerCase().includes(q)
          ) {
            return false;
          }
          if (status && m.status.toLowerCase() !== status.toLowerCase()) return false;
          if (tier && m.tier.toLowerCase() !== tier.toLowerCase()) return false;
          if (zone && m.preferredZone.toLowerCase() !== zone.toLowerCase()) return false;
          return true;
        });
        toolActions.push({
          name,
          summary: `Looked up ${filtered.length} member${filtered.length === 1 ? '' : 's'}`,
          mutated: false,
        });
        return {
          count: filtered.length,
          members: filtered.map((m) => ({
            name: m.name,
            email: m.email,
            phone: m.phone,
            plan: m.tier,
            monthlyPrice: formatInr(m.monthlyRate),
            membershipStatus: m.status,
            paymentStatus: m.subscription.paymentStatus,
            renewalDate: m.subscription.nextRenewal,
            visitsPast30Days: m.checkIns30d,
            lastVisit: m.lastVisit,
            favoriteArea: ZONE_FRIENDLY[m.preferredZone] || m.preferredZone,
            goals: m.goals,
            notes: m.notes,
            emergencyContact: m.emergencyContact,
            latestCheckup: m.assessments[m.assessments.length - 1] ?? null,
          })),
        };
      }

      case 'search_leads': {
        const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
        const stage = typeof args.stage === 'string' ? args.stage : '';
        const overdueOnly = Boolean(args.overdueOnly);
        const todayIso = new Date().toISOString().slice(0, 10);
        const filtered = ws.leads.filter((l) => {
          if (q && !l.name.toLowerCase().includes(q) && !l.email.toLowerCase().includes(q)) return false;
          if (stage && l.stage.toLowerCase() !== stage.toLowerCase()) return false;
          if (overdueOnly && (l.stage === 'Converted' || l.stage === 'Lost' || l.followUpDate > todayIso)) {
            return false;
          }
          return true;
        });
        toolActions.push({
          name,
          summary: `Checked ${filtered.length} prospect${filtered.length === 1 ? '' : 's'}`,
          mutated: false,
        });
        return {
          count: filtered.length,
          prospects: filtered.map((l) => ({
            name: l.name,
            email: l.email,
            phone: l.phone,
            howTheyHeard: l.source,
            stage: l.stage,
            trialStatus: l.trialStatus,
            followUpDate: l.followUpDate,
            monthlyPlanValue: formatInr(l.estimatedValue),
            notes: l.notes,
          })),
        };
      }

      case 'query_schedule_and_staff': {
        const zoneId = typeof args.zoneId === 'string' ? args.zoneId : '';
        const sessions = ws.sessions.filter((s) => (!zoneId ? true : s.zoneId === zoneId));
        toolActions.push({
          name,
          summary: `Checked ${sessions.length} classes & ${ws.staff.length} team members`,
          mutated: false,
        });
        return {
          classes: sessions.map((s) => ({
            title: s.title,
            room: s.room,
            coach: s.coach,
            startTime: s.startTime,
            durationMinutes: s.durationMin,
            spotsTaken: `${s.enrolled} of ${s.capacity}`,
            status: s.status,
            bookedMembers: s.bookings,
            waitlist: s.waitlist,
          })),
          team: ws.staff.map((st) => ({
            name: st.name,
            role: st.role,
            specialty: st.specialty,
            schedule: st.availability,
            currentStatus: st.status,
            classesThisMonth: st.sessionsThisMonth,
            memberRetention: `${st.retentionRate}%`,
          })),
        };
      }

      case 'query_billing_and_plans': {
        const statusFilter = typeof args.statusFilter === 'string' ? args.statusFilter : '';
        const txns = statusFilter
          ? ws.transactions.filter((t) => t.status.toLowerCase() === statusFilter.toLowerCase())
          : ws.transactions;
        const memberBilling = ws.members.map((m) => ({
          name: m.name,
          plan: m.tier,
          monthlyPrice: formatInr(m.monthlyRate),
          memberStatus: m.status,
          paymentStatus: m.subscription.paymentStatus,
          nextRenewal: m.subscription.nextRenewal,
        }));
        toolActions.push({ name, summary: 'Checked billing & membership plans', mutated: false });
        return {
          plans: ws.plans.map((p) => ({
            name: p.name,
            price: `${formatInr(p.price)}/${p.billingCycle.toLowerCase()}`,
            hours: p.accessHours,
            perks: p.includedClasses,
            subscribers: p.activeSubscribers,
          })),
          recentPayments: txns.map((t) => ({
            member: t.memberName,
            plan: t.planName,
            amount: formatInr(t.amount),
            date: t.date,
            status: t.status,
            paymentMethod: t.method,
          })),
          memberBilling,
        };
      }

      case 'query_floor_and_checkins': {
        const zones = ws.zonesByFacility[facId] ?? ws.zonesByFacility.soho ?? [];
        toolActions.push({
          name,
          summary: `Checked floor areas & recent check-ins`,
          mutated: false,
        });
        return {
          club: facFriendly,
          areas: zones.map((z) => ({
            area: z.name,
            peopleInside: `${z.occupancy} of ${z.capacity}`,
            coachOnDuty: z.activeCoach,
            currentSession: z.currentProgram,
            roomTemp: formatTempC(z.tempF),
          })),
          equipmentNeedingAttention: ws.equipment
            .filter((e) => e.status === 'Maintenance')
            .map((e) => ({ name: e.name, location: e.bay, lastServiced: e.lastServiced })),
          recentCheckIns: ws.checkIns.slice(0, 10).map((c) => ({
            member: c.memberName,
            area: c.zoneName,
            time: c.timestamp,
          })),
        };
      }

      case 'query_notifications': {
        const status = typeof args.status === 'string' ? args.status : '';
        const category = typeof args.category === 'string' ? args.category : '';
        const items = ws.notifications.filter((n) => {
          if (status && n.status !== status) return false;
          if (category && n.category !== category) return false;
          return true;
        });
        toolActions.push({
          name,
          summary: `Checked ${items.length} reminder${items.length === 1 ? '' : 's'}`,
          mutated: false,
        });
        return {
          count: items.length,
          reminders: items.map((n) => ({
            title: n.title,
            recipient: n.recipientName,
            message: n.message,
            channel: n.channel === 'both' ? 'Email & App Alert' : n.channel === 'email' ? 'Email' : 'App Alert',
            status: n.status,
            sentAt: n.createdAt,
          })),
        };
      }

      case 'create_member': {
        const memberName = String(args.name || '').trim();
        const email = String(args.email || '').trim();
        const phone = String(args.phone || '+91 98201 00190');
        const tier = String(args.tier || 'Performance Unlimited') as MembershipTier;
        const preferredZone = String(args.preferredZone || 'lifting') as ZoneId;
        const goals = Array.isArray(args.goals)
          ? args.goals.map(String)
          : ['Complete 30-day onboarding checkup'];
        const notes = String(args.notes || 'Joined via Kinetix Assistant.');
        const initials =
          memberName
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? '')
            .join('') || 'KM';
        const today = new Date().toISOString().slice(0, 10);
        const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
        const rate = TIER_RATES[tier] ?? 6500;

        const member: Member = {
          id: `mem-${Date.now()}`,
          name: memberName,
          email,
          phone,
          initials,
          tier,
          monthlyRate: rate,
          status: 'Active',
          checkIns30d: 1,
          weeklySpark: [0, 0, 0, 0, 0, 0, 1],
          lastVisit: 'Joined today',
          preferredZone,
          joinedDate: today,
          facilityId: facId,
          notes,
          goals,
          emergencyContact: { name: 'On File', relation: 'Primary', phone },
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
            planName: tier,
            startDate: today,
            endDate: nextYear,
            nextRenewal: today,
            paymentStatus: 'Paid',
            autoRenew: true,
          },
          assignedCoachId: 'stf-1',
          activityLog: [{ id: `act-${Date.now()}`, date: 'Today', summary: `Joined on ${tier}` }],
        };

        await createMemberDb(userId, member, actorName, actorRole);
        didMutate = true;
        toolActions.push({ name, summary: `Signed up ${member.name}`, mutated: true });
        return { success: true, memberName: member.name, plan: member.tier, monthlyPrice: formatInr(member.monthlyRate) };
      }

      case 'update_member_profile_or_assessment': {
        const identifier = String(args.memberIdentifier || '');
        const target = matchByIdOrName(ws.members, identifier);
        if (!target) return { success: false, error: `Could not find a member named "${identifier}".` };

        const updated: Member = { ...target };
        const changes: string[] = [];

        if (typeof args.status === 'string') {
          updated.status = args.status as Member['status'];
          changes.push(`membership status set to ${updated.status}`);
        }
        if (typeof args.notes === 'string') {
          updated.notes = args.notes;
          changes.push('notes updated');
        }
        if (typeof args.addGoal === 'string' && args.addGoal.trim()) {
          updated.goals = [...updated.goals, args.addGoal.trim()];
          changes.push(`added goal "${args.addGoal.trim()}"`);
        }
        if (args.assessment && typeof args.assessment === 'object') {
          const a = args.assessment as Record<string, unknown>;
          const today = new Date().toISOString().slice(0, 10);
          const rec = {
            id: `as-${Date.now()}`,
            date: today,
            coach: String(a.coach || actorName),
            weightLbs: Number(a.weightKg ?? a.weightLbs ?? 72),
            bodyFatPct: Number(a.bodyFatPct ?? 16.0),
            vo2Max: Number(a.vo2Max ?? 48.0),
            restingHr: Number(a.restingHr ?? 56),
            squat1Rm: Number(a.squat1Rm ?? 110),
            notes: String(a.notes || 'Recorded via Kinetix Assistant'),
          };
          updated.assessments = [...updated.assessments, rec];
          updated.activityLog = [
            {
              id: `act-${Date.now()}`,
              date: today,
              summary: `Recorded fitness checkup (Cardio score ${rec.vo2Max}, Squat ${rec.squat1Rm} kg)`,
            },
            ...updated.activityLog,
          ];
          changes.push('saved fitness checkup');
        }

        const summary = `Updated ${updated.name}`;
        await updateMemberDb(
          userId,
          updated,
          `${summary}: ${changes.join(', ') || 'profile updated'}`,
          actorName,
          actorRole
        );
        didMutate = true;
        toolActions.push({ name, summary, mutated: true });
        return { success: true, memberName: updated.name, updates: changes };
      }

      case 'log_member_checkin': {
        const identifier = String(args.memberIdentifier || '');
        const target = matchByIdOrName(ws.members, identifier);
        if (!target) return { success: false, error: `Could not find a member named "${identifier}".` };
        const zoneId = String(args.zoneId || target.preferredZone || 'lifting') as ZoneId;
        const log = await recordCheckInDb(userId, target.id, zoneId, facId, actorName, actorRole);
        didMutate = true;
        toolActions.push({
          name,
          summary: `Checked ${target.name} into ${log.zoneName}`,
          mutated: true,
        });
        return { success: true, memberName: target.name, area: log.zoneName, time: log.timestamp };
      }

      case 'create_or_update_lead': {
        const identifier = typeof args.leadIdentifier === 'string' ? args.leadIdentifier.trim() : '';
        if (identifier) {
          const target = matchByIdOrName(ws.leads, identifier);
          if (!target) return { success: false, error: `Could not find a prospect named "${identifier}".` };
          const updated: Lead = {
            ...target,
            stage: (args.stage as LeadStage) || target.stage,
            trialStatus: (args.trialStatus as Lead['trialStatus']) || target.trialStatus,
            followUpDate: typeof args.followUpDate === 'string' ? args.followUpDate : target.followUpDate,
            estimatedValue: args.estimatedValue !== undefined ? Number(args.estimatedValue) : target.estimatedValue,
            notes: typeof args.notes === 'string' ? args.notes : target.notes,
          };
          await updateLeadDb(userId, updated, `Updated prospect stage to ${updated.stage}`, actorName, actorRole);
          didMutate = true;
          toolActions.push({ name, summary: `Updated ${updated.name} (${updated.stage})`, mutated: true });
          return { success: true, prospectName: updated.name, stage: updated.stage, followUpDate: updated.followUpDate };
        } else {
          const leadName = String(args.name || '').trim();
          if (!leadName) return { success: false, error: 'Please provide the prospect’s full name.' };
          const today = new Date().toISOString().slice(0, 10);
          const lead: Lead = {
            id: `lead-${Date.now()}`,
            name: leadName,
            email: String(args.email || `${leadName.toLowerCase().replace(/\s+/g, '.')}@prospect.io`),
            phone: String(args.phone || '+91 98201 00100'),
            source: (args.source as LeadSource) || 'Walk-In',
            stage: (args.stage as LeadStage) || 'New Inquiry',
            trialStatus: (args.trialStatus as Lead['trialStatus']) || 'Not Started',
            followUpDate: typeof args.followUpDate === 'string' ? args.followUpDate : today,
            assignedStaffId: 'stf-4',
            estimatedValue: args.estimatedValue !== undefined ? Number(args.estimatedValue) : 5500,
            notes: String(args.notes || 'Added via Kinetix Assistant.'),
            createdAt: today,
            facilityId: facId,
          };
          await createLeadDb(userId, lead, actorName, actorRole);
          didMutate = true;
          toolActions.push({ name, summary: `Added prospect ${lead.name}`, mutated: true });
          return { success: true, prospectName: lead.name, stage: lead.stage, source: lead.source };
        }
      }

      case 'convert_lead_to_member': {
        const identifier = String(args.leadIdentifier || '');
        const target = matchByIdOrName(ws.leads, identifier);
        if (!target) return { success: false, error: `Could not find a prospect named "${identifier}".` };
        const member = await convertLeadDb(userId, target.id, actorName, actorRole);
        didMutate = true;
        toolActions.push({ name, summary: `Made ${target.name} an active member`, mutated: true });
        return { success: true, memberName: member.name, plan: member.tier };
      }

      case 'manage_subscription': {
        const identifier = String(args.memberIdentifier || '');
        const target = matchByIdOrName(ws.members, identifier);
        if (!target) return { success: false, error: `Could not find a member named "${identifier}".` };
        const action = String(args.action || 'renew') as 'renew' | 'freeze' | 'cancel' | 'retry';
        const msg = await performSubscriptionActionDb(userId, target.id, action, actorName, actorRole);
        didMutate = true;
        toolActions.push({ name, summary: msg, mutated: true });
        return { success: true, message: msg };
      }

      case 'manage_class_session': {
        const op = String(args.operation || '');
        if (op === 'create') {
          const session: StudioSession = {
            id: `ses-${Date.now()}`,
            title: String(args.title || 'Kinetix Conditioning Block'),
            room: String(args.room || 'Studio A · Cycle & Turf'),
            zoneId: String(args.zoneId || 'studio') as ZoneId,
            coach: String(args.coach || 'Devon Brooks'),
            startTime: String(args.startTime || '04:00 PM'),
            durationMin: Number(args.durationMin ?? 45),
            enrolled: 0,
            capacity: Number(args.capacity ?? 20),
            intensity: String(args.intensity || 'HIIT') as StudioSession['intensity'],
            facilityId: facId,
            bookings: [],
            waitlist: [],
            status: 'Scheduled',
          };
          await createSessionDb(userId, session, actorName, actorRole);
          didMutate = true;
          toolActions.push({ name, summary: `Scheduled ${session.title} at ${session.startTime}`, mutated: true });
          return { success: true, className: session.title, startTime: session.startTime, coach: session.coach };
        }
        const sesIdQuery = String(args.sessionIdentifier || '').toLowerCase();
        const targetSes =
          ws.sessions.find((s) => s.id.toLowerCase() === sesIdQuery) ||
          ws.sessions.find((s) => s.title.toLowerCase().includes(sesIdQuery));
        if (!targetSes) return { success: false, error: `Could not find a class matching "${args.sessionIdentifier}".` };

        const msg = await performSessionActionDb(
          userId,
          targetSes.id,
          op as 'enroll' | 'waitlist' | 'promote' | 'cancel',
          actorName,
          actorRole,
          typeof args.athleteName === 'string' ? args.athleteName : undefined
        );
        didMutate = true;
        toolActions.push({ name, summary: msg, mutated: true });
        return { success: true, message: msg };
      }

      case 'update_equipment_or_zone': {
        const results: Record<string, unknown> = {};
        if (typeof args.equipmentIdentifier === 'string' && args.equipmentIdentifier.trim()) {
          const eqTarget = matchByIdOrName(ws.equipment, args.equipmentIdentifier);
          if (!eqTarget) {
            return { success: false, error: `Could not find equipment matching "${args.equipmentIdentifier}".` };
          }
          const updated = await cycleEquipmentStatusDb(
            userId,
            eqTarget.id,
            actorName,
            actorRole,
            typeof args.equipmentStatus === 'string'
              ? (args.equipmentStatus as EquipmentStatus)
              : undefined
          );
          results.equipment = { name: updated.name, status: updated.status };
          didMutate = true;
          toolActions.push({ name, summary: `${updated.name} marked ${updated.status}`, mutated: true });
        }
        if (typeof args.zoneId === 'string' && args.occupancyDelta !== undefined) {
          const updatedZone = await adjustZoneOccupancyDb(
            userId,
            facId,
            args.zoneId as ZoneId,
            Number(args.occupancyDelta)
          );
          results.area = { name: updatedZone.shortName, peopleInside: `${updatedZone.occupancy} of ${updatedZone.capacity}` };
          didMutate = true;
          toolActions.push({
            name,
            summary: `${updatedZone.shortName} headcount updated (${updatedZone.occupancy}/${updatedZone.capacity})`,
            mutated: true,
          });
        }
        return { success: true, ...results };
      }

      case 'dispatch_notification_or_evaluate_rules': {
        if (args.evaluateAutomatedRules) {
          const evalRes = await evaluateAutomatedNotificationsDb(userId, actorName, actorRole);
          didMutate = true;
          toolActions.push({
            name,
            summary: `Checked reminder rules (${evalRes.evaluatedCount} queued)`,
            mutated: true,
          });
          return {
            success: true,
            newRemindersQueued: evalRes.evaluatedCount,
            reminders: evalRes.created.map((n) => ({
              title: n.title,
              recipient: n.recipientName,
              message: n.message,
            })),
          };
        }
        const title = String(args.title || 'Kinetix Reminder');
        const msg = String(args.message || 'Friendly reminder from Kinetix.');
        const recipientName = String(args.recipientName || 'Member');
        const recipientEmail = String(args.recipientEmail || 'member@kinetix.club');
        const category = String(args.category || 'custom') as NotificationCategory;
        const channel = String(args.channel || 'both') as NotificationChannel;
        const severity = String(args.severity || 'info') as 'info' | 'warning' | 'critical';

        await createNotificationDb(userId, {
          category,
          channel,
          severity,
          recipientName,
          recipientEmail,
          title,
          message: msg,
          targetScreen: 'overview' as ScreenView,
          ruleKey: `agent:${Date.now()}`,
        });
        await appendAuditDb(
          userId,
          actorName,
          actorRole,
          'System',
          `Sent ${channel} reminder: ${title}`,
          recipientName
        );
        didMutate = true;
        toolActions.push({ name, summary: `Sent reminder to ${recipientName}`, mutated: true });
        return { success: true, recipient: recipientName, title, message: msg };
      }

      case 'update_gym_config': {
        const patch: Record<string, unknown> = {};
        if (args.operatingHours !== undefined) patch.operatingHours = String(args.operatingHours);
        if (args.maxOccupancyThresholdPct !== undefined)
          patch.maxOccupancyThresholdPct = Number(args.maxOccupancyThresholdPct);
        if (args.autoWaitlistPromote !== undefined)
          patch.autoWaitlistPromote = Boolean(args.autoWaitlistPromote);
        if (args.gracePeriodDays !== undefined) patch.gracePeriodDays = Number(args.gracePeriodDays);
        if (args.taxRatePct !== undefined) patch.taxRatePct = Number(args.taxRatePct);
        if (args.requireSignedWaiver !== undefined)
          patch.requireSignedWaiver = Boolean(args.requireSignedWaiver);

        await updateConfigDb(userId, patch, actorName);
        didMutate = true;
        toolActions.push({ name, summary: 'Saved updated club settings', mutated: true });
        return { success: true, updatedSettings: patch };
      }

      default:
        return { error: `Unsupported action: ${name}` };
    }
    })();

    if (didMutate) {
      cachedWorkspace = null;
    }
    return result;
  }

  // Primary engine: Groq (automatically selects an enabled chat model on the key) with seamless Gemini fallback
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const cleanHistory = history
    .filter((m) => m.content && m.content.trim().length > 0)
    .slice(-10);

  if (groqKey) {
    const candidateModels = await getGroqChatModelCandidates(groqKey);
    let lastGroqFailure = '';

    for (const groqModel of candidateModels) {
      try {
        const groqMessages: GroqMessage[] = [
          { role: 'system', content: systemInstruction },
          ...cleanHistory.map((msg) => ({
            role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: msg.content,
          })),
          { role: 'user', content: message },
        ];

        let shouldTryNextModel = false;

        for (let step = 0; step < 6; step++) {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: groqModel,
              messages: groqMessages,
              tools: GROQ_TOOLS,
              tool_choice: 'auto',
              temperature: 0.3,
              max_tokens: 1024,
            }),
          });

          if (!groqRes.ok) {
            const errBody = await groqRes.text().catch(() => '');
            if (!didMutate && (isGroqModelRetryableError(groqRes.status, errBody) || groqRes.status === 403 || groqRes.status === 429 || groqRes.status >= 500)) {
              lastGroqFailure = `${groqModel}: ${groqRes.status}`;
              shouldTryNextModel = true;
              break;
            }
            throw new Error(`Groq chat request failed (${groqRes.status}): ${errBody}`);
          }

          const data = (await groqRes.json()) as {
            choices?: Array<{
              message?: {
                role?: 'assistant';
                content?: string | null;
                tool_calls?: GroqMessage['tool_calls'];
              };
            }>;
          };

          const choiceMsg = data.choices?.[0]?.message;
          if (!choiceMsg) break;

          const toolCalls = choiceMsg.tool_calls;
          if (!toolCalls || toolCalls.length === 0) {
            const cleaned = cleanAssistantReply(choiceMsg.content || '');
            return {
              reply: cleaned || 'All done!',
              toolActions,
              didMutate,
            };
          }

          groqMessages.push({
            role: 'assistant',
            content: choiceMsg.content ?? null,
            tool_calls: toolCalls,
          });

          for (const call of toolCalls) {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
            } catch {
              parsedArgs = {};
            }
            let result: Record<string, unknown>;
            try {
              result = await executeTool(call.function.name, parsedArgs);
            } catch (err) {
              result = {
                success: false,
                error: err instanceof Error ? err.message : 'Something went wrong running that request.',
              };
            }
            groqMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: JSON.stringify(result),
            });
          }
        }

        if (shouldTryNextModel) {
          if (!didMutate) {
            toolActions.length = 0;
          }
          continue;
        }

        return {
          reply: 'I finished updating your club information. Let me know if you need anything else!',
          toolActions,
          didMutate,
        };
      } catch (groqErr) {
        lastGroqFailure = groqErr instanceof Error ? groqErr.message : String(groqErr);
        if (!didMutate) {
          toolActions.length = 0;
          continue;
        }
        break;
      }
    }

    if (lastGroqFailure) {
      console.info('Groq tool-calling unavailable, trying Gemini / grounded fallback:', lastGroqFailure);
    }
  }

  // Gemini fallback / default engine (sanitize history so roles alternate cleanly starting with 'user')
  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      const ai = getAiClient();
      const contents: Content[] = [];

      for (const msg of cleanHistory) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        if (contents.length === 0 && role === 'model') {
          continue;
        }
        const prev = contents[contents.length - 1];
        if (prev && prev.role === role && prev.parts?.[0] && 'text' in prev.parts[0]) {
          prev.parts[0].text = `${prev.parts[0].text}\n\n${msg.content}`;
        } else {
          contents.push({ role, parts: [{ text: msg.content }] });
        }
      }

      const lastContent = contents[contents.length - 1];
      if (lastContent && lastContent.role === 'user' && lastContent.parts?.[0] && 'text' in lastContent.parts[0]) {
        lastContent.parts[0].text = `${lastContent.parts[0].text}\n\n${message}`;
      } else {
        contents.push({ role: 'user', parts: [{ text: message }] });
      }

      for (let step = 0; step < 6; step++) {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        const fnCalls = response.functionCalls;
        const modelContent = response.candidates?.[0]?.content;

        if (!fnCalls || fnCalls.length === 0) {
          const replyText = cleanAssistantReply(response.text || '');
          return {
            reply: replyText || 'All done!',
            toolActions,
            didMutate,
          };
        }

        if (modelContent) {
          contents.push(modelContent);
        }

        const responseParts = [];
        for (const call of fnCalls) {
          let result: Record<string, unknown>;
          try {
            result = await executeTool(call.name || '', (call.args as Record<string, unknown>) || {});
          } catch (err) {
            result = {
              success: false,
              error: err instanceof Error ? err.message : 'Something went wrong running that request.',
            };
          }
          responseParts.push({
            functionResponse: {
              ...(call.id ? { id: call.id } : {}),
              name: call.name,
              response: result,
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });
      }

      return {
        reply: 'I finished updating your club information. Let me know if you need anything else!',
        toolActions,
        didMutate,
      };
    } catch (geminiErr) {
      if (!groqKey) {
        throw geminiErr;
      }
      console.info(
        'Gemini fallback failed, trying Groq grounded summary:',
        geminiErr instanceof Error ? geminiErr.message : String(geminiErr)
      );
    }
  }

  // Final grounded Groq fallback without tool-calling (when GEMINI_API_KEY is unavailable/failing)
  if (groqKey) {
    const candidateModels = await getGroqChatModelCandidates(groqKey);
    const snapshot = await executeTool('query_crm_overview', {});
    const membersSnap = await executeTool('search_members', {});
    const leadsSnap = await executeTool('search_leads', {});
    const scheduleSnap = await executeTool('query_schedule_and_staff', {});

    const contextText = JSON.stringify({
      overview: snapshot,
      members: membersSnap,
      prospects: leadsSnap,
      scheduleAndStaff: scheduleSnap,
    }).slice(0, 12000);

    for (const groqModel of candidateModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              {
                role: 'system',
                content: `${systemInstruction}\n\nLive club snapshot:\n${contextText}`,
              },
              ...cleanHistory.map((m) => ({
                role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
                content: m.content,
              })),
              { role: 'user', content: message },
            ],
            temperature: 0.3,
            max_tokens: 1024,
          }),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
        };
        const text = cleanAssistantReply(data.choices?.[0]?.message?.content || '');
        if (text) {
          return { reply: text, toolActions, didMutate };
        }
      } catch {
        // Try next candidate
      }
    }
  }

  throw new Error(
    'Assistant could not connect right now. Please verify GEMINI_API_KEY or GROQ_API_KEY in Settings > Secrets.'
  );
}

export async function transcribeVoiceAudio(
  base64Audio: string,
  mimeType: string
): Promise<string> {
  const cleanMime = mimeType.split(';')[0] || 'audio/webm';
  const groqKey = process.env.GROQ_API_KEY?.trim();

  if (groqKey) {
    try {
      const available = await getGroqAvailableModels(groqKey);
      const whisperPreferred = ['whisper-large-v3-turbo', 'whisper-large-v3'];
      const whisperModels =
        available.length > 0
          ? whisperPreferred.filter((m) => available.includes(m))
          : whisperPreferred;

      const audioBytes = Buffer.from(base64Audio, 'base64');
      const ext = cleanMime.includes('mp4')
        ? 'm4a'
        : cleanMime.includes('wav')
        ? 'wav'
        : cleanMime.includes('ogg')
        ? 'ogg'
        : 'webm';

      for (const whisperModel of whisperModels) {
        const form = new FormData();
        form.append('file', new Blob([audioBytes], { type: cleanMime }), `voice.${ext}`);
        form.append('model', whisperModel);
        form.append('response_format', 'json');
        form.append('language', 'en');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: form,
        });

        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          if (data.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      }
    } catch {
      // Fall through cleanly to Gemini transcription
    }
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: cleanMime,
            data: base64Audio,
          },
        },
        {
          text: 'Transcribe this spoken gym manager request into clear, natural plain English text. Return only the spoken words.',
        },
      ],
    },
  });
  return (response.text || '').trim();
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function synthesizeSpeechReply(text: string): Promise<{
  audioBase64: string;
  mimeType: string;
  useBrowserVoice?: boolean;
}> {
  const spokenText = cleanTextForSpeech(text).slice(0, 1200);
  if (!spokenText) {
    throw new Error('No text provided to speak.');
  }

  // 1. Try Groq TTS if enabled on the configured GROQ_API_KEY
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try {
      const available = await getGroqAvailableModels(groqKey);
      const groqTtsModels = [
        { id: 'canopylabs/orpheus-v1-english', voice: 'autumn' },
        { id: 'playai-tts', voice: 'Fritz-PlayAI' },
      ].filter((m) => available.includes(m.id));

      for (const tts of groqTtsModels) {
        const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: tts.id,
            input: spokenText,
            voice: tts.voice,
            response_format: 'wav',
          }),
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 0) {
            return {
              audioBase64: buf.toString('base64'),
              mimeType: 'audio/wav',
            };
          }
        }
      }
    } catch {
      // Fall through to Gemini TTS
    }
  }

  // 2. Try Gemini TTS (first with full metadata/voice config, then minimal audio config if gateway rejects schema fields)
  if (process.env.GEMINI_API_KEY) {
    const ai = getAiClient();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: spokenText,
                speechMetadata: {
                  style: 'Warm, friendly, clear gym assistant speaking in plain everyday English',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return { audioBase64: base64Audio, mimeType: 'audio/wav' };
      }
    } catch {
      // Retry without speechMetadata/speechConfig for gateways with stricter schema validation
    }

    for (const modelName of ['gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts']) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: `Read warmly and clearly: ${spokenText}` }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
          },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return { audioBase64: base64Audio, mimeType: 'audio/wav' };
        }
      } catch {
        // Continue to next fallback
      }
    }
  }

  // 3. Signal browser Web Speech API fallback cleanly without throwing HTTP 500
  return {
    audioBase64: '',
    mimeType: '',
    useBrowserVoice: true,
  };
}


export type ScreenView =
  | 'overview'
  | 'floor'
  | 'members'
  | 'leads'
  | 'billing'
  | 'schedule'
  | 'reports'
  | 'settings';

export type UserRole = 'Director' | 'Sales' | 'Coach' | 'Front Desk';

export type TimeRange = '7D' | '30D' | '1Y';

export type ZoneId = 'lifting' | 'cardio' | 'studio' | 'recovery';

export type MemberStatus = 'Active' | 'At-Risk' | 'Frozen' | 'Cancelled';

export type MembershipTier =
  | 'Performance Unlimited'
  | 'Studio + Floor'
  | 'Off-Peak Lab'
  | 'Corporate Athlete';

export type EquipmentStatus = 'Operational' | 'In Use' | 'Maintenance';

export type LeadStage =
  | 'New Inquiry'
  | 'Tour Booked'
  | '7-Day Trial'
  | 'Proposal Sent'
  | 'Converted'
  | 'Lost';

export type LeadSource = 'Referral' | 'Instagram' | 'Walk-In' | 'Corporate' | 'Web Trial';

export type PaymentStatus = 'Paid' | 'Past Due' | 'Paused' | 'Cancelled';

export type ReportDomain = 'membership' | 'revenue' | 'attendance' | 'retention' | 'sales';

export interface Facility {
  id: string;
  name: string;
  neighborhood: string;
  maxCapacity: number;
  activeMembers: number;
  mrr: number;
  mrrDelta: string;
  membersDelta: string;
  checkInsToday: number;
  checkInsDelta: string;
  utilizationDelta: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  bay: string;
  zoneId: ZoneId;
  status: EquipmentStatus;
  cyclesToday: number;
  lastServiced: string;
}

export interface GymZone {
  id: ZoneId;
  name: string;
  shortName: string;
  description: string;
  occupancy: number;
  capacity: number;
  tempF: number;
  co2Ppm: number;
  activeCoach: string;
  currentProgram: string;
  accentHex: string;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface MemberDocument {
  id: string;
  title: string;
  type: 'Waiver' | 'Medical' | 'Contract';
  status: 'Signed' | 'Pending';
  updatedAt: string;
}

export interface AssessmentRecord {
  id: string;
  date: string;
  coach: string;
  weightLbs: number;
  bodyFatPct: number;
  vo2Max: number;
  restingHr: number;
  squat1Rm: number;
  notes: string;
}

export interface SubscriptionInfo {
  planName: MembershipTier;
  startDate: string;
  endDate: string;
  nextRenewal: string;
  paymentStatus: PaymentStatus;
  autoRenew: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  initials: string;
  tier: MembershipTier;
  monthlyRate: number;
  status: MemberStatus;
  checkIns30d: number;
  weeklySpark: number[];
  lastVisit: string;
  preferredZone: ZoneId;
  joinedDate: string;
  facilityId: string;
  notes: string;
  goals: string[];
  emergencyContact: EmergencyContact;
  documents: MemberDocument[];
  assessments: AssessmentRecord[];
  subscription: SubscriptionInfo;
  assignedCoachId: string;
  activityLog: { id: string; date: string; summary: string }[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: LeadSource;
  stage: LeadStage;
  trialStatus: 'Not Started' | 'Active Trial' | 'Trial Completed' | 'Expired';
  followUpDate: string;
  assignedStaffId: string;
  estimatedValue: number;
  notes: string;
  createdAt: string;
  facilityId: string;
}

export interface MembershipPlan {
  id: string;
  name: MembershipTier | string;
  price: number;
  billingCycle: 'Monthly' | 'Annual';
  accessHours: string;
  includedClasses: string;
  activeSubscribers: number;
}

export interface TransactionRecord {
  id: string;
  memberId: string;
  memberName: string;
  planName: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  method: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'Head Coach' | 'Performance Coach' | 'Sales Lead' | 'Front Desk';
  specialty: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  availability: string;
  status: 'On Floor' | 'In Session' | 'Off Duty';
  sessionsThisMonth: number;
  retentionRate: number;
  conversionRate: number;
}

export interface CheckInLog {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  memberInitials: string;
  tier: MembershipTier;
  zoneId: ZoneId;
  zoneName: string;
  timestamp: string;
  date: string;
  facilityId: string;
}

export interface StudioSession {
  id: string;
  title: string;
  room: string;
  zoneId: ZoneId;
  coach: string;
  coachAvatar?: string;
  startTime: string;
  durationMin: number;
  enrolled: number;
  capacity: number;
  intensity: 'Endurance' | 'Strength' | 'HIIT' | 'Recovery';
  facilityId: string;
  bookings: string[];
  waitlist: string[];
  status: 'Scheduled' | 'In Progress' | 'Cancelled';
}

export interface ChartPoint {
  label: string;
  checkIns: number;
  bookings: number;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  category: 'Member' | 'Check-In' | 'Lead' | 'Billing' | 'Schedule' | 'Equipment' | 'System';
  action: string;
  target: string;
}

export interface GymAlert {
  id: string;
  severity: 'warning' | 'info' | 'critical';
  title: string;
  detail: string;
  targetScreen: ScreenView;
  roles: UserRole[];
}

export interface GymConfig {
  operatingHours: string;
  maxOccupancyThresholdPct: number;
  autoWaitlistPromote: boolean;
  gracePeriodDays: number;
  taxRatePct: number;
  requireSignedWaiver: boolean;
}

export type NotificationCategory =
  | 'expiring_membership'
  | 'upcoming_booking'
  | 'waitlist_opening'
  | 'overdue_followup'
  | 'operational_alert'
  | 'custom';

export type NotificationChannel = 'in_app' | 'email' | 'both';

export interface GymNotification {
  id: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  severity: 'info' | 'warning' | 'critical';
  recipientName: string;
  recipientEmail: string;
  title: string;
  message: string;
  status: 'unread' | 'read' | 'sent';
  targetScreen: ScreenView;
  ruleKey: string;
  createdAt: string;
}

export interface AgentToolAction {
  name: string;
  summary: string;
  mutated: boolean;
}

export type AgentPersona =
  | 'Club Manager'
  | 'Front Desk Helper'
  | 'Sales Coach'
  | 'Head Trainer';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolActions?: AgentToolAction[];
}


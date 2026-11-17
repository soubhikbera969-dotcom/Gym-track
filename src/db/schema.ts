import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type {
  AssessmentRecord,
  EmergencyContact,
  MemberDocument,
  SubscriptionInfo,
} from '../types/gym.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Devon Brooks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gymConfigs = pgTable('gym_configs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  operatingHours: text('operating_hours').notNull(),
  maxOccupancyThresholdPct: integer('max_occupancy_threshold_pct').notNull(),
  autoWaitlistPromote: boolean('auto_waitlist_promote').notNull(),
  gracePeriodDays: integer('grace_period_days').notNull(),
  taxRatePct: real('tax_rate_pct').notNull(),
  requireSignedWaiver: boolean('require_signed_waiver').notNull(),
  activeRole: text('active_role').notNull().default('Director'),
  activeFacilityId: text('active_facility_id').notNull().default('soho'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const zones = pgTable('zones', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  facilityId: text('facility_id').notNull(),
  zoneKey: text('zone_key').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  description: text('description').notNull(),
  occupancy: integer('occupancy').notNull(),
  capacity: integer('capacity').notNull(),
  tempF: real('temp_f').notNull(),
  co2Ppm: integer('co2_ppm').notNull(),
  activeCoach: text('active_coach').notNull(),
  currentProgram: text('current_program').notNull(),
  accentHex: text('accent_hex').notNull(),
});

export const equipment = pgTable('equipment', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  bay: text('bay').notNull(),
  zoneId: text('zone_id').notNull(),
  status: text('status').notNull(),
  cyclesToday: integer('cycles_today').notNull(),
  lastServiced: text('last_serviced').notNull(),
});

export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  specialty: text('specialty').notNull(),
  email: text('email').notNull(),
  avatarUrl: text('avatar_url'),
  initials: text('initials').notNull(),
  availability: text('availability').notNull(),
  status: text('status').notNull(),
  sessionsThisMonth: integer('sessions_this_month').notNull(),
  retentionRate: real('retention_rate').notNull(),
  conversionRate: real('conversion_rate').notNull(),
});

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  avatarUrl: text('avatar_url'),
  initials: text('initials').notNull(),
  tier: text('tier').notNull(),
  monthlyRate: integer('monthly_rate').notNull(),
  status: text('status').notNull(),
  checkIns30d: integer('check_ins_30d').notNull(),
  weeklySpark: jsonb('weekly_spark').$type<number[]>().notNull(),
  lastVisit: text('last_visit').notNull(),
  preferredZone: text('preferred_zone').notNull(),
  joinedDate: text('joined_date').notNull(),
  facilityId: text('facility_id').notNull(),
  notes: text('notes').notNull(),
  goals: jsonb('goals').$type<string[]>().notNull(),
  emergencyContact: jsonb('emergency_contact').$type<EmergencyContact>().notNull(),
  documents: jsonb('documents').$type<MemberDocument[]>().notNull(),
  assessments: jsonb('assessments').$type<AssessmentRecord[]>().notNull(),
  subscription: jsonb('subscription').$type<SubscriptionInfo>().notNull(),
  assignedCoachId: text('assigned_coach_id').notNull(),
  activityLog: jsonb('activity_log')
    .$type<{ id: string; date: string; summary: string }[]>()
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  source: text('source').notNull(),
  stage: text('stage').notNull(),
  trialStatus: text('trial_status').notNull(),
  followUpDate: text('follow_up_date').notNull(),
  assignedStaffId: text('assigned_staff_id').notNull(),
  estimatedValue: integer('estimated_value').notNull(),
  notes: text('notes').notNull(),
  createdAt: text('created_at').notNull(),
  facilityId: text('facility_id').notNull(),
});

export const membershipPlans = pgTable('membership_plans', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  billingCycle: text('billing_cycle').notNull(),
  accessHours: text('access_hours').notNull(),
  includedClasses: text('included_classes').notNull(),
  activeSubscribers: integer('active_subscribers').notNull(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  planName: text('plan_name').notNull(),
  amount: integer('amount').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  method: text('method').notNull(),
});

export const checkInLogs = pgTable('check_in_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  memberId: text('member_id').notNull(),
  memberName: text('member_name').notNull(),
  memberAvatar: text('member_avatar'),
  memberInitials: text('member_initials').notNull(),
  tier: text('tier').notNull(),
  zoneId: text('zone_id').notNull(),
  zoneName: text('zone_name').notNull(),
  timestamp: text('timestamp').notNull(),
  date: text('date').notNull(),
  facilityId: text('facility_id').notNull(),
});

export const studioSessions = pgTable('studio_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  room: text('room').notNull(),
  zoneId: text('zone_id').notNull(),
  coach: text('coach').notNull(),
  coachAvatar: text('coach_avatar'),
  startTime: text('start_time').notNull(),
  durationMin: integer('duration_min').notNull(),
  enrolled: integer('enrolled').notNull(),
  capacity: integer('capacity').notNull(),
  intensity: text('intensity').notNull(),
  facilityId: text('facility_id').notNull(),
  bookings: jsonb('bookings').$type<string[]>().notNull(),
  waitlist: jsonb('waitlist').$type<string[]>().notNull(),
  status: text('status').notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  category: text('category').notNull(),
  channel: text('channel').notNull(),
  severity: text('severity').notNull(),
  recipientName: text('recipient_name').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull(),
  targetScreen: text('target_screen').notNull(),
  ruleKey: text('rule_key').notNull(),
  createdAt: text('created_at').notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull(),
  timestamp: text('timestamp').notNull(),
  actor: text('actor').notNull(),
  role: text('role').notNull(),
  category: text('category').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  config: one(gymConfigs, {
    fields: [users.id],
    references: [gymConfigs.userId],
  }),
  members: many(members),
  leads: many(leads),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

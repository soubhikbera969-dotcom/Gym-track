import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Phone,
  Plus,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  AssessmentRecord,
  Member,
  MemberStatus,
  MembershipTier,
  StaffMember,
} from '../types/gym';
import { MemberAvatar } from './MemberAvatar';
import { StatusChip } from './StatusChip';

interface MemberProfileDrawerProps {
  member: Member;
  staff: StaffMember[];
  onClose: () => void;
  onCheckInMember: (member: Member) => void;
  onUpdateMember: (updated: Member, auditSummary: string) => void;
}

type ProfileTab = 'profile' | 'assessments' | 'billing' | 'documents';

const TIER_RATES: Record<MembershipTier, number> = {
  'Performance Unlimited': 265,
  'Corporate Athlete': 230,
  'Studio + Floor': 210,
  'Off-Peak Lab': 165,
};

export const MemberProfileDrawer: React.FC<MemberProfileDrawerProps> = ({
  member,
  staff,
  onClose,
  onCheckInMember,
  onUpdateMember,
}) => {
  const [tab, setTab] = useState<ProfileTab>('profile');
  const [editingNotes, setEditingNotes] = useState(member.notes);
  const [newGoal, setNewGoal] = useState('');
  const [ecName, setEcName] = useState(member.emergencyContact.name);
  const [ecRelation, setEcRelation] = useState(member.emergencyContact.relation);
  const [ecPhone, setEcPhone] = useState(member.emergencyContact.phone);

  // Assessment form state
  const [showAssessForm, setShowAssessForm] = useState(false);
  const [weightLbs, setWeightLbs] = useState(165);
  const [bodyFatPct, setBodyFatPct] = useState(15.5);
  const [vo2Max, setVo2Max] = useState(49.0);
  const [restingHr, setRestingHr] = useState(54);
  const [squat1Rm, setSquat1Rm] = useState(245);
  const [assessNotes, setAssessNotes] = useState('');

  const assignedCoach = staff.find((s) => s.id === member.assignedCoachId);

  const handleSaveProfileDetails = () => {
    onUpdateMember(
      {
        ...member,
        notes: editingNotes,
        emergencyContact: { name: ecName, relation: ecRelation, phone: ecPhone },
      },
      `Updated profile notes & emergency contact for ${member.name}`
    );
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    onUpdateMember(
      {
        ...member,
        goals: [...member.goals, newGoal.trim()],
        activityLog: [
          { id: `act-${Date.now()}`, date: 'Just now', summary: `Added training goal: ${newGoal.trim()}` },
          ...member.activityLog,
        ],
      },
      `Added goal "${newGoal.trim()}" to ${member.name}`
    );
    setNewGoal('');
  };

  const handleRemoveGoal = (idx: number) => {
    const next = member.goals.filter((_, i) => i !== idx);
    onUpdateMember(
      { ...member, goals: next },
      `Removed training goal from ${member.name}`
    );
  };

  const handleAddAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    const record: AssessmentRecord = {
      id: `as-${Date.now()}`,
      date: '2026-11-15',
      coach: assignedCoach?.name ?? 'Devon Brooks',
      weightLbs,
      bodyFatPct,
      vo2Max,
      restingHr,
      squat1Rm,
      notes: assessNotes.trim() || 'Routine performance benchmark logged.',
    };
    onUpdateMember(
      {
        ...member,
        assessments: [...member.assessments, record],
        activityLog: [
          { id: `act-${Date.now()}`, date: 'Just now', summary: `Logged physiological assessment (VO2 ${vo2Max}, Squat ${squat1Rm} lb)` },
          ...member.activityLog,
        ],
      },
      `Logged physiological assessment for ${member.name}`
    );
    setAssessNotes('');
    setShowAssessForm(false);
  };

  const handleToggleDocument = (docId: string) => {
    const nextDocs = member.documents.map((d) =>
      d.id === docId
        ? { ...d, status: (d.status === 'Signed' ? 'Pending' : 'Signed') as 'Signed' | 'Pending', updatedAt: '2026-11-15' }
        : d
    );
    onUpdateMember(
      { ...member, documents: nextDocs },
      `Updated document compliance status for ${member.name}`
    );
  };

  const handleTierChange = (tier: MembershipTier) => {
    onUpdateMember(
      {
        ...member,
        tier,
        monthlyRate: TIER_RATES[tier],
        subscription: { ...member.subscription, planName: tier },
        activityLog: [
          { id: `act-${Date.now()}`, date: 'Just now', summary: `Membership plan changed to ${tier}` },
          ...member.activityLog,
        ],
      },
      `Changed ${member.name} tier to ${tier}`
    );
  };

  const handleStatusAction = (nextStatus: MemberStatus) => {
    onUpdateMember(
      {
        ...member,
        status: nextStatus,
        subscription: {
          ...member.subscription,
          paymentStatus:
            nextStatus === 'Frozen'
              ? 'Paused'
              : nextStatus === 'Cancelled'
              ? 'Cancelled'
              : 'Paid',
        },
        activityLog: [
          { id: `act-${Date.now()}`, date: 'Just now', summary: `Membership status changed to ${nextStatus}` },
          ...member.activityLog,
        ],
      },
      `Set ${member.name} status to ${nextStatus}`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/30"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-2xl bg-white h-full border-l border-[#E2E8F0] shadow-[0_20px_40px_-12px_rgba(15,23,42,0.18)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3.5 min-w-0">
            <MemberAvatar
              name={member.name}
              initials={member.initials}
              src={member.avatarUrl}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-display text-xl font-semibold text-[#0F172A] truncate">
                  {member.name}
                </h3>
                <StatusChip status={member.status} />
              </div>
              <p className="text-xs text-[#64748B] truncate mt-0.5">
                {member.email} · {member.phone} · Joined {member.joinedDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close member profile"
            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="px-6 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-6 overflow-x-auto">
          {[
            { id: 'profile' as ProfileTab, label: 'Profile & Goals', icon: ClipboardList },
            { id: 'assessments' as ProfileTab, label: 'Workouts & Assessments', icon: Activity },
            { id: 'billing' as ProfileTab, label: 'Subscription & Billing', icon: CreditCard },
            { id: 'documents' as ProfileTab, label: 'Documents & History', icon: FileText },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-[#059669] text-[#059669]'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'profile' && (
            <>
              {/* Quick KPIs */}
              <div className="grid grid-cols-3 gap-4 pb-5 border-b border-[#F1F5F9]">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    30d Visits
                  </div>
                  <div className="font-display text-2xl font-bold text-[#0F172A] tabular-nums mt-0.5">
                    {member.checkIns30d}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Assigned Coach
                  </div>
                  <div className="text-sm font-semibold text-[#0F172A] mt-1.5 truncate">
                    {assignedCoach?.name ?? 'Unassigned'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Last Gate Access
                  </div>
                  <div className="font-mono text-xs font-semibold text-[#334155] tabular-nums mt-2">
                    {member.lastVisit}
                  </div>
                </div>
              </div>

              {/* Member Goals */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-2.5">
                  Performance Goals
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {member.goals.map((g, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#0F172A]"
                    >
                      {g}
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(idx)}
                        aria-label={`Remove goal ${g}`}
                        className="text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <form onSubmit={handleAddGoal} className="flex gap-2">
                  <input
                    type="text"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="Add measurable performance goal..."
                    className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#059669]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Goal
                  </button>
                </form>
              </div>

              {/* Emergency Contact */}
              <div className="pt-4 border-t border-[#F1F5F9]">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-3">
                  <ShieldAlert className="h-3.5 w-3.5 text-[#D97706]" />
                  Emergency Contact
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={ecName}
                    onChange={(e) => setEcName(e.target.value)}
                    placeholder="Contact name"
                    className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#059669]"
                  />
                  <input
                    type="text"
                    value={ecRelation}
                    onChange={(e) => setEcRelation(e.target.value)}
                    placeholder="Relation"
                    className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#059669]"
                  />
                  <div className="relative">
                    <Phone className="h-3.5 w-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={ecPhone}
                      onChange={(e) => setEcPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full rounded-lg border border-[#E2E8F0] pl-8 pr-3 py-2 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                </div>
              </div>

              {/* Trainer & Ops Notes */}
              <div className="pt-4 border-t border-[#F1F5F9]">
                <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-2">
                  Trainer & CRM Notes
                </label>
                <textarea
                  rows={3}
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm text-[#334155] focus:outline-none focus:border-[#059669]"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveProfileDetails}
                    className="rounded-lg bg-[#0F172A] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1E293B] cursor-pointer"
                  >
                    Save Profile Changes
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'assessments' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display text-base font-semibold text-[#0F172A]">
                    Physiological & Strength Assessments
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Longitudinal body composition, VO2 max, and barbell force benchmarks
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAssessForm((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Log Assessment
                </button>
              </div>

              {showAssessForm && (
                <form
                  onSubmit={handleAddAssessment}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#64748B] mb-1">
                        Weight (lb)
                      </label>
                      <input
                        type="number"
                        value={weightLbs}
                        onChange={(e) => setWeightLbs(Number(e.target.value))}
                        className="w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#64748B] mb-1">
                        Body Fat %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={bodyFatPct}
                        onChange={(e) => setBodyFatPct(Number(e.target.value))}
                        className="w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#64748B] mb-1">
                        VO2 Max
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={vo2Max}
                        onChange={(e) => setVo2Max(Number(e.target.value))}
                        className="w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#64748B] mb-1">
                        Rest HR
                      </label>
                      <input
                        type="number"
                        value={restingHr}
                        onChange={(e) => setRestingHr(Number(e.target.value))}
                        className="w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#64748B] mb-1">
                        Squat 1RM
                      </label>
                      <input
                        type="number"
                        value={squat1Rm}
                        onChange={(e) => setSquat1Rm(Number(e.target.value))}
                        className="w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={assessNotes}
                    onChange={(e) => setAssessNotes(e.target.value)}
                    placeholder="Coach observations & next 4-week progression..."
                    className="w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAssessForm(false)}
                      className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-[#059669] px-4 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Save Benchmark
                    </button>
                  </div>
                </form>
              )}

              {member.assessments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] p-8 text-center">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    No baseline assessments logged yet
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Log a strength and VO2 baseline to track athlete progress.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {member.assessments.map((a) => (
                    <div key={a.id} className="p-4 bg-white space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                          {a.date}
                        </span>
                        <span className="text-[#64748B]">Assessed by {a.coach}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2 py-2 border-y border-[#F1F5F9] text-center">
                        <div>
                          <div className="text-[10px] uppercase text-[#64748B]">Weight</div>
                          <div className="font-mono text-sm font-bold text-[#0F172A] tabular-nums">
                            {a.weightLbs}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[#64748B]">BF %</div>
                          <div className="font-mono text-sm font-bold text-[#059669] tabular-nums">
                            {a.bodyFatPct}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[#64748B]">VO2</div>
                          <div className="font-mono text-sm font-bold text-[#2563EB] tabular-nums">
                            {a.vo2Max}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[#64748B]">Rest HR</div>
                          <div className="font-mono text-sm font-bold text-[#0F172A] tabular-nums">
                            {a.restingHr}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[#64748B]">Squat 1RM</div>
                          <div className="font-mono text-sm font-bold text-[#0F172A] tabular-nums">
                            {a.squat1Rm}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-[#334155]">{a.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'billing' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[#E2E8F0] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                      Active Subscription
                    </div>
                    <div className="font-display text-lg font-semibold text-[#0F172A] mt-0.5">
                      {member.subscription.planName} · ${member.monthlyRate}/mo
                    </div>
                  </div>
                  <StatusChip status={member.subscription.paymentStatus} />
                </div>

                <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#F1F5F9] text-xs">
                  <div>
                    <span className="text-[#64748B] block">Start Date</span>
                    <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {member.subscription.startDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Term End</span>
                    <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {member.subscription.endDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Next Renewal</span>
                    <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {member.subscription.nextRenewal}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                    Change Membership Tier
                  </label>
                  <select
                    value={member.tier}
                    onChange={(e) => handleTierChange(e.target.value as MembershipTier)}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A]"
                  >
                    {(Object.keys(TIER_RATES) as MembershipTier[]).map((t) => (
                      <option key={t} value={t}>
                        {t} (${TIER_RATES[t]}/mo)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleStatusAction('Active')}
                    className="rounded-lg bg-[#059669] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
                  >
                    Renew / Activate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusAction('Frozen')}
                    className="rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    Freeze Subscription
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusAction('Cancelled')}
                    className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
                  >
                    Cancel Plan
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-display text-sm font-semibold text-[#0F172A] mb-3">
                  Compliance Documents & Waivers
                </h4>
                <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {member.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-white"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${
                            doc.status === 'Signed' ? 'text-[#059669]' : 'text-[#D97706]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0F172A] truncate">
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {doc.type} · Updated {doc.updatedAt}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleDocument(doc.id)}
                        className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#F8FAFC] cursor-pointer shrink-0"
                      >
                        {doc.status === 'Signed' ? 'Signed' : 'Mark Signed'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-display text-sm font-semibold text-[#0F172A] mb-3">
                  Activity & Access History
                </h4>
                <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {member.activityLog.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 bg-white text-xs"
                    >
                      <span className="text-[#0F172A] font-medium">{act.summary}</span>
                      <span className="font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                        {act.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#E2E8F0] px-6 py-4 bg-[#F8FAFC] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onCheckInMember(member)}
            disabled={member.status === 'Frozen' || member.status === 'Cancelled'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-40 cursor-pointer"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Check In to Floor
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9] cursor-pointer"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
};

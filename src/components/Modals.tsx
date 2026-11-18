import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { COACH_AVATAR } from '../data/gymData';
import type {
  GymZone,
  Member,
  MembershipTier,
  StaffMember,
  StudioSession,
  ZoneId,
} from '../types/gym';
import { TIER_RATES_INR, formatInr } from '../utils/units';

interface CheckInModalProps {
  open: boolean;
  onClose: () => void;
  members: Member[];
  zones: GymZone[];
  onSubmitCheckIn: (memberId: string, zoneId: ZoneId) => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  open,
  onClose,
  members,
  zones,
  onSubmitCheckIn,
}) => {
  const activeMembers = members.filter((m) => m.status !== 'Frozen' && m.status !== 'Cancelled');
  const [memberId, setMemberId] = useState(activeMembers[0]?.id ?? '');
  const [zoneId, setZoneId] = useState<ZoneId>('lifting');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = memberId || activeMembers[0]?.id;
    if (!targetId) return;
    onSubmitCheckIn(targetId, zoneId);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/35 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-elevated w-full max-w-md rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-display text-lg font-semibold text-[#0F172A]">
            Log Member Check-In
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
              Select Member
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
            >
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.tier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
              Target Floor Zone
            </label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value as ZoneId)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.occupancy}/{z.capacity} occupied)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#059669] px-5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
            >
              Confirm Check-In
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  facilityId: string;
  staff: StaffMember[];
  onAddMember: (member: Member) => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  open,
  onClose,
  facilityId,
  staff,
  onAddMember,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 98201 00140');
  const [tier, setTier] = useState<MembershipTier>('Performance Unlimited');
  const [preferredZone, setPreferredZone] = useState<ZoneId>('lifting');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [goal, setGoal] = useState('Build strength & VO2 baseline');
  const [coachId, setCoachId] = useState(staff[0]?.id ?? 'stf-1');

  const rateMap = TIER_RATES_INR;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const initials = name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('');
    onAddMember({
      id: `mem-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || '+91 98201 00140',
      initials: initials || 'KM',
      tier,
      monthlyRate: rateMap[tier],
      status: 'Active',
      checkIns30d: 1,
      weeklySpark: [0, 0, 0, 0, 0, 0, 1],
      lastVisit: 'Just enrolled',
      preferredZone,
      joinedDate: '2026-11-15',
      facilityId,
      notes: 'Newly onboarded athlete.',
      goals: [goal.trim() || 'Baseline athletic conditioning'],
      emergencyContact: {
        name: emergencyName.trim() || 'On File',
        relation: 'Primary',
        phone: emergencyPhone.trim() || '+91 98201 00100',
      },
      documents: [
        {
          id: `doc-${Date.now()}`,
          title: 'Liability & Studio Waiver',
          type: 'Waiver',
          status: 'Signed',
          updatedAt: '2026-11-15',
        },
      ],
      assessments: [],
      subscription: {
        planName: tier,
        startDate: '2026-11-15',
        endDate: '2027-11-15',
        nextRenewal: '2026-12-15',
        paymentStatus: 'Paid',
        autoRenew: true,
      },
      assignedCoachId: coachId,
      activityLog: [
        { id: `act-${Date.now()}`, date: 'Just now', summary: `Enrolled in ${tier}` },
      ],
    });
    setName('');
    setEmail('');
    setEmergencyName('');
    setEmergencyPhone('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/35 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-elevated w-full max-w-lg rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-display text-lg font-semibold text-[#0F172A]">
            Enroll New Member
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Alvarez"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-mono text-[#0F172A] focus:outline-none focus:border-[#059669]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@domain.com"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                Membership Tier
              </label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as MembershipTier)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs font-medium text-[#0F172A]"
              >
                <option value="Performance Unlimited">Unlimited ({formatInr(rateMap['Performance Unlimited'])})</option>
                <option value="Corporate Athlete">Corporate ({formatInr(rateMap['Corporate Athlete'])})</option>
                <option value="Studio + Floor">Studio + Floor ({formatInr(rateMap['Studio + Floor'])})</option>
                <option value="Off-Peak Lab">Off-Peak ({formatInr(rateMap['Off-Peak Lab'])})</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                Primary Zone
              </label>
              <select
                value={preferredZone}
                onChange={(e) => setPreferredZone(e.target.value as ZoneId)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs font-medium text-[#0F172A]"
              >
                <option value="lifting">Olympic Lifting</option>
                <option value="cardio">Cardio Row</option>
                <option value="studio">Studio A</option>
                <option value="recovery">Recovery Suite</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                Assigned Coach
              </label>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs font-medium text-[#0F172A]"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
              Initial Training Goal
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <input
              type="text"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="Emergency contact name"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A]"
            />
            <input
              type="text"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="Emergency phone"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-mono text-[#0F172A]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#059669] px-5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
            >
              Enroll Member
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ScheduleSessionModalProps {
  open: boolean;
  onClose: () => void;
  facilityId: string;
  onAddSession: (session: StudioSession) => void;
}

export const ScheduleSessionModal: React.FC<ScheduleSessionModalProps> = ({
  open,
  onClose,
  facilityId,
  onAddSession,
}) => {
  const [title, setTitle] = useState('');
  const [room, setRoom] = useState('Studio A · Cycle & Turf');
  const [coach, setCoach] = useState('Devon Brooks');
  const [startTime, setStartTime] = useState('04:30 PM');
  const [capacity, setCapacity] = useState(20);
  const [intensity, setIntensity] = useState<StudioSession['intensity']>('HIIT');

  const zoneMap: Record<string, ZoneId> = {
    'Strength Platform': 'lifting',
    'Cardio Telemetry Row': 'cardio',
    'Studio A · Cycle & Turf': 'studio',
    'Recovery Suite': 'recovery',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddSession({
      id: `ses-${Date.now()}`,
      title: title.trim(),
      room,
      zoneId: zoneMap[room] ?? 'studio',
      coach,
      coachAvatar: COACH_AVATAR,
      startTime,
      durationMin: 45,
      enrolled: 1,
      capacity,
      intensity,
      facilityId,
      bookings: ['Maya Lin'],
      waitlist: [],
      status: 'Scheduled',
    });
    setTitle('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/35 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-elevated w-full max-w-md rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-display text-lg font-semibold text-[#0F172A]">
            Schedule Studio Session
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
              Session Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Threshold Anaerobic 45"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Studio Room
              </label>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#059669]"
              >
                <option value="Studio A · Cycle & Turf">Studio A · Cycle & Turf</option>
                <option value="Strength Platform">Strength Platform</option>
                <option value="Cardio Telemetry Row">Cardio Telemetry Row</option>
                <option value="Recovery Suite">Recovery Suite</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Intensity Focus
              </label>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as StudioSession['intensity'])}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#059669]"
              >
                <option value="HIIT">HIIT</option>
                <option value="Strength">Strength</option>
                <option value="Endurance">Endurance</option>
                <option value="Recovery">Recovery</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Start Time
              </label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#059669]"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Capacity
              </label>
              <input
                type="number"
                min={4}
                max={36}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#059669]"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Coach
              </label>
              <input
                type="text"
                value={coach}
                onChange={(e) => setCoach(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#059669]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#059669] px-5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
            >
              Publish Session
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

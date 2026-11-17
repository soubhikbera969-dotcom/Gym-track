import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Ban,
  Calendar,
  Clock,
  Plus,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { PEAK_HOURS_HEAT } from '../data/gymData';
import type { Member, StaffMember, StudioSession } from '../types/gym';
import { MemberAvatar } from './MemberAvatar';
import { StatusChip } from './StatusChip';

interface ScheduleAndStaffScreenProps {
  sessions: StudioSession[];
  staff: StaffMember[];
  members: Member[];
  onEnrollSession: (sessionId: string) => void;
  onAddWaitlist: (sessionId: string) => void;
  onPromoteWaitlist: (sessionId: string) => void;
  onCancelSession: (sessionId: string) => void;
  onOpenScheduleModal: () => void;
  onAddStaff: (member: StaffMember) => void;
}

export const ScheduleAndStaffScreen: React.FC<ScheduleAndStaffScreenProps> = ({
  sessions,
  staff,
  members,
  onEnrollSession,
  onAddWaitlist,
  onPromoteWaitlist,
  onCancelSession,
  onOpenScheduleModal,
  onAddStaff,
}) => {
  const [subTab, setSubTab] = useState<'classes' | 'staff' | 'heatmap'>('classes');
  const [roomFilter, setRoomFilter] = useState('All');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [showStaffForm, setShowStaffForm] = useState(false);

  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<StaffMember['role']>('Performance Coach');
  const [staffSpec, setStaffSpec] = useState('');
  const [staffAvail, setStaffAvail] = useState('Mon–Fri · 08:00–16:00');

  const rooms = [
    'All',
    'Strength Platform',
    'Cardio Telemetry Row',
    'Studio A · Cycle & Turf',
    'Recovery Suite',
  ];

  const filteredSessions = useMemo(() => {
    if (roomFilter === 'All') return sessions;
    return sessions.filter((s) => s.room === roomFilter);
  }, [sessions, roomFilter]);

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) return;
    const initials = staffName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('');
    onAddStaff({
      id: `stf-${Date.now()}`,
      name: staffName.trim(),
      role: staffRole,
      specialty: staffSpec.trim() || 'Athletic Performance',
      email: `${staffName.trim().toLowerCase().replace(/\s+/g, '.')}@kinetix.club`,
      initials: initials || 'ST',
      availability: staffAvail,
      status: 'On Floor',
      sessionsThisMonth: 0,
      retentionRate: 96.0,
      conversionRate: 50,
    });
    setStaffName('');
    setStaffSpec('');
    setShowStaffForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Switcher */}
      <div className="card-resting rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center rounded-full bg-[#F1F5F9] p-1 border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setSubTab('classes')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap ${
              subTab === 'classes'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Classes & Waitlists
          </button>
          <button
            type="button"
            onClick={() => setSubTab('staff')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap ${
              subTab === 'staff'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Staff & Trainers ({staff.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('heatmap')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap ${
              subTab === 'heatmap'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Peak Utilization
          </button>
        </div>

        {subTab === 'classes' ? (
          <button
            type="button"
            onClick={onOpenScheduleModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Session
          </button>
        ) : subTab === 'staff' ? (
          <button
            type="button"
            onClick={() => setShowStaffForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Staff Member
          </button>
        ) : null}
      </div>

      {subTab === 'classes' && (
        <div className="space-y-5">
          {/* Room Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {rooms.map((rm) => (
              <button
                key={rm}
                type="button"
                onClick={() => setRoomFilter(rm)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  roomFilter === rm
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {rm}
              </button>
            ))}
          </div>

          {/* Sessions Roster */}
          <div className="card-resting rounded-lg overflow-hidden">
            <div className="divide-y divide-[#F1F5F9]">
              {filteredSessions.map((ses) => {
                const pct = Math.round((ses.enrolled / ses.capacity) * 100);
                const isFull = ses.enrolled >= ses.capacity;
                const isExpanded = expandedSessionId === ses.id;
                const isCancelled = ses.status === 'Cancelled';

                return (
                  <div key={ses.id} className="bg-white">
                    <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors">
                      <div className="flex items-center gap-4 min-w-[240px] flex-1">
                        <div className="w-20 shrink-0">
                          <div className="font-mono text-sm font-semibold text-[#0F172A] tabular-nums">
                            {ses.startTime}
                          </div>
                          <div className="inline-flex items-center gap-1 text-[11px] text-[#64748B] tabular-nums mt-0.5">
                            <Clock className="h-3 w-3" />
                            {ses.durationMin}m
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#0F172A]">
                              {ses.title}
                            </span>
                            <StatusChip status={ses.status} />
                          </div>
                          <div className="text-xs text-[#64748B] mt-0.5">
                            {ses.room} · {ses.intensity}
                            {ses.waitlist.length > 0 && ` · ${ses.waitlist.length} on waitlist`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 min-w-[150px]">
                        <MemberAvatar
                          name={ses.coach}
                          initials={ses.coach
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                          src={ses.coachAvatar}
                          size="sm"
                        />
                        <span className="text-xs font-medium text-[#334155] whitespace-nowrap">
                          {ses.coach}
                        </span>
                      </div>

                      <div className="w-40 shrink-0">
                        <div className="flex items-center justify-between text-xs tabular-nums mb-1.5">
                          <span className="font-mono font-semibold text-[#0F172A]">
                            {ses.enrolled}/{ses.capacity}
                          </span>
                          <span
                            className={`font-semibold ${
                              isFull ? 'text-[#B45309]' : 'text-[#059669]'
                            }`}
                          >
                            {isFull ? 'Full' : `${pct}%`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: isCancelled
                                ? '#94A3B8'
                                : isFull
                                ? '#D97706'
                                : '#059669',
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isCancelled && (
                          <>
                            {!isFull ? (
                              <button
                                type="button"
                                onClick={() => onEnrollSession(ses.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer"
                              >
                                <UserPlus className="h-3.5 w-3.5 text-[#059669]" />
                                Book Spot
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAddWaitlist(ses.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 text-xs font-semibold text-[#B45309] hover:bg-[#FEF3C7] cursor-pointer"
                              >
                                Join Waitlist
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSessionId(isExpanded ? null : ses.id)
                              }
                              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9] cursor-pointer"
                            >
                              {isExpanded ? 'Close' : 'Roster'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-start justify-between gap-6 text-xs">
                        <div className="space-y-1.5">
                          <div className="font-bold uppercase tracking-[0.05em] text-[#64748B] text-[11px]">
                            Confirmed Roster ({ses.bookings.length} shown)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {ses.bookings.map((b, i) => (
                              <span
                                key={i}
                                className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 font-medium text-[#0F172A]"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="font-bold uppercase tracking-[0.05em] text-[#64748B] text-[11px]">
                            Waitlist Queue ({ses.waitlist.length})
                          </div>
                          {ses.waitlist.length === 0 ? (
                            <p className="text-[#94A3B8]">No waitlisted athletes</p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {ses.waitlist.map((w, i) => (
                                <span
                                  key={i}
                                  className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 font-medium text-[#B45309]"
                                >
                                  #{i + 1} {w}
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => onPromoteWaitlist(ses.id)}
                                className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-2.5 py-1 font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                              >
                                <ArrowUpRight className="h-3 w-3" />
                                Promote Next
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => onCancelSession(ses.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancel Session
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'staff' && (
        <div className="space-y-5">
          {showStaffForm && (
            <form
              onSubmit={handleCreateStaff}
              className="card-resting rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                  Staff Name
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g. Mateo Silva"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                  Role
                </label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as StaffMember['role'])}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold"
                >
                  <option value="Performance Coach">Performance Coach</option>
                  <option value="Head Coach">Head Coach</option>
                  <option value="Sales Lead">Sales Lead</option>
                  <option value="Front Desk">Front Desk</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                  Specialty & Hours
                </label>
                <input
                  type="text"
                  value={staffAvail}
                  onChange={(e) => setStaffAvail(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Add Staff
                </button>
                <button
                  type="button"
                  onClick={() => setShowStaffForm(false)}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {staff.map((stf) => {
              const assignedMembers = members.filter((m) => m.assignedCoachId === stf.id);
              return (
                <div key={stf.id} className="card-resting rounded-xl p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <MemberAvatar
                        name={stf.name}
                        initials={stf.initials}
                        src={stf.avatarUrl}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-semibold text-[#0F172A] truncate">
                          {stf.name}
                        </h3>
                        <p className="text-xs text-[#64748B] truncate">
                          {stf.role} · {stf.specialty}
                        </p>
                      </div>
                    </div>
                    <StatusChip status={stf.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#F1F5F9] text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.04em] text-[#64748B]">
                        Sessions
                      </div>
                      <div className="font-mono text-base font-bold text-[#0F172A] tabular-nums">
                        {stf.sessionsThisMonth}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.04em] text-[#64748B]">
                        Retention
                      </div>
                      <div className="font-mono text-base font-bold text-[#059669] tabular-nums">
                        {stf.retentionRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.04em] text-[#64748B]">
                        Conv. Rate
                      </div>
                      <div className="font-mono text-base font-bold text-[#2563EB] tabular-nums">
                        {stf.conversionRate}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[#64748B]">
                      <span>Availability</span>
                      <span className="font-mono text-[#0F172A]">{stf.availability}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#64748B]">
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-[#059669]" />
                        Assigned Roster
                      </span>
                      <span className="font-semibold text-[#0F172A] tabular-nums">
                        {assignedMembers.length} members
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'heatmap' && (
        <div className="card-resting rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0]">
            <h3 className="font-display text-lg font-semibold text-[#0F172A]">
              Weekly Peak Utilization Matrix
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Percentage of maximum studio capacity booked across core operating blocks
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                  <th className="px-6 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                    Block
                  </th>
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((day) => (
                    <th
                      key={day}
                      className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B] text-center"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {PEAK_HOURS_HEAT.map((row) => {
                  const days = [row.mon, row.tue, row.wed, row.thu, row.fri, row.sat, row.sun];
                  return (
                    <tr key={row.hour} className="h-12">
                      <td className="px-6 font-mono text-xs font-semibold text-[#0F172A] tabular-nums">
                        {row.hour}
                      </td>
                      {days.map((val, idx) => {
                        const bg =
                          val >= 88
                            ? 'bg-[#ECFDF5] text-[#047857]'
                            : val >= 70
                            ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                            : 'bg-[#F8FAFC] text-[#475569]';
                        return (
                          <td key={idx} className="px-2 py-1.5 text-center">
                            <span
                              className={`inline-block w-14 rounded-md py-1 font-mono text-xs font-semibold tabular-nums ${bg}`}
                            >
                              {val}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

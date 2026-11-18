import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Download, Plus, Search, UserCheck } from 'lucide-react';
import type { Member, MemberStatus, MembershipTier, StaffMember } from '../types/gym';
import { MemberAvatar } from './MemberAvatar';
import { MemberProfileDrawer } from './MemberProfileDrawer';
import { StatusChip } from './StatusChip';
import { formatInr } from '../utils/units';

interface MembersScreenProps {
  members: Member[];
  staff: StaffMember[];
  onOpenAddMember: () => void;
  onCheckInMember: (member: Member) => void;
  onUpdateMember: (updated: Member, auditSummary: string) => void;
  onExportCsv: () => void;
}

export const MembersScreen: React.FC<MembersScreenProps> = ({
  members,
  staff,
  onOpenAddMember,
  onCheckInMember,
  onUpdateMember,
  onExportCsv,
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MemberStatus>('All');
  const [tierFilter, setTierFilter] = useState<'All' | MembershipTier>('All');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.tier.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
      const matchesTier = tierFilter === 'All' || m.tier === tierFilter;
      return matchesQuery && matchesStatus && matchesTier;
    });
  }, [members, query, statusFilter, tierFilter]);

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;

  return (
    <div className="space-y-6">
      {/* Inline Global Filter Bar */}
      <div className="card-resting rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members by name, email, phone, or tier..."
              className="w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15"
            />
          </div>

          <div
            className="inline-flex items-center rounded-full bg-[#F1F5F9] p-1 border border-[#E2E8F0]"
            role="group"
            aria-label="Filter by membership status"
          >
            {(['All', 'Active', 'At-Risk', 'Frozen', 'Cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as 'All' | MembershipTier)}
            aria-label="Filter by membership tier"
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] focus:outline-none focus:border-[#059669] cursor-pointer"
          >
            <option value="All">All Tiers</option>
            <option value="Performance Unlimited">Performance Unlimited</option>
            <option value="Corporate Athlete">Corporate Athlete</option>
            <option value="Studio + Floor">Studio + Floor</option>
            <option value="Off-Peak Lab">Off-Peak Lab</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onOpenAddMember}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Member
          </button>
        </div>
      </div>

      {/* Flush High-Density Member Data Table */}
      <div className="card-resting rounded-lg overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="font-display text-base font-semibold text-[#0F172A]">
              No matching members found
            </p>
            <p className="text-sm text-[#64748B] mt-1">
              Clear your search filter or enroll a new member into this facility.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('All');
                setTierFilter('All');
              }}
              className="mt-4 inline-flex items-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                  <th className="px-6 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                    Member
                  </th>
                  <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                    Tier & Goals
                  </th>
                  <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                    Status
                  </th>
                  <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                    30d Cadence
                  </th>
                  <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B] text-right">
                    Monthly
                  </th>
                  <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                    Last Visit
                  </th>
                  <th className="px-6 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredMembers.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`transition-colors cursor-pointer ${
                      selectedMemberId === m.id ? 'bg-[#ECFDF5]/40' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          name={m.name}
                          initials={m.initials}
                          src={m.avatarUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0F172A] truncate">
                            {m.name}
                          </div>
                          <div className="text-xs text-[#64748B] truncate">
                            {m.email} · {m.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <div className="text-xs font-semibold text-[#334155]">{m.tier}</div>
                      <div className="text-[11px] text-[#64748B] truncate max-w-[180px]">
                        {m.goals[0] ?? 'General conditioning'}
                      </div>
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <StatusChip status={m.status} />
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-semibold text-[#0F172A] tabular-nums w-6">
                          {m.checkIns30d}
                        </span>
                        <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
                          {m.weeklySpark.map((val, idx) => (
                            <span
                              key={idx}
                              className="w-1 rounded-xs bg-[#059669]/80"
                              style={{ height: `${Math.max(val * 2.5, 2)}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 text-sm font-mono font-semibold text-[#0F172A] tabular-nums text-right whitespace-nowrap">
                      {formatInr(m.monthlyRate)}
                    </td>
                    <td className="px-4 text-xs text-[#64748B] font-mono tabular-nums whitespace-nowrap">
                      {m.lastVisit}
                    </td>
                    <td
                      className="px-6 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onCheckInMember(m)}
                        disabled={m.status === 'Frozen' || m.status === 'Cancelled'}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] disabled:opacity-40 cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5 text-[#059669]" />
                        Check In
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedMember && (
          <MemberProfileDrawer
            key={selectedMember.id}
            member={selectedMember}
            staff={staff}
            onClose={() => setSelectedMemberId(null)}
            onCheckInMember={onCheckInMember}
            onUpdateMember={onUpdateMember}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

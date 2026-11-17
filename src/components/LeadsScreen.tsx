import React, { useMemo, useState } from 'react';
import { ArrowRight, Calendar, LayoutGrid, List, Plus, Search, UserPlus } from 'lucide-react';
import type { Lead, LeadSource, LeadStage, StaffMember } from '../types/gym';
import { StatusChip } from './StatusChip';

interface LeadsScreenProps {
  leads: Lead[];
  staff: StaffMember[];
  facilityId: string;
  onAddLead: (lead: Lead) => void;
  onUpdateLead: (lead: Lead, auditSummary: string) => void;
  onConvertLead: (lead: Lead) => void;
}

const STAGES: LeadStage[] = [
  'New Inquiry',
  'Tour Booked',
  '7-Day Trial',
  'Proposal Sent',
  'Converted',
  'Lost',
];

export const LeadsScreen: React.FC<LeadsScreenProps> = ({
  leads,
  staff,
  facilityId,
  onAddLead,
  onUpdateLead,
  onConvertLead,
}) => {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'All' | LeadSource>('All');
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('Referral');
  const [assignedStaffId, setAssignedStaffId] = useState(staff[3]?.id ?? staff[0]?.id ?? '');
  const [estimatedValue, setEstimatedValue] = useState(265);
  const [notes, setNotes] = useState('');

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesQ =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q);
      const matchesSrc = sourceFilter === 'All' || l.source === sourceFilter;
      return matchesQ && matchesSrc;
    });
  }, [leads, query, sourceFilter]);

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onAddLead({
      id: `lead-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || '+1 (212) 555-0100',
      source,
      stage: 'New Inquiry',
      trialStatus: 'Not Started',
      followUpDate: '2026-11-16',
      assignedStaffId,
      estimatedValue,
      notes: notes.trim() || 'Initial prospect inquiry logged.',
      createdAt: '2026-11-15',
      facilityId,
    });
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setShowAddForm(false);
  };

  const advanceStage = (lead: Lead) => {
    const idx = STAGES.indexOf(lead.stage);
    if (idx < 0 || idx >= STAGES.length - 2) return;
    const nextStage = STAGES[idx + 1];
    if (nextStage === 'Converted') {
      onConvertLead(lead);
      return;
    }
    const nextTrial =
      nextStage === '7-Day Trial'
        ? 'Active Trial'
        : nextStage === 'Proposal Sent'
        ? 'Trial Completed'
        : lead.trialStatus;
    onUpdateLead(
      { ...lead, stage: nextStage, trialStatus: nextTrial },
      `Moved prospect ${lead.name} to ${nextStage}`
    );
  };

  const getStaffName = (id: string) => staff.find((s) => s.id === id)?.name ?? 'Unassigned';

  const activePipelineMrr = leads
    .filter((l) => l.stage !== 'Lost' && l.stage !== 'Converted')
    .reduce((acc, l) => acc + l.estimatedValue, 0);

  return (
    <div className="space-y-6">
      {/* Pipeline Filter & Summary Bar */}
      <div className="card-resting rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prospects..."
              className="w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'All' | LeadSource)}
            aria-label="Filter leads by source"
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] cursor-pointer"
          >
            <option value="All">All Sources</option>
            <option value="Referral">Referral</option>
            <option value="Instagram">Instagram</option>
            <option value="Walk-In">Walk-In</option>
            <option value="Corporate">Corporate</option>
            <option value="Web Trial">Web Trial</option>
          </select>

          <div className="text-xs text-[#64748B] font-mono tabular-nums px-2">
            Open Pipeline: <strong className="text-[#0F172A]">${activePipelineMrr}/mo</strong>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center rounded-lg bg-[#F1F5F9] p-1 border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                viewMode === 'board' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Pipeline
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Prospect
          </button>
        </div>
      </div>

      {/* Inline Add Prospect Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleCreateLead}
          className="card-resting rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[#0F172A]">
              New Prospect Inquiry
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prospect full name"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:border-[#059669]"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:border-[#059669]"
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:border-[#059669]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LeadSource)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#0F172A]"
            >
              <option value="Referral">Source: Referral</option>
              <option value="Instagram">Source: Instagram</option>
              <option value="Walk-In">Source: Walk-In</option>
              <option value="Corporate">Source: Corporate</option>
              <option value="Web Trial">Source: Web Trial</option>
            </select>
            <select
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#0F172A]"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  Owner: {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(Number(e.target.value))}
              placeholder="Est. MRR ($)"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-mono"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Qualification notes..."
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-[#059669] px-5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
            >
              Save Prospect
            </button>
          </div>
        </form>
      )}

      {/* Board View */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
          {STAGES.filter((s) => s !== 'Lost').map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col"
              >
                <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.04em] text-[#0F172A]">
                    {stage}
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#64748B] tabular-nums">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="divide-y divide-[#F1F5F9]">
                  {stageLeads.length === 0 ? (
                    <div className="p-5 text-center text-xs text-[#94A3B8]">
                      No prospects in stage
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div key={lead.id} className="p-4 space-y-2.5 hover:bg-[#F8FAFC] transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#0F172A] truncate">
                              {lead.name}
                            </div>
                            <div className="text-[11px] text-[#64748B] truncate">
                              {lead.source} · ${lead.estimatedValue}/mo
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-[#475569] line-clamp-2">{lead.notes}</p>

                        <div className="flex items-center justify-between text-[11px] text-[#64748B] tabular-nums pt-1">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {lead.followUpDate}
                          </span>
                          <span className="truncate max-w-[100px]">
                            {getStaffName(lead.assignedStaffId)}
                          </span>
                        </div>

                        {lead.stage !== 'Converted' && (
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => advanceStage(lead)}
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1E293B] hover:bg-[#F1F5F9] cursor-pointer"
                            >
                              Advance <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onConvertLead(lead)}
                              className="inline-flex items-center gap-1 rounded-md bg-[#059669] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#047857] cursor-pointer"
                            >
                              <UserPlus className="h-3 w-3" />
                              Convert
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card-resting rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                  <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Prospect
                  </th>
                  <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Source
                  </th>
                  <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Stage
                  </th>
                  <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Trial Status
                  </th>
                  <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Follow-Up
                  </th>
                  <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                    Assigned Staff
                  </th>
                  <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F8FAFC] h-14">
                    <td className="px-6">
                      <div className="text-sm font-semibold text-[#0F172A]">{lead.name}</div>
                      <div className="text-xs text-[#64748B]">
                        {lead.email} · {lead.phone}
                      </div>
                    </td>
                    <td className="px-4 text-xs font-medium text-[#334155] whitespace-nowrap">
                      {lead.source}
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <StatusChip status={lead.stage} />
                    </td>
                    <td className="px-4 text-xs text-[#475569] whitespace-nowrap">
                      {lead.trialStatus}
                    </td>
                    <td className="px-4 text-xs font-mono text-[#0F172A] tabular-nums whitespace-nowrap">
                      {lead.followUpDate}
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <select
                        value={lead.assignedStaffId}
                        onChange={(e) =>
                          onUpdateLead(
                            { ...lead, assignedStaffId: e.target.value },
                            `Reassigned ${lead.name} to ${getStaffName(e.target.value)}`
                          )
                        }
                        className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#334155]"
                      >
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 text-right whitespace-nowrap">
                      {lead.stage !== 'Converted' ? (
                        <button
                          type="button"
                          onClick={() => onConvertLead(lead)}
                          className="inline-flex items-center gap-1 rounded-md bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
                        >
                          Convert to Member
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-[#059669]">Converted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

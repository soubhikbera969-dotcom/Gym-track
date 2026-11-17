import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, History, Save, Search, Settings, Upload } from 'lucide-react';
import type {
  AuditEntry,
  GymConfig,
  Lead,
  Member,
  MembershipTier,
  UserRole,
} from '../types/gym';

interface SettingsAuditScreenProps {
  config: GymConfig;
  onSaveConfig: (next: GymConfig) => void;
  activeRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  auditLog: AuditEntry[];
  members: Member[];
  leads: Lead[];
  facilityId: string;
  onImportMembers: (imported: Member[]) => void;
  onExportMembersCsv: () => void;
  onExportLeadsCsv: () => void;
}

export const SettingsAuditScreen: React.FC<SettingsAuditScreenProps> = ({
  config,
  onSaveConfig,
  activeRole,
  onChangeRole,
  auditLog,
  members,
  leads,
  facilityId,
  onImportMembers,
  onExportMembersCsv,
  onExportLeadsCsv,
}) => {
  const [draft, setDraft] = useState<GymConfig>(config);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditCat, setAuditCat] = useState<'All' | AuditEntry['category']>('All');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredAudit = auditLog.filter((entry) => {
    const q = auditQuery.trim().toLowerCase();
    const matchesQ =
      !q ||
      entry.actor.toLowerCase().includes(q) ||
      entry.action.toLowerCase().includes(q) ||
      entry.target.toLowerCase().includes(q);
    const matchesCat = auditCat === 'All' || entry.category === auditCat;
    return matchesQ && matchesCat;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(draft);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        setImportStatus('CSV must include a header row and at least one member record.');
        return;
      }

      const imported: Member[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        const name = cols[0];
        const email = cols[1];
        if (!name || !email) continue;
        const tier = (cols[2] as MembershipTier) || 'Studio + Floor';
        const rate = Number(cols[3]) || 210;
        const initials = name
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => s[0]?.toUpperCase() ?? '')
          .join('');
        imported.push({
          id: `mem-imp-${Date.now()}-${i}`,
          name,
          email,
          phone: cols[4] || '+1 (212) 555-0190',
          initials: initials || 'KM',
          tier,
          monthlyRate: rate,
          status: 'Active',
          checkIns30d: 0,
          weeklySpark: [0, 0, 0, 0, 0, 0, 1],
          lastVisit: 'Imported today',
          preferredZone: 'lifting',
          joinedDate: '2026-11-15',
          facilityId,
          notes: 'Imported via CSV batch upload.',
          goals: ['Complete 30-day baseline assessment'],
          emergencyContact: { name: 'On File', relation: 'Primary', phone: '+1 (212) 555-0100' },
          documents: [
            { id: `doc-${Date.now()}-${i}`, title: 'Liability & Studio Waiver', type: 'Waiver', status: 'Pending', updatedAt: '2026-11-15' },
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
          assignedCoachId: 'stf-1',
          activityLog: [{ id: `act-${Date.now()}-${i}`, date: 'Today', summary: 'Imported via CSV' }],
        });
      }

      if (imported.length > 0) {
        onImportMembers(imported);
        setImportStatus(`Imported ${imported.length} member record(s) from ${file.name}.`);
      } else {
        setImportStatus('No valid rows found. Expected columns: Name, Email, Tier, Rate.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const sample = [
      'Name,Email,Tier,MonthlyRate,Phone',
      'Rowan Mercer,rowan@kinetix.club,Performance Unlimited,265,+1 (212) 555-0181',
      'Tessa Cho,tessa.cho@studio.co,Studio + Floor,210,+1 (646) 555-0177',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kinetix-member-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Account & Gym Configuration */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-6 card-resting rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#E2E8F0]">
            <Settings className="h-4 w-4 text-[#059669]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[#0F172A]">
                Gym Configuration & Account Role
              </h2>
              <p className="text-xs text-[#64748B]">
                Manage facility operating rules, billing grace periods, and operator workspace role
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-2">
              Active Operator Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Director', 'Sales', 'Coach', 'Front Desk'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onChangeRole(role)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    activeRole === role
                      ? 'border-[#059669] bg-[#ECFDF5] text-[#047857]'
                      : 'border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Operating Hours
              </label>
              <input
                type="text"
                value={draft.operatingHours}
                onChange={(e) => setDraft({ ...draft, operatingHours: e.target.value })}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Occupancy Alert Threshold (%)
              </label>
              <input
                type="number"
                min={50}
                max={100}
                value={draft.maxOccupancyThresholdPct}
                onChange={(e) =>
                  setDraft({ ...draft, maxOccupancyThresholdPct: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-mono text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Billing Grace Period (Days)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={draft.gracePeriodDays}
                onChange={(e) => setDraft({ ...draft, gracePeriodDays: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-mono text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1.5">
                Local Sales Tax (%)
              </label>
              <input
                type="number"
                step="0.005"
                value={draft.taxRatePct}
                onChange={(e) => setDraft({ ...draft, taxRatePct: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-mono text-[#0F172A]"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-[#F1F5F9]">
            <label className="flex items-center justify-between gap-3 text-xs font-medium text-[#334155] cursor-pointer">
              <span>Automatically promote next waitlisted athlete on cancellation</span>
              <input
                type="checkbox"
                checked={draft.autoWaitlistPromote}
                onChange={(e) => setDraft({ ...draft, autoWaitlistPromote: e.target.checked })}
                className="h-4 w-4 accent-[#059669]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-xs font-medium text-[#334155] cursor-pointer">
              <span>Require signed liability waiver before floor check-in</span>
              <input
                type="checkbox"
                checked={draft.requireSignedWaiver}
                onChange={(e) => setDraft({ ...draft, requireSignedWaiver: e.target.checked })}
                className="h-4 w-4 accent-[#059669]"
              />
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              Save Configuration
            </button>
          </div>
        </form>

        {/* CSV Import / Export Center */}
        <div className="xl:col-span-6 card-resting rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#E2E8F0]">
            <FileSpreadsheet className="h-4 w-4 text-[#2563EB]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[#0F172A]">
                CSV Import & Data Portability
              </h2>
              <p className="text-xs text-[#64748B]">
                Batch import member rosters or export normalized CRM datasets
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-[#0F172A]">
              Import Members from CSV
            </p>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              Columns: Name, Email, Tier, MonthlyRate, Phone. Uploaded rows are immediately added to the live directory and audit trail.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload CSV File
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9] cursor-pointer"
              >
                Download Sample Template
              </button>
            </div>
            {importStatus && (
              <p className="text-xs font-semibold text-[#059669] pt-1">{importStatus}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onExportMembersCsv}
              className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-left hover:bg-[#F8FAFC] cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-[#0F172A]">Export Member Ledger</div>
                <div className="text-[11px] text-[#64748B] font-mono tabular-nums">
                  {members.length} records · CSV
                </div>
              </div>
              <Download className="h-4 w-4 text-[#2563EB]" />
            </button>

            <button
              type="button"
              onClick={onExportLeadsCsv}
              className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-left hover:bg-[#F8FAFC] cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-[#0F172A]">Export Lead Pipeline</div>
                <div className="text-[11px] text-[#64748B] font-mono tabular-nums">
                  {leads.length} records · CSV
                </div>
              </div>
              <Download className="h-4 w-4 text-[#2563EB]" />
            </button>
          </div>
        </div>
      </div>

      {/* Audit History Ledger */}
      <section className="card-resting rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <History className="h-4 w-4 text-[#334155]" />
            <div>
              <h3 className="font-display text-lg font-semibold text-[#0F172A]">
                System Audit History
              </h3>
              <p className="text-xs text-[#64748B]">
                Immutable operational log of CRM mutations, billing events, and gate access
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Search audit events..."
                className="rounded-lg border border-[#E2E8F0] bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#059669]"
              />
            </div>

            <select
              value={auditCat}
              onChange={(e) => setAuditCat(e.target.value as 'All' | AuditEntry['category'])}
              aria-label="Filter audit category"
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155]"
            >
              <option value="All">All Categories</option>
              <option value="Member">Member</option>
              <option value="Check-In">Check-In</option>
              <option value="Lead">Lead</option>
              <option value="Billing">Billing</option>
              <option value="Schedule">Schedule</option>
              <option value="Equipment">Equipment</option>
              <option value="System">System</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Time
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Operator
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Category
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Action
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Target
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredAudit.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#F8FAFC] h-11 text-xs">
                  <td className="px-6 font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                    {entry.timestamp}
                  </td>
                  <td className="px-4 font-semibold text-[#0F172A] whitespace-nowrap">
                    {entry.actor} · <span className="font-normal text-[#64748B]">{entry.role}</span>
                  </td>
                  <td className="px-4 text-[#334155] font-medium whitespace-nowrap">
                    {entry.category}
                  </td>
                  <td className="px-4 text-[#0F172A]">{entry.action}</td>
                  <td className="px-6 text-[#475569] font-mono">{entry.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

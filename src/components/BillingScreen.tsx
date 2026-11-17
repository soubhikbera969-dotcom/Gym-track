import React, { useMemo, useState } from 'react';
import { CreditCard, Download, Plus, RefreshCw, Snowflake, XCircle } from 'lucide-react';
import type { Member, MembershipPlan, TransactionRecord } from '../types/gym';
import { StatusChip } from './StatusChip';

interface BillingScreenProps {
  plans: MembershipPlan[];
  members: Member[];
  transactions: TransactionRecord[];
  onCreatePlan: (plan: MembershipPlan) => void;
  onSubscriptionAction: (memberId: string, action: 'renew' | 'freeze' | 'cancel' | 'retry') => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  plans,
  members,
  transactions,
  onCreatePlan,
  onSubscriptionAction,
}) => {
  const [txnFilter, setTxnFilter] = useState<'All' | TransactionRecord['status']>('All');
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState(295);
  const [planHours, setPlanHours] = useState('All Hours (05:30–22:30)');
  const [planClasses, setPlanClasses] = useState('Unlimited Classes + Recovery');

  const filteredTxns = useMemo(() => {
    if (txnFilter === 'All') return transactions;
    return transactions.filter((t) => t.status === txnFilter);
  }, [transactions, txnFilter]);

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;
    onCreatePlan({
      id: `plan-${Date.now()}`,
      name: planName.trim(),
      price: planPrice,
      billingCycle: 'Monthly',
      accessHours: planHours,
      includedClasses: planClasses,
      activeSubscribers: 0,
    });
    setPlanName('');
    setShowPlanForm(false);
  };

  const handleExportTxns = () => {
    const header = ['TransactionID', 'Member', 'Plan', 'Amount', 'Date', 'Status', 'Method'];
    const rows = filteredTxns.map((t) => [
      t.id,
      `"${t.memberName}"`,
      `"${t.planName}"`,
      String(t.amount),
      t.date,
      t.status,
      `"${t.method}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kinetix-transactions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Membership Plans */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#0F172A]">
              Membership Plans & Pricing Tiers
            </h2>
            <p className="text-xs text-[#64748B]">
              Configured recurring access plans, class allowances, and subscriber distribution
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Plan
          </button>
        </div>

        {showPlanForm && (
          <form onSubmit={handleAddPlan} className="card-resting rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                Plan Title
              </label>
              <input
                type="text"
                required
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Executive Recovery+"
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                Monthly Price ($)
              </label>
              <input
                type="number"
                value={planPrice}
                onChange={(e) => setPlanPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                Access & Classes
              </label>
              <input
                type="text"
                value={planClasses}
                onChange={(e) => setPlanClasses(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Save Plan
              </button>
              <button
                type="button"
                onClick={() => setShowPlanForm(false)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {plans.map((p) => (
            <div key={p.id} className="card-resting rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-semibold text-[#0F172A]">
                    {p.name}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-[#059669] tabular-nums">
                    {p.activeSubscribers} active
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-[#0F172A] tabular-nums">
                    ${p.price}
                  </span>
                  <span className="text-xs text-[#64748B]">/ {p.billingCycle.toLowerCase()}</span>
                </div>
                <p className="mt-3 text-xs text-[#334155]">{p.includedClasses}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] text-[#64748B]">
                Access: {p.accessHours}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Active Subscriptions Table */}
      <section className="card-resting rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F172A]">
              Member Subscriptions & Lifecycle
            </h3>
            <p className="text-xs text-[#64748B]">
              Manage start/end dates, automatic renewals, freezes, and payment recoveries
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Member
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Plan
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Term Window
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Next Renewal
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Payment
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] text-right">
                  Controls
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-[#F8FAFC] h-13">
                  <td className="px-6">
                    <div className="text-sm font-semibold text-[#0F172A]">{m.name}</div>
                    <div className="text-xs text-[#64748B] font-mono tabular-nums">
                      ${m.monthlyRate}/mo
                    </div>
                  </td>
                  <td className="px-4 text-xs font-medium text-[#334155] whitespace-nowrap">
                    {m.subscription.planName}
                  </td>
                  <td className="px-4 text-xs font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                    {m.subscription.startDate} → {m.subscription.endDate}
                  </td>
                  <td className="px-4 text-xs font-mono text-[#0F172A] tabular-nums whitespace-nowrap">
                    {m.subscription.nextRenewal}
                  </td>
                  <td className="px-4 whitespace-nowrap">
                    <StatusChip status={m.subscription.paymentStatus} />
                  </td>
                  <td className="px-6 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {m.subscription.paymentStatus === 'Past Due' && (
                        <button
                          type="button"
                          onClick={() => onSubscriptionAction(m.id, 'retry')}
                          className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                        >
                          <CreditCard className="h-3 w-3" />
                          Retry Charge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSubscriptionAction(m.id, 'renew')}
                        title="Renew 30 days"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#F1F5F9] cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3 text-[#059669]" />
                        Renew
                      </button>
                      <button
                        type="button"
                        onClick={() => onSubscriptionAction(m.id, 'freeze')}
                        title="Freeze subscription"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#F1F5F9] cursor-pointer"
                      >
                        <Snowflake className="h-3 w-3 text-[#2563EB]" />
                        Freeze
                      </button>
                      <button
                        type="button"
                        onClick={() => onSubscriptionAction(m.id, 'cancel')}
                        title="Cancel subscription"
                        className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                      >
                        <XCircle className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Transaction History */}
      <section className="card-resting rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F172A]">
              Transaction History
            </h3>
            <p className="text-xs text-[#64748B]">
              Processed dues, pending corporate invoices, and retry events
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center rounded-full bg-[#F1F5F9] p-1 border border-[#E2E8F0]">
              {(['All', 'Paid', 'Pending', 'Failed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTxnFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full cursor-pointer ${
                    txnFilter === st
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportTxns}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Invoice
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Member
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Plan
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Method
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Date
                </th>
                <th className="px-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Status
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredTxns.map((t) => (
                <tr key={t.id} className="hover:bg-[#F8FAFC] h-12">
                  <td className="px-6 font-mono text-xs text-[#64748B]">{t.id}</td>
                  <td className="px-4 text-sm font-semibold text-[#0F172A]">{t.memberName}</td>
                  <td className="px-4 text-xs text-[#334155]">{t.planName}</td>
                  <td className="px-4 text-xs font-mono text-[#64748B]">{t.method}</td>
                  <td className="px-4 text-xs font-mono text-[#64748B] tabular-nums">{t.date}</td>
                  <td className="px-4">
                    <StatusChip status={t.status} />
                  </td>
                  <td className="px-6 font-mono text-sm font-semibold text-[#0F172A] tabular-nums text-right">
                    ${t.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

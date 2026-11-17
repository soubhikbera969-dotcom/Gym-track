import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Mail,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import type {
  GymNotification,
  Lead,
  Member,
  NotificationCategory,
  NotificationChannel,
  ScreenView,
} from '../types/gym';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: GymNotification[];
  members: Member[];
  leads: Lead[];
  onEvaluateRules: () => Promise<void>;
  onSendNotification: (payload: {
    category: NotificationCategory;
    channel: NotificationChannel;
    severity: 'info' | 'warning' | 'critical';
    recipientName: string;
    recipientEmail: string;
    title: string;
    message: string;
    targetScreen: ScreenView;
  }) => Promise<void>;
  onMarkStatus: (id: string, status: 'read' | 'unread' | 'sent') => Promise<void>;
  onNavigate: (screen: ScreenView) => void;
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  expiring_membership: 'Expiring / Billing',
  upcoming_booking: 'Upcoming Booking',
  waitlist_opening: 'Waitlist Opening',
  overdue_followup: 'Overdue Follow-Up',
  operational_alert: 'Operational Alert',
  custom: 'Direct Reminder',
};

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  onClose,
  notifications,
  members,
  leads,
  onEvaluateRules,
  onSendNotification,
  onMarkStatus,
  onNavigate,
}) => {
  const [filterCat, setFilterCat] = useState<NotificationCategory | 'all'>('all');
  const [evaluating, setEvaluating] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const [recipientSelection, setRecipientSelection] = useState('');
  const [channel, setChannel] = useState<NotificationChannel>('both');
  const [category, setCategory] = useState<NotificationCategory>('custom');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    if (filterCat === 'all') return notifications;
    return notifications.filter((n) => n.category === filterCat);
  }, [notifications, filterCat]);

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  if (!open) return null;

  const handleRunSweep = async () => {
    setEvaluating(true);
    try {
      await onEvaluateRules();
    } finally {
      setEvaluating(false);
    }
  };

  const handleComposerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    const recipientOptions = [
      ...members.map((m) => ({ key: `m:${m.id}`, name: m.name, email: m.email })),
      ...leads.map((l) => ({ key: `l:${l.id}`, name: l.name, email: l.email })),
    ];
    const picked = recipientOptions.find((r) => r.key === recipientSelection);
    const recipientName = picked?.name || 'All Active Members';
    const recipientEmail = picked?.email || 'members@kinetix.club';

    setSending(true);
    try {
      await onSendNotification({
        category,
        channel,
        severity: category === 'operational_alert' ? 'warning' : 'info',
        recipientName,
        recipientEmail,
        title: title.trim(),
        message: message.trim(),
        targetScreen:
          category === 'expiring_membership'
            ? 'billing'
            : category === 'overdue_followup'
            ? 'leads'
            : category === 'upcoming_booking' || category === 'waitlist_opening'
            ? 'schedule'
            : 'overview',
      });
      setTitle('');
      setMessage('');
      setComposerOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/35"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-lg bg-white h-full border-l border-[#E2E8F0] flex flex-col shadow-[0_8px_24px_-4px_rgba(15,23,42,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F172A]">
                Automated Gym Communications
              </h2>
              <p className="text-xs text-[#64748B]">
                {unreadCount} unread · Expirations, bookings, waitlists &amp; alerts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Strip */}
        <div className="px-6 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunSweep}
              disabled={evaluating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${evaluating ? 'animate-spin' : ''}`} />
              {evaluating ? 'Scanning CRM...' : 'Run Rules Check'}
            </button>
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-[#059669]" />
              {composerOpen ? 'Hide Composer' : 'Send Reminder'}
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => onMarkStatus('all', 'read')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669] hover:text-[#047857] cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Manual Reminder Composer */}
        {composerOpen && (
          <form
            onSubmit={handleComposerSubmit}
            className="px-6 py-4 border-b border-[#E2E8F0] bg-white space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Recipient
                </label>
                <select
                  value={recipientSelection}
                  onChange={(e) => setRecipientSelection(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A]"
                >
                  <option value="">All Active Members</option>
                  <optgroup label="Members">
                    {members.map((m) => (
                      <option key={m.id} value={`m:${m.id}`}>
                        {m.name} ({m.tier})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Leads">
                    {leads.map((l) => (
                      <option key={l.id} value={`l:${l.id}`}>
                        {l.name} ({l.stage})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as NotificationChannel)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A]"
                >
                  <option value="both">Email + In-App</option>
                  <option value="email">Email Only</option>
                  <option value="in_app">In-App Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A]"
                >
                  <option value="custom">Direct Reminder</option>
                  <option value="expiring_membership">Expiring Membership</option>
                  <option value="upcoming_booking">Upcoming Booking</option>
                  <option value="waitlist_opening">Waitlist Opening</option>
                  <option value="overdue_followup">Overdue Follow-Up</option>
                  <option value="operational_alert">Operational Alert</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                  Subject / Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Assessment Check-In Reminder"
                  className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-[#0F172A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                Message
              </label>
              <textarea
                rows={2}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the reminder or operational notice..."
                className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-[#0F172A]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#64748B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg bg-[#059669] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60 cursor-pointer"
              >
                {sending ? 'Dispatching...' : 'Dispatch Notification'}
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs */}
        <div className="px-6 py-2.5 border-b border-[#E2E8F0] flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'expiring_membership', label: 'Expiring' },
              { id: 'upcoming_booking', label: 'Bookings' },
              { id: 'waitlist_opening', label: 'Waitlist' },
              { id: 'overdue_followup', label: 'Follow-Ups' },
              { id: 'operational_alert', label: 'Ops Alerts' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterCat(tab.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                filterCat === tab.id
                  ? 'bg-[#0F172A] text-white'
                  : 'text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9]">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#64748B]">
              No notifications in this category. Run a rules check to evaluate upcoming triggers.
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`px-6 py-4 transition-colors ${
                  n.status === 'unread' ? 'bg-[#F8FAFC]' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        n.severity === 'critical'
                          ? 'bg-[#FEF2F2] text-[#B91C1C]'
                          : n.severity === 'warning'
                          ? 'bg-[#FFFBEB] text-[#B45309]'
                          : 'bg-[#ECFDF5] text-[#047857]'
                      }`}
                    >
                      {n.severity === 'critical' || n.severity === 'warning' ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      {CATEGORY_LABELS[n.category]}
                    </span>
                    <span className="text-[11px] font-mono text-[#64748B]">
                      {n.channel === 'both'
                        ? 'Email + In-App'
                        : n.channel === 'email'
                        ? 'Email'
                        : 'In-App'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#94A3B8] shrink-0">
                    {n.createdAt}
                  </span>
                </div>

                <div className="mt-1.5 text-sm font-semibold text-[#0F172A]">{n.title}</div>
                <p className="mt-1 text-xs text-[#475569] leading-relaxed">{n.message}</p>

                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[#64748B] truncate">
                    To: <strong className="font-semibold text-[#334155]">{n.recipientName}</strong>{' '}
                    ({n.recipientEmail})
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(n.targetScreen);
                        onClose();
                      }}
                      className="font-semibold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Open
                    </button>
                    {n.status === 'unread' && (
                      <button
                        type="button"
                        onClick={() => onMarkStatus(n.id, 'read')}
                        className="inline-flex items-center gap-0.5 font-semibold text-[#059669] hover:text-[#047857] cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

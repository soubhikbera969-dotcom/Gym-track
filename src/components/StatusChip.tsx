import React from 'react';

interface StatusChipProps {
  status: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const greenStates = new Set([
    'Active',
    'Operational',
    'Paid',
    'Signed',
    'Converted',
    'On Floor',
    'Scheduled',
  ]);
  const blueStates = new Set([
    'In Use',
    'Active Trial',
    'Tour Booked',
    '7-Day Trial',
    'Proposal Sent',
    'In Session',
    'In Progress',
  ]);
  const amberStates = new Set([
    'At-Risk',
    'Maintenance',
    'Pending',
    'Past Due',
    'New Inquiry',
    'Trial Completed',
    'Paused',
  ]);
  const redStates = new Set(['Failed', 'Cancelled', 'Lost', 'Expired', 'Refunded']);

  let pillClass = 'bg-[#F1F5F9] text-[#475569]';
  let dotClass = 'bg-[#64748B]';

  if (greenStates.has(status)) {
    pillClass = 'bg-[#ECFDF5] text-[#047857]';
    dotClass = 'bg-[#059669]';
  } else if (blueStates.has(status)) {
    pillClass = 'bg-[#EFF6FF] text-[#1D4ED8]';
    dotClass = 'bg-[#2563EB]';
  } else if (amberStates.has(status)) {
    pillClass = 'bg-[#FFFBEB] text-[#B45309]';
    dotClass = 'bg-[#D97706]';
  } else if (redStates.has(status)) {
    pillClass = 'bg-[#FEF2F2] text-[#B91C1C]';
    dotClass = 'bg-[#DC2626]';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase whitespace-nowrap shrink-0 ${pillClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {status}
    </span>
  );
};

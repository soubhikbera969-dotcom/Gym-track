import React from 'react';

interface SparklineStatCardProps {
  label: string;
  value: string;
  delta: string;
  sublabel: string;
  data: number[];
  accent?: 'emerald' | 'cobalt' | 'lime';
}

export const SparklineStatCard: React.FC<SparklineStatCardProps> = ({
  label,
  value,
  delta,
  sublabel,
  data,
  accent = 'emerald',
}) => {
  const strokeColor =
    accent === 'cobalt' ? '#2563EB' : accent === 'lime' ? '#65A30D' : '#059669';
  const fillStart =
    accent === 'cobalt'
      ? 'rgba(37, 99, 235, 0.14)'
      : accent === 'lime'
      ? 'rgba(132, 204, 22, 0.18)'
      : 'rgba(5, 150, 105, 0.14)';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 220;
  const height = 48;
  const padY = 6;

  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const gradId = `spark-${label.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const isPositive = delta.trim().startsWith('+');

  return (
    <div className="card-resting rounded-lg p-6 flex flex-col justify-between transition-shadow duration-150 hover:shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08),0_2px_6px_-2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
          {label}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-[0.03em] tabular-nums whitespace-nowrap shrink-0 ${
            isPositive
              ? 'bg-[#ECFDF5] text-[#059669]'
              : 'bg-[#FFFBEB] text-[#B45309]'
          }`}
        >
          {delta}
        </span>
      </div>

      <div className="mt-3 mb-4 flex items-baseline justify-between gap-2">
        <div className="font-display text-[36px] font-bold leading-[40px] tracking-[-0.03em] text-[#0F172A] tabular-nums">
          {value}
        </div>
        <span className="text-xs text-[#64748B] whitespace-nowrap">{sublabel}</span>
      </div>

      <div className="h-12 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillStart} />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

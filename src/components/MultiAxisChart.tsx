import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ChartPoint, TimeRange } from '../types/gym';

interface MultiAxisChartProps {
  title: string;
  subtitle: string;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  data: ChartPoint[];
}

export const MultiAxisChart: React.FC<MultiAxisChartProps> = ({
  title,
  subtitle,
  range,
  onRangeChange,
  data,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const height = 240;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxCheckIns = Math.max(...data.map((d) => d.checkIns), 10);
  const maxBookings = Math.max(...data.map((d) => d.bookings), 10);
  const yMax = Math.ceil(Math.max(maxCheckIns, maxBookings) * 1.15);

  const getX = (i: number) =>
    padLeft + (i / Math.max(data.length - 1, 1)) * plotW;
  const getY = (val: number) =>
    padTop + plotH - (val / yMax) * plotH;

  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = ((p0.x + p1.x) / 2).toFixed(1);
      d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const checkInPts = data.map((d, i) => ({ x: getX(i), y: getY(d.checkIns) }));
  const bookingPts = data.map((d, i) => ({ x: getX(i), y: getY(d.bookings) }));

  const checkInPath = buildSmoothPath(checkInPts);
  const bookingPath = buildSmoothPath(bookingPts);
  const checkInArea = `${checkInPath} L ${checkInPts[checkInPts.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${checkInPts[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];
  const activePoint = hoverIdx !== null ? data[hoverIdx] : null;
  const activeX = hoverIdx !== null ? getX(hoverIdx) : null;

  return (
    <div className="card-resting rounded-lg p-6 flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-[-0.005em] text-[#0F172A]">
            {title}
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 text-xs text-[#334155]">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-[#059669]" aria-hidden="true" />
              Floor Check-Ins
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-[#2563EB]" aria-hidden="true" />
              Class Bookings
            </span>
          </div>

          <div
            className="inline-flex items-center rounded-full bg-[#F1F5F9] p-1 border border-[#E2E8F0]"
            role="group"
            aria-label="Chart time range"
          >
            {(['7D', '30D', '1Y'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                className={`relative px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === r
                    ? 'text-[#0F172A]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {range === r && (
                  <motion.span
                    layoutId="chart-range-pill"
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 rounded-full bg-white shadow-xs"
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[240px] overflow-visible select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="checkInWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(5, 150, 105, 0.14)" />
              <stop offset="100%" stopColor="rgba(5, 150, 105, 0)" />
            </linearGradient>
          </defs>

          {gridTicks.map((t, idx) => {
            const y = padTop + plotH - t * plotH;
            const val = Math.round(t * yMax);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#64748B] text-[10px] font-mono tabular-nums"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                </text>
              </g>
            );
          })}

          <path d={checkInArea} fill="url(#checkInWash)" />
          <motion.path
            key={`ci-${range}`}
            d={checkInPath}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0.3, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            key={`bk-${range}`}
            d={bookingPath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeDasharray="0"
            initial={{ pathLength: 0.3, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />

          {activeX !== null && activePoint && hoverIdx !== null && (
            <g>
              <line
                x1={activeX}
                y1={padTop}
                x2={activeX}
                y2={padTop + plotH}
                stroke="#CBD5E1"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={checkInPts[hoverIdx].x}
                cy={checkInPts[hoverIdx].y}
                r="4.5"
                fill="#059669"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <circle
                cx={bookingPts[hoverIdx].x}
                cy={bookingPts[hoverIdx].y}
                r="4.5"
                fill="#2563EB"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}

          {data.map((d, i) => {
            const x = getX(i);
            const sliceW = plotW / Math.max(data.length, 1);
            return (
              <g key={d.label}>
                <text
                  x={x}
                  y={height - 6}
                  textAnchor="middle"
                  className={`text-[11px] font-medium ${
                    hoverIdx === i ? 'fill-[#0F172A] font-semibold' : 'fill-[#64748B]'
                  }`}
                >
                  {d.label}
                </text>
                <rect
                  x={x - sliceW / 2}
                  y={padTop}
                  width={sliceW}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>

        <AnimatePresence>
          {activePoint && activeX !== null && (
            <motion.div
              key={activePoint.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none absolute top-2 z-10 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)]"
              style={{
                left: `${Math.min(Math.max((activeX / width) * 100, 12), 78)}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-semibold text-[#0F172A] mb-1">{activePoint.label}</div>
              <div className="flex items-center justify-between gap-4 text-[#334155] tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#059669]" />
                  Check-Ins
                </span>
                <span className="font-mono font-semibold text-[#0F172A]">
                  {activePoint.checkIns.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-[#334155] tabular-nums mt-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                  Bookings
                </span>
                <span className="font-mono font-semibold text-[#0F172A]">
                  {activePoint.bookings.toLocaleString('en-IN')}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

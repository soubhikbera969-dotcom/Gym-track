import React, { useState } from 'react';
import { BarChart3, Box, Download } from 'lucide-react';
import { REPORT_DATASETS } from '../data/gymData';
import type { ReportDomain, TimeRange } from '../types/gym';
import { Analytics3DChart } from './Analytics3DChart';
import { buildSafeCsv } from '../utils/csv';

interface ReportCenterScreenProps {
  facilityName: string;
  onAuditExport: (domain: ReportDomain) => void;
}

const DOMAIN_TABS: { id: ReportDomain; label: string }[] = [
  { id: 'membership', label: 'Membership' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'retention', label: 'Retention' },
  { id: 'sales', label: 'Sales & Pipeline' },
];

export const ReportCenterScreen: React.FC<ReportCenterScreenProps> = ({
  facilityName,
  onAuditExport,
}) => {
  const [domain, setDomain] = useState<ReportDomain>('membership');
  const [compareRange, setCompareRange] = useState<TimeRange>('30D');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const dataset = REPORT_DATASETS[domain];
  const scaleFactor = compareRange === '7D' ? 0.35 : compareRange === '1Y' ? 1.85 : 1.0;

  const scaledCategories = dataset.categories.map((c) => {
    if (domain === 'retention') return c;
    return {
      ...c,
      current: Number((c.current * scaleFactor).toFixed(1)),
      prior: Number((c.prior * scaleFactor).toFixed(1)),
    };
  });

  const maxVal = Math.max(...scaledCategories.flatMap((c) => [c.current, c.prior]), 1);
  const activeCategory = scaledCategories[selectedIdx] ?? scaledCategories[0];

  const handleExportSummary = () => {
    const headers = ['Category', 'CurrentPeriod', 'PriorPeriod', 'VariancePct', 'Notes'];
    const rows = scaledCategories.map((c) => {
      const variance = (((c.current - c.prior) / Math.max(c.prior, 1)) * 100).toFixed(1);
      return [
        c.label,
        c.current,
        c.prior,
        `${variance}%`,
        c.note,
      ];
    });
    const csv = buildSafeCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinetix-${domain}-report-${compareRange.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onAuditExport(domain);
  };

  return (
    <div className="space-y-6">
      {/* Filter & Date Comparison Bar */}
      <div className="card-resting rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Report dataset category"
        >
          {DOMAIN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setDomain(t.id);
                setSelectedIdx(0);
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                domain === t.id
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex items-center rounded-full bg-[#F1F5F9] p-1 border border-[#E2E8F0]">
            {(['7D', '30D', '1Y'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setCompareRange(r)}
                className={`px-3 py-1 text-xs font-semibold rounded-full cursor-pointer ${
                  compareRange === r
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {r} vs Prior
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportSummary}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export Summary
          </button>
        </div>
      </div>

      {/* Narrative Analytical Explanation Strip */}
      <div className="card-resting rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-display text-xl font-semibold text-[#0F172A]">
              {dataset.title}
            </h2>
            <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
              {dataset.highlightDelta}
            </span>
          </div>
          <p className="text-sm text-[#334155] mt-1.5 leading-relaxed">
            {dataset.explanation}
          </p>
        </div>
        <div className="text-right text-xs text-[#64748B]">
          <div>Scope: {facilityName}</div>
          <div className="font-mono mt-0.5">Window: {compareRange} Comparative</div>
        </div>
      </div>

      {/* Synchronized 2D & 3D Interactive Explanations */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Interactive 2D Comparative Chart */}
        <div className="xl:col-span-6 card-resting rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#059669]" />
              <h3 className="font-display text-base font-semibold text-[#0F172A]">
                2D Comparative Distribution ({dataset.unit})
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#64748B]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#059669]" />
                Current
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                Prior
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {scaledCategories.map((c, idx) => {
              const currW = (c.current / maxVal) * 100;
              const priorW = (c.prior / maxVal) * 100;
              const diffPct = (((c.current - c.prior) / Math.max(c.prior, 1)) * 100).toFixed(1);
              const isSelected = selectedIdx === idx;

              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full text-left rounded-lg p-3 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#059669] bg-[#ECFDF5]/40'
                      : 'border-[#F1F5F9] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-[#0F172A]">{c.label}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-[#059669] font-semibold">
                        {c.current} {dataset.unit}
                      </span>
                      <span className="text-[#64748B]">vs {c.prior}</span>
                      <span className="text-[#047857] font-semibold">
                        {Number(diffPct) >= 0 ? `+${diffPct}%` : `${diffPct}%`}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#059669] transition-all duration-200"
                        style={{ width: `${Math.min(currW, 100)}%` }}
                      />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2563EB]/75 transition-all duration-200"
                        style={{ width: `${Math.min(priorW, 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive 3D Three.js Analytical Graph */}
        <div className="xl:col-span-6 card-resting rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-[#2563EB]" />
              <h3 className="font-display text-base font-semibold text-[#0F172A]">
                3D Spatial Metric Comparison
              </h3>
            </div>
            <span className="text-xs text-[#64748B]">Drag to orbit · Click pillar to inspect</span>
          </div>

          <Analytics3DChart
            title={dataset.title}
            unit={dataset.unit}
            categories={scaledCategories}
            selectedIdx={selectedIdx}
            onSelectIdx={setSelectedIdx}
          />

          {activeCategory && (
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0F172A]">
                Selected Insight · {activeCategory.label}
              </span>
              <span className="text-[#475569]">{activeCategory.note}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

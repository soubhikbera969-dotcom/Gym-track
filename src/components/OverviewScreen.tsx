import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarPlus,
  Thermometer,
  UserCheck,
  UserPlus,
  Users,
  Wind,
} from 'lucide-react';
import { ANALYTICS_SERIES, KPI_SPARKS } from '../data/gymData';
import type {
  AuditEntry,
  CheckInLog,
  Facility,
  GymAlert,
  GymZone,
  ScreenView,
  TimeRange,
  UserRole,
  ZoneId,
} from '../types/gym';
import { GymFloor3D } from './GymFloor3D';
import { MemberAvatar } from './MemberAvatar';
import { MultiAxisChart } from './MultiAxisChart';
import { SparklineStatCard } from './SparklineStatCard';

interface OverviewScreenProps {
  activeRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  facility: Facility;
  zones: GymZone[];
  selectedZone: ZoneId | 'all';
  onSelectZone: (zone: ZoneId | 'all') => void;
  chartRange: TimeRange;
  onChartRangeChange: (range: TimeRange) => void;
  recentCheckIns: CheckInLog[];
  alerts: GymAlert[];
  recentAudit: AuditEntry[];
  activeMemberCount: number;
  mrrTotal: number;
  todayCheckIns: number;
  openLeadsCount: number;
  onNavigate: (view: ScreenView) => void;
  onOpenCheckInModal: () => void;
  onOpenAddMember: () => void;
  onOpenScheduleModal: () => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  activeRole,
  onChangeRole,
  facility,
  zones,
  selectedZone,
  onSelectZone,
  chartRange,
  onChartRangeChange,
  recentCheckIns,
  alerts,
  recentAudit,
  activeMemberCount,
  mrrTotal,
  todayCheckIns,
  openLeadsCount,
  onNavigate,
  onOpenCheckInModal,
  onOpenAddMember,
  onOpenScheduleModal,
}) => {
  const totalOccupancy = zones.reduce((acc, z) => acc + z.occupancy, 0);
  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0);
  const utilizationPct =
    totalCapacity > 0 ? ((totalOccupancy / totalCapacity) * 100).toFixed(1) : '0.0';

  const roleAlerts = alerts.filter((a) => a.roles.includes(activeRole));
  const focusedZone =
    selectedZone === 'all' ? null : zones.find((z) => z.id === selectedZone) ?? null;

  return (
    <div className="space-y-8">
      {/* Role-Based Command Strip & Quick Actions */}
      <section className="card-resting rounded-xl p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
            Workspace View
          </span>
          <div
            className="inline-flex items-center rounded-full bg-[#F1F5F9] p-1 border border-[#E2E8F0]"
            role="group"
            aria-label="Operator Role View"
          >
            {(['Director', 'Front Desk', 'Coach', 'Sales'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onChangeRole(role)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeRole === role
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCheckInModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Gate Check-In
          </button>
          <button
            type="button"
            onClick={onOpenAddMember}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="h-3.5 w-3.5 text-[#059669]" />
            Enroll Member
          </button>
          <button
            type="button"
            onClick={onOpenScheduleModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-[#2563EB]" />
            New Session
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap"
          >
            <Activity className="h-3.5 w-3.5 text-[#65A30D]" />
            Report Center
          </button>
        </div>
      </section>

      {/* KPI Metric Stat Row */}
      <section aria-label="Key Performance Metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <SparklineStatCard
            label={activeRole === 'Sales' ? 'Open Pipeline Leads' : 'Active Members'}
            value={
              activeRole === 'Sales'
                ? openLeadsCount.toLocaleString()
                : activeMemberCount.toLocaleString()
            }
            delta={facility.membersDelta}
            sublabel={activeRole === 'Sales' ? '44% trial conv.' : 'vs 30d prior'}
            data={KPI_SPARKS.members}
            accent="emerald"
          />
          <SparklineStatCard
            label="Today's Check-Ins"
            value={todayCheckIns.toLocaleString()}
            delta={facility.checkInsDelta}
            sublabel="doors open 05:30"
            data={[...KPI_SPARKS.checkIns.slice(0, -1), todayCheckIns]}
            accent="cobalt"
          />
          <SparklineStatCard
            label="Monthly Recurring"
            value={`$${mrrTotal.toLocaleString()}`}
            delta={facility.mrrDelta}
            sublabel="net retention 97.4%"
            data={KPI_SPARKS.mrr}
            accent="emerald"
          />
          <SparklineStatCard
            label="Floor Utilization"
            value={`${utilizationPct}%`}
            delta={facility.utilizationDelta}
            sublabel={`${totalOccupancy} of ${totalCapacity} spots`}
            data={[...KPI_SPARKS.utilization.slice(0, -1), Number(utilizationPct)]}
            accent="lime"
          />
        </div>
      </section>

      {/* Role-Tailored Operational Alerts + Recent Activity Strip */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 card-resting rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#D97706]" />
              <h2 className="font-display text-base font-semibold text-[#0F172A]">
                Priority Alerts · {activeRole}
              </h2>
            </div>
            <span className="font-mono text-xs text-[#64748B] tabular-nums">
              {roleAlerts.length} active
            </span>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {roleAlerts.map((al) => (
              <div
                key={al.id}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        al.severity === 'critical'
                          ? 'bg-[#DC2626]'
                          : al.severity === 'warning'
                          ? 'bg-[#D97706]'
                          : 'bg-[#2563EB]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-[#0F172A] truncate">
                      {al.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5 pl-4">{al.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(al.targetScreen)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:bg-[#F1F5F9] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Resolve <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 card-resting rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              Recent CRM Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
            >
              Audit Trail
            </button>
          </div>
          <div className="divide-y divide-[#F1F5F9] flex-1">
            {recentAudit.slice(0, 4).map((aud) => (
              <div
                key={aud.id}
                className="px-6 py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#F8FAFC]"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#0F172A] truncate">
                    {aud.action} · <span className="text-[#059669]">{aud.target}</span>
                  </div>
                  <div className="text-[#64748B] mt-0.5">
                    {aud.actor} ({aud.role})
                  </div>
                </div>
                <span className="font-mono text-[#64748B] tabular-nums shrink-0">
                  {aud.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3D Gym Floor Viewport Frame + Zone Telemetry Strip */}
      <section className="card-resting rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-[-0.005em] text-[#0F172A]">
              Live 3D Facility Telemetry
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {facility.name} · {facility.neighborhood} · Click any zone in 3D or below to inspect
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('floor')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Floor & Access Logs
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-[#F8FAFC]/50">
          <GymFloor3D
            zones={zones}
            selectedZone={selectedZone}
            onSelectZone={onSelectZone}
            totalOccupancy={totalOccupancy}
            maxCapacity={totalCapacity}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E8F0] border-t border-[#E2E8F0] bg-white">
          {zones.map((z) => {
            const pct = Math.round((z.occupancy / z.capacity) * 100);
            const isActive = selectedZone === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => onSelectZone(isActive ? 'all' : z.id)}
                className={`text-left px-6 py-4 transition-colors cursor-pointer ${
                  isActive ? 'bg-[#ECFDF5]/60' : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#0F172A] truncate">
                    {z.name}
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#059669] tabular-nums shrink-0">
                    {pct}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor:
                        pct >= 85 ? '#84CC16' : pct >= 60 ? '#059669' : '#2563EB',
                    }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#64748B] tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {z.occupancy}/{z.capacity} active
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5">
                      <Thermometer className="h-3 w-3" />
                      {z.tempF}°F
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Wind className="h-3 w-3" />
                      {z.co2Ppm} ppm
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {focusedZone && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#334155]">
              <span className="font-semibold text-[#0F172A]">{focusedZone.name}</span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                ·
              </span>
              <span>
                Program:{' '}
                <strong className="font-semibold text-[#0F172A]">
                  {focusedZone.currentProgram}
                </strong>
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                ·
              </span>
              <span>Lead: {focusedZone.activeCoach}</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectZone('all')}
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer whitespace-nowrap"
            >
              Reset Focus
            </button>
          </div>
        )}
      </section>

      {/* Analytical Chart + Recent Check-Ins Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 xl:col-span-8">
          <MultiAxisChart
            title="Attendance & Studio Booking Velocity"
            subtitle="Comparison of gate access check-ins against reserved studio capacity"
            range={chartRange}
            onRangeChange={onChartRangeChange}
            data={ANALYTICS_SERIES[chartRange]}
          />
        </div>

        <div className="lg:col-span-5 xl:col-span-4 card-resting rounded-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-display text-lg font-semibold tracking-[-0.005em] text-[#0F172A]">
                Recent Check-Ins
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">Live gate access stream</p>
            </div>
            <button
              type="button"
              onClick={onOpenCheckInModal}
              className="text-xs font-semibold text-[#059669] hover:text-[#047857] cursor-pointer whitespace-nowrap"
            >
              + Log Entry
            </button>
          </div>

          <div className="divide-y divide-[#F1F5F9] flex-1">
            {recentCheckIns.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MemberAvatar
                    name={log.memberName}
                    initials={log.memberInitials}
                    src={log.memberAvatar}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#0F172A] truncate">
                      {log.memberName}
                    </div>
                    <div className="text-xs text-[#64748B] truncate">
                      {log.zoneName} · {log.tier}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs text-[#475569] tabular-nums whitespace-nowrap shrink-0">
                  {log.timestamp}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E2E8F0] px-6 py-3 bg-[#F8FAFC]">
            <button
              type="button"
              onClick={() => onNavigate('members')}
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
            >
              View full member ledger
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

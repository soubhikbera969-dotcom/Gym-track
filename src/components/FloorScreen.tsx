import React, { useMemo, useState } from 'react';
import { Minus, Plus, Search, Thermometer, Users, Wind, Wrench } from 'lucide-react';
import type { CheckInLog, EquipmentItem, EquipmentStatus, GymZone, ZoneId } from '../types/gym';
import { GymFloor3D } from './GymFloor3D';
import { MemberAvatar } from './MemberAvatar';
import { StatusChip } from './StatusChip';
import { formatTempC } from '../utils/units';

interface FloorScreenProps {
  facilityName: string;
  zones: GymZone[];
  selectedZone: ZoneId | 'all';
  onSelectZone: (zone: ZoneId | 'all') => void;
  onAdjustOccupancy: (zoneId: ZoneId, delta: number) => void;
  equipment: EquipmentItem[];
  onCycleEquipmentStatus: (equipmentId: string) => void;
  checkIns: CheckInLog[];
  onOpenCheckInModal: () => void;
}

export const FloorScreen: React.FC<FloorScreenProps> = ({
  facilityName,
  zones,
  selectedZone,
  onSelectZone,
  onAdjustOccupancy,
  equipment,
  onCycleEquipmentStatus,
  checkIns,
  onOpenCheckInModal,
}) => {
  const [logQuery, setLogQuery] = useState('');
  const [logZoneFilter, setLogZoneFilter] = useState<'all' | ZoneId>('all');

  const totalOccupancy = zones.reduce((acc, z) => acc + z.occupancy, 0);
  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0);

  const visibleEquipment =
    selectedZone === 'all'
      ? equipment
      : equipment.filter((item) => item.zoneId === selectedZone);

  const filteredCheckIns = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    return checkIns.filter((c) => {
      const matchesQ =
        !q ||
        c.memberName.toLowerCase().includes(q) ||
        c.zoneName.toLowerCase().includes(q) ||
        c.tier.toLowerCase().includes(q);
      const matchesZone = logZoneFilter === 'all' || c.zoneId === logZoneFilter;
      return matchesQ && matchesZone;
    });
  }, [checkIns, logQuery, logZoneFilter]);

  const activeZoneObj =
    selectedZone === 'all' ? null : zones.find((z) => z.id === selectedZone) ?? null;

  const nextStatusLabel: Record<EquipmentStatus, EquipmentStatus> = {
    Operational: 'In Use',
    'In Use': 'Maintenance',
    Maintenance: 'Operational',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* 3D Viewport */}
        <div className="xl:col-span-8 card-resting rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#0F172A]">
                Spatial Floor Telemetry · {facilityName}
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Drag to orbit · Scroll to zoom · Click any zone footprint to isolate equipment bays
              </p>
            </div>
            <div className="text-xs font-mono font-semibold text-[#059669] tabular-nums">
              {totalOccupancy} / {totalCapacity} Total Occupancy
            </div>
          </div>
          <div className="p-4 sm:p-5 bg-[#F8FAFC]/60">
            <GymFloor3D
              zones={zones}
              selectedZone={selectedZone}
              onSelectZone={onSelectZone}
              totalOccupancy={totalOccupancy}
              maxCapacity={totalCapacity}
              heightClass="h-[420px] sm:h-[480px] lg:h-[520px]"
            />
          </div>
        </div>

        {/* Zone Environmental & Capacity Controls */}
        <div className="xl:col-span-4 card-resting rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-[#0F172A]">
                {activeZoneObj ? activeZoneObj.name : 'All Facility Zones'}
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                {activeZoneObj
                  ? activeZoneObj.description
                  : 'Select a zone to inspect climate telemetry and adjust live headcount.'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {zones.map((z) => {
              const isSelected = selectedZone === z.id;
              const pct = Math.round((z.occupancy / z.capacity) * 100);
              return (
                <div
                  key={z.id}
                  className={`px-6 py-4 transition-colors ${
                    isSelected ? 'bg-[#ECFDF5]/50' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectZone(isSelected ? 'all' : z.id)}
                      className="text-sm font-semibold text-[#0F172A] hover:text-[#059669] transition-colors cursor-pointer text-left"
                    >
                      {z.name}
                    </button>
                    <span className="font-mono text-xs font-semibold text-[#334155] tabular-nums">
                      {z.occupancy}/{z.capacity} ({pct}%)
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

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-[#64748B] tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5" />
                        {formatTempC(z.tempF)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Wind className="h-3.5 w-3.5" />
                        {z.co2Ppm} ppm
                      </span>
                      <span className="inline-flex items-center gap-1 truncate max-w-[110px]">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        {z.activeCoach}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAdjustOccupancy(z.id, -1)}
                        disabled={z.occupancy <= 0}
                        aria-label={`Decrease ${z.shortName} occupancy`}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-40 cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdjustOccupancy(z.id, 1)}
                        disabled={z.occupancy >= z.capacity}
                        aria-label={`Increase ${z.shortName} occupancy`}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Searchable Check-In & Attendance Logs */}
      <div className="card-resting rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F172A]">
              Check-In & Attendance Logs
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Searchable gate access records and real-time zone occupancy attribution
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="Search member or tier..."
                className="rounded-lg border border-[#E2E8F0] bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#059669]"
              />
            </div>
            <select
              value={logZoneFilter}
              onChange={(e) => setLogZoneFilter(e.target.value as 'all' | ZoneId)}
              aria-label="Filter check-ins by zone"
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155]"
            >
              <option value="all">All Zones</option>
              <option value="lifting">Olympic Lifting</option>
              <option value="cardio">Cardio Row</option>
              <option value="studio">Studio A</option>
              <option value="recovery">Recovery Suite</option>
            </select>
            <button
              type="button"
              onClick={onOpenCheckInModal}
              className="rounded-lg bg-[#059669] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
            >
              + Log Check-In
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                <th className="px-6 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Member
                </th>
                <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Membership Tier
                </th>
                <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Zone Checked In
                </th>
                <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Date
                </th>
                <th className="px-6 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B] text-right">
                  Gate Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredCheckIns.map((log) => (
                <tr key={log.id} className="hover:bg-[#F8FAFC] h-12">
                  <td className="px-6">
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar
                        name={log.memberName}
                        initials={log.memberInitials}
                        src={log.memberAvatar}
                        size="sm"
                      />
                      <span className="text-sm font-semibold text-[#0F172A]">
                        {log.memberName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 text-xs text-[#334155]">{log.tier}</td>
                  <td className="px-4 text-xs font-semibold text-[#059669]">{log.zoneName}</td>
                  <td className="px-4 text-xs font-mono text-[#64748B] tabular-nums">{log.date}</td>
                  <td className="px-6 text-xs font-mono font-semibold text-[#0F172A] tabular-nums text-right">
                    {log.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment Bay Telemetry Table */}
      <div className="card-resting rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F172A]">
              Equipment & Asset Status
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              {selectedZone === 'all'
                ? 'Showing all 12 monitored equipment bays'
                : `Filtered to ${activeZoneObj?.name ?? selectedZone}`}
            </p>
          </div>
          {selectedZone !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectZone('all')}
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
            >
              Show All Zones
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-10">
                <th className="px-6 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Asset
                </th>
                <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Bay
                </th>
                <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Status
                </th>
                <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B] text-right">
                  Cycles Today
                </th>
                <th className="px-4 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B]">
                  Last Serviced
                </th>
                <th className="px-6 text-[11px] font-bold tracking-[0.05em] uppercase text-[#64748B] text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {visibleEquipment.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors h-12">
                  <td className="px-6 text-sm font-semibold text-[#0F172A] whitespace-nowrap">
                    {item.name}
                  </td>
                  <td className="px-4 text-xs text-[#64748B] font-mono whitespace-nowrap">
                    {item.bay}
                  </td>
                  <td className="px-4 whitespace-nowrap">
                    <StatusChip status={item.status} />
                  </td>
                  <td className="px-4 text-sm font-mono text-[#0F172A] tabular-nums text-right whitespace-nowrap">
                    {item.cyclesToday}
                  </td>
                  <td className="px-4 text-xs font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                    {item.lastServiced}
                  </td>
                  <td className="px-6 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onCycleEquipmentStatus(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                    >
                      <Wrench className="h-3 w-3 text-[#64748B]" />
                      Set {nextStatusLabel[item.status]}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

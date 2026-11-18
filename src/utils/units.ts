import type { MembershipTier } from '../types/gym.ts';

export const TIER_RATES_INR: Record<MembershipTier, number> = {
  'Performance Unlimited': 6500,
  'Corporate Athlete': 5500,
  'Studio + Floor': 4800,
  'Off-Peak Lab': 3500,
};

export function formatInr(amount: number, decimals = 0): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₹${safe.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatNumberIn(val: number): string {
  return (Number.isFinite(val) ? val : 0).toLocaleString('en-IN');
}

export function toCelsius(tempVal: number): number {
  if (!Number.isFinite(tempVal)) return 20.0;
  return tempVal > 45
    ? Number((((tempVal - 32) * 5) / 9).toFixed(1))
    : Number(tempVal.toFixed(1));
}

export function formatTempC(tempVal: number): string {
  return `${toCelsius(tempVal).toFixed(1)}°C`;
}

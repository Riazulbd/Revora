import type { IsoDate, MaintenanceRule, MaintenanceStatusKind } from '@/types';
import { addDays, daysBetween, todayIso } from '@/utils/date';

/**
 * Maintenance scheduling.
 *
 * A rule can be distance-based, time-based, or both. When both are set the rule
 * falls due at whichever comes first, and the reported status is the more urgent
 * of the two.
 */

export type MaintenanceStatus = {
  kind: MaintenanceStatusKind;
  /** Odometer the rule next falls due at, in metres. Null for time-only rules. */
  dueAtMetres: number | null;
  /** Metres still to run. Negative when overdue. */
  remainingMetres: number | null;
  dueOnDate: IsoDate | null;
  /** Days still to run. Negative when overdue. */
  remainingDays: number | null;
  /** True when the rule has never been completed, so nothing can be projected. */
  neverCompleted: boolean;
};

/** Rules are "due soon" inside the warn-ahead window, and "upcoming" at twice it. */
const UPCOMING_MULTIPLIER = 2;

function worse(a: MaintenanceStatusKind, b: MaintenanceStatusKind): MaintenanceStatusKind {
  const rank: Record<MaintenanceStatusKind, number> = {
    overdue: 4,
    due_soon: 3,
    upcoming: 2,
    good: 1,
    unknown: 0,
  };
  return rank[a] >= rank[b] ? a : b;
}

function kindFromRemaining(remaining: number, warnAhead: number): MaintenanceStatusKind {
  if (remaining < 0) return 'overdue';
  if (remaining <= warnAhead) return 'due_soon';
  if (remaining <= warnAhead * UPCOMING_MULTIPLIER) return 'upcoming';
  return 'good';
}

export function calculateMaintenanceStatus(
  rule: MaintenanceRule,
  currentOdometerMetres: number | null,
  today: IsoDate = todayIso(),
): MaintenanceStatus {
  const neverCompleted = rule.lastCompletedMetres === null && rule.lastCompletedDate === null;

  let kind: MaintenanceStatusKind = 'unknown';
  let dueAtMetres: number | null = null;
  let remainingMetres: number | null = null;
  let dueOnDate: IsoDate | null = null;
  let remainingDays: number | null = null;

  if (rule.intervalMetres !== null && rule.lastCompletedMetres !== null) {
    dueAtMetres = rule.lastCompletedMetres + rule.intervalMetres;
    if (currentOdometerMetres !== null) {
      remainingMetres = dueAtMetres - currentOdometerMetres;
      kind = worse(kind, kindFromRemaining(remainingMetres, rule.warnAheadMetres));
    }
  }

  if (rule.intervalDays !== null && rule.lastCompletedDate !== null) {
    dueOnDate = addDays(rule.lastCompletedDate, rule.intervalDays);
    remainingDays = daysBetween(today, dueOnDate);
    kind = worse(kind, kindFromRemaining(remainingDays, rule.warnAheadDays));
  }

  return { kind, dueAtMetres, remainingMetres, dueOnDate, remainingDays, neverCompleted };
}

export const STATUS_LABEL: Record<MaintenanceStatusKind, string> = {
  overdue: 'OVERDUE',
  due_soon: 'DUE SOON',
  upcoming: 'UPCOMING',
  good: 'GOOD',
  unknown: 'NOT SET',
};

export type MaintenanceCounts = {
  overdue: number;
  due_soon: number;
  upcoming: number;
  good: number;
  unknown: number;
};

export function countByStatus(statuses: readonly MaintenanceStatus[]): MaintenanceCounts {
  const counts: MaintenanceCounts = { overdue: 0, due_soon: 0, upcoming: 0, good: 0, unknown: 0 };
  for (const s of statuses) counts[s.kind] += 1;
  return counts;
}

/** Sort order for the rules list: most urgent first, then by name. */
export function compareByUrgency(
  a: { status: MaintenanceStatus; rule: MaintenanceRule },
  b: { status: MaintenanceStatus; rule: MaintenanceRule },
): number {
  const rank: Record<MaintenanceStatusKind, number> = {
    overdue: 0,
    due_soon: 1,
    upcoming: 2,
    good: 3,
    unknown: 4,
  };
  const byKind = rank[a.status.kind] - rank[b.status.kind];
  if (byKind !== 0) return byKind;

  const ar = a.status.remainingMetres;
  const br = b.status.remainingMetres;
  if (ar !== null && br !== null && ar !== br) return ar - br;

  return a.rule.name.localeCompare(b.rule.name);
}

/**
 * Default rules seeded for a new motorcycle. Distances are in metres, so
 * 1,000 km is 1_000_000.
 */
export const DEFAULT_RULES: readonly {
  name: string;
  intervalMetres: number | null;
  intervalDays: number | null;
  warnAheadMetres: number;
  warnAheadDays: number;
}[] = [
  { name: 'Engine oil & filter', intervalMetres: 3_000_000, intervalDays: 180, warnAheadMetres: 300_000, warnAheadDays: 14 },
  { name: 'Chain clean, lube & tension', intervalMetres: 500_000, intervalDays: 14, warnAheadMetres: 100_000, warnAheadDays: 3 },
  { name: 'Tyre pressure & tread', intervalMetres: 1_000_000, intervalDays: 30, warnAheadMetres: 200_000, warnAheadDays: 7 },
  { name: 'Air filter', intervalMetres: 6_000_000, intervalDays: 365, warnAheadMetres: 500_000, warnAheadDays: 30 },
  { name: 'Brake pads & fluid', intervalMetres: 8_000_000, intervalDays: 365, warnAheadMetres: 800_000, warnAheadDays: 30 },
];

/** A sensible warn-ahead when the rider has not chosen one: 20% of the interval. */
export function defaultWarnAheadMetres(intervalMetres: number): number {
  return Math.max(50_000, Math.round(intervalMetres * 0.2));
}

export function defaultWarnAheadDays(intervalDays: number): number {
  return Math.max(1, Math.round(intervalDays * 0.2));
}

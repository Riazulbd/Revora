import type { IsoDate, MaintenanceRule, MaintenanceStatusKind } from '@/types';
import { addDays, daysBetween, todayIso } from '@/utils/date';

/**
 * Maintenance scheduling.
 *
 * A rule can be distance-based, time-based, or both. When both are set the rule
 * falls due at whichever comes first, and the reported status is the more urgent
 * of the two.
 *
 * ## Where the boundaries fall
 *
 * `remaining` is what is left to run — metres on the distance side, days on the
 * time side — and the same four bands apply to both:
 *
 * | remaining                          | status      |
 * | ---------------------------------- | ----------- |
 * | `< 0`                              | `overdue`   |
 * | `0` … `warnAhead`                  | `due_soon`  |
 * | `warnAhead + 1` … `2 × warnAhead`  | `upcoming`  |
 * | beyond that                        | `good`      |
 *
 * **Exactly zero is `due_soon`, not `overdue`**, and that is a decision rather
 * than an accident of the comparison. A rule with zero remaining has run its
 * interval and not a metre or a day more: it is due *now*. Calling that overdue
 * would put 'OVERDUE' on a rider's screen on the very kilometre the service came
 * due, accusing them of neglect for something they are not yet late for. Overdue
 * begins at −1: the first metre ridden, or the first day passed, beyond the due
 * point. Both boundaries are pinned in maintenance.test.ts.
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
  // Strictly less than zero: standing exactly on the due point is due, not late.
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

/**
 * How much of the interval has been used up, 0–1, on whichever of distance
 * and time is closer to falling due — the Maintenance list's track under each
 * rule. Overdue clamps to 1. Null when nothing can be measured: a rule never
 * completed, or one without a current odometer to measure against.
 */
export function maintenanceProgress(rule: MaintenanceRule, status: MaintenanceStatus): number | null {
  if (status.neverCompleted || status.kind === 'unknown') return null;
  const byDistance =
    status.remainingMetres !== null && rule.intervalMetres !== null && rule.intervalMetres > 0
      ? status.remainingMetres / rule.intervalMetres
      : null;
  const byTime =
    status.remainingDays !== null && rule.intervalDays !== null && rule.intervalDays > 0
      ? status.remainingDays / rule.intervalDays
      : null;
  const remaining = byDistance === null ? byTime : byTime === null ? byDistance : Math.min(byDistance, byTime);
  if (remaining === null) return null;
  return Math.max(0, Math.min(1, 1 - remaining));
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

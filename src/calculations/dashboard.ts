import type { DistanceUnit, IsoDate, LedgerEntry, LedgerSource, MaintenanceRule, MileageUnit } from '@/types';
import { compareByUrgency, type MaintenanceStatus } from './maintenance';
import type { MileageInterval } from './mileage';
import { efficiencyToDisplay } from './units';
import {
  INITIAL_ODOMETER_POINT_ID,
  STORED_ODOMETER_POINT_ID,
  type OdometerPoint,
} from './odometer';
import { daysBetween, formatShortDate, isoToDate } from '@/utils/date';
import { formatDistance } from '@/utils/format';

/**
 * The figures the Dashboard board prints that no other screen needed.
 *
 * Every one of them is a pure function of records the rider logged. They live
 * here rather than in the screen for the usual reason: the Dashboard's "last
 * ride 86 km" and the odometer history's own arithmetic must never be able to
 * disagree, and a figure that can be wrong deserves a test rather than a
 * render.
 *
 * Nothing here is stored. Each call recomputes from the points and rules it is
 * handed, so editing an old record cannot leave a stale figure behind.
 */

/**
 * How far the bike ran between the two most recent odometer points — the
 * board's "last ride 86 km".
 *
 * Points arrive newest first (`buildOdometerHistory`). A single point is not a
 * ride, and neither is a pair that did not move, so both give null rather than
 * a zero that would read as "you went nowhere".
 */
export function lastRideMetres(points: readonly OdometerPoint[]): number | null {
  if (points.length < 2) return null;
  const gap = points[0]!.metres - points[1]!.metres;
  return gap > 0 ? gap : null;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * `'Tue 16 Sep'` — the date beside the bike's model in the Dashboard header.
 *
 * Built through `isoToDate`, which reads a calendar date as local midnight, so
 * the weekday can never slip a day either side of the international date line.
 */
export function weekdayDate(value: IsoDate): string {
  return `${WEEKDAY[isoToDate(value).getDay()] ?? ''} ${formatShortDate(value)}`;
}

/**
 * `'today'`, `'yesterday'`, `'3 days ago'` — the phrase the board's odometer
 * and mileage lines are built from. A future date (a fill logged ahead) reads
 * as `'today'` rather than claiming a negative age.
 */
export function agoPhrase(date: IsoDate, today: IsoDate): string {
  const days = daysBetween(date, today);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * The compact form the LAST FILL tile uses: `'Today'`, `'3d ago'`. Beyond a
 * month the figure stops being a useful interval, so it gives the number of
 * weeks instead of a three-digit day count.
 */
export function compactAgo(date: IsoDate, today: IsoDate): string {
  const days = daysBetween(date, today);
  if (days <= 0) return 'Today';
  if (days < 28) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * The line under the odometer figure.
 *
 * Three shapes, because three different things can be true: the reading came
 * from a record ("Updated 3 days ago · last ride 86 km"), it is still the
 * figure typed during setup ("From setup · today"), or nothing has been
 * recorded at all.
 */
export function odometerUpdatedLine(input: {
  latest: OdometerPoint | null;
  lastRideMetres: number | null;
  distanceUnit: DistanceUnit;
  today: IsoDate;
}): string {
  const { latest } = input;
  if (latest === null) return 'No reading logged yet';

  const when = agoPhrase(latest.date, input.today);
  const fromSetup = latest.id === INITIAL_ODOMETER_POINT_ID || latest.id === STORED_ODOMETER_POINT_ID;
  if (fromSetup) return `From setup · ${when}`;

  const ride =
    input.lastRideMetres === null
      ? ''
      : ` · last ride ${formatDistance(input.lastRideMetres, input.distanceUnit)}`;
  return `Updated ${when}${ride}`;
}

/**
 * The board's note under the cost-per-distance tile: the figure is shown, and
 * the log it rests on is named beside it. Null once the log is long enough for
 * one purchase to stop moving it.
 */
export function costPerDistanceNote(input: {
  trackedMetres: number;
  settledMetres: number;
  distanceUnit: DistanceUnit;
}): string | null {
  if (input.trackedMetres >= input.settledMetres) return null;
  return (
    `Cost / ${input.distanceUnit} is based on ${formatDistance(input.trackedMetres, input.distanceUnit)} ` +
    'of logging so far — it settles as your log grows.'
  );
}

export type MaintenanceEntry = { rule: MaintenanceRule; status: MaintenanceStatus };

export type MaintenanceHighlights = {
  /** The rules worth a row: the most urgent ones that are not simply fine. */
  shown: MaintenanceEntry[];
  /** Everything else, which the board sums up as "4 other rules OK". */
  otherOkCount: number;
};

/**
 * Which maintenance rules the Dashboard shows, and how many it is not showing.
 *
 * The card is a summary, not the list — two rows and a count. A rule that is
 * good, or one whose status cannot be worked out, is not a row: it is part of
 * the reassurance underneath.
 */
export function maintenanceHighlights(
  rules: readonly MaintenanceEntry[],
  limit = 2,
): MaintenanceHighlights {
  const pressing = rules
    .filter((r) => r.status.kind === 'overdue' || r.status.kind === 'due_soon' || r.status.kind === 'upcoming')
    .sort(compareByUrgency);
  const shown = pressing.slice(0, limit);
  return { shown, otherOkCount: Math.max(0, rules.length - shown.length) };
}

/**
 * `'Due in 240 km'`, `'Overdue by 310 km'` — the row's second line, in the
 * words the board uses. A rule that has never been completed says so rather
 * than projecting a due point from nothing.
 */
export function maintenanceDueLine(status: MaintenanceStatus, distanceUnit: DistanceUnit): string {
  if (status.neverCompleted) return 'Never completed';

  if (status.remainingMetres !== null) {
    return status.remainingMetres < 0
      ? `Overdue by ${formatDistance(-status.remainingMetres, distanceUnit)}`
      : `Due in ${formatDistance(status.remainingMetres, distanceUnit)}`;
  }

  if (status.remainingDays !== null) {
    const days = Math.abs(status.remainingDays);
    const plural = days === 1 ? 'day' : 'days';
    if (status.remainingDays < 0) return `Overdue by ${days} ${plural}`;
    if (status.remainingDays === 0) return 'Due today';
    return `Due in ${days} ${plural}`;
  }

  return 'No interval set';
}

const SOURCE_LABEL: Record<LedgerSource, string> = {
  fuel: 'Fuel',
  service: 'Service',
  part: 'Part',
  accessory: 'Accessory',
  maintenance: 'Maintenance',
  manual: 'Expense',
};

/**
 * The recent-activity row title: `'Fuel · 8.2 L'`, `'Service · Brake pads'`.
 *
 * The ledger already names each line in the rider's own words; this puts the
 * kind in front of it so three unlike records read as one list, and folds the
 * fuel line's own em dash into the same separator.
 */
export function activityTitle(entry: Pick<LedgerEntry, 'source' | 'label'>): string {
  const kind = SOURCE_LABEL[entry.source];
  const label = entry.label.startsWith(`${kind} — `) ? entry.label.slice(kind.length + 3) : entry.label;
  return `${kind} · ${label}`;
}

/**
 * The line under a recent-activity title: `'13 Sep · 34,712 km'`,
 * `'9 Sep · Rahim Motors'`, `'8 Sep'`.
 *
 * The date is always there. What follows is whatever the record itself knows —
 * the odometer a fill was taken at, the workshop a service was done by — and
 * nothing at all when the record knows neither, because an invented detail is
 * worse than a short line.
 */
export function activityDetail(
  entry: Pick<LedgerEntry, 'source' | 'sourceId' | 'date'>,
  context: {
    fuelEntries: readonly { id: string; odometerMetres: number }[];
    services: readonly { id: string; workshop: string | null; selfService: boolean }[];
  },
  distanceUnit: DistanceUnit,
): string {
  const date = formatShortDate(entry.date);

  if (entry.source === 'fuel') {
    const fill = context.fuelEntries.find((f) => f.id === entry.sourceId);
    return fill === undefined ? date : `${date} · ${formatDistance(fill.odometerMetres, distanceUnit)}`;
  }

  if (entry.source === 'service') {
    const service = context.services.find((s) => s.id === entry.sourceId);
    if (service === undefined) return date;
    const who = service.selfService ? 'self-service' : (service.workshop ?? '');
    return who === '' ? date : `${date} · ${who}`;
  }

  return date;
}

/**
 * How the latest measured interval compares with the one before it, in the
 * rider's mileage unit — the hero's "▲ 1.4 km/L". `better` follows the unit:
 * more km/L or MPG is better, fewer L/100km is better. Null until there are
 * two intervals to compare, and for a change too small to print.
 *
 * Intervals arrive oldest first (`calculateMileageIntervals`).
 */
export function mileageChange(
  intervals: readonly MileageInterval[],
  unit: MileageUnit,
): { delta: number; better: boolean } | null {
  const latest = intervals[intervals.length - 1];
  const previous = intervals[intervals.length - 2];
  if (!latest || !previous) return null;
  const delta = efficiencyToDisplay(latest.efficiency, unit) - efficiencyToDisplay(previous.efficiency, unit);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) return null;
  return { delta: Math.abs(delta), better: unit === 'l_per_100km' ? delta < 0 : delta > 0 };
}

/**
 * The points of the Dashboard's mileage sparkline: the most recent intervals,
 * oldest first, in the rider's unit.
 */
export function mileageSparkline(intervals: readonly MileageInterval[], unit: MileageUnit, count = 12): number[] {
  return intervals.slice(-count).map((interval) => efficiencyToDisplay(interval.efficiency, unit));
}

/**
 * This month's spend against last month's — the bento's "▼ 8% vs August".
 * `series` is the padded monthly series ending with the current month
 * (`monthlySeries`). Null when last month had nothing to compare against, or
 * the two round to the same percentage.
 */
export function monthOverMonth(
  series: readonly { key: string; totalMinor: number }[],
): { percent: number; lower: boolean; previousKey: string } | null {
  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  if (!current || !previous || previous.totalMinor <= 0) return null;
  const percent = Math.round(((current.totalMinor - previous.totalMinor) / previous.totalMinor) * 100);
  if (percent === 0) return null;
  return { percent: Math.abs(percent), lower: percent < 0, previousKey: previous.key };
}

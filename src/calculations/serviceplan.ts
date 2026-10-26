import type { IsoDate } from '@/types';
import { addDays, compareIso, daysBetween, monthName, todayIso } from '@/utils/date';
import type { MaintenanceStatus } from './maintenance';

/**
 * The year ahead.
 *
 * The Service plan board puts a date beside every rule — "≈ early October",
 * "≈ February 2027". A date is not something a maintenance rule carries: a
 * distance rule falls due at an odometer reading, and the only way to say *when*
 * the bike will reach it is to project the rider's own recent pace forward.
 *
 * Two rules keep that honest, and they are the whole reason this lives here
 * rather than in the screen:
 *
 *   - **A rate is measured, never assumed.** `averageMonthlyDistanceMetres()`
 *     returns null when there is too little odometer history, and this file
 *     passes that null straight through as a null date. The plan then shows the
 *     distance alone. Inventing "about 1,000 km a month" so every row could have
 *     a date would be exactly the fabricated figure the product refuses to draw.
 *   - **Nothing derived is stored.** The projection is recomputed on read, so a
 *     fuel log that moves the odometer this afternoon moves every date on the
 *     plan with it.
 */

export type PlannedService = {
  ruleId: string;
  name: string;
  /** Odometer the rule next falls due at, in metres. Null for a time-only rule. */
  dueAtMetres: number | null;
  /** Metres still to run; negative once it is overdue. Null when unknowable. */
  remainingMetres: number | null;
  /** True when the rule has already fallen due — the board's "Overdue now". */
  overdue: boolean;
  /** The day it is projected to fall due, or null when no rate is known. */
  projectedOn: IsoDate | null;
};

/** The mean Gregorian month, so a monthly rate becomes a daily one without drift. */
const DAYS_PER_MONTH = 30.44;

/**
 * Inside this window the plan names a part of a month ("early October"); beyond
 * it a month and a year ("February 2027"). A projection three months out is
 * already loose enough that a day-of-month phrase would overstate it.
 */
export const NEAR_TERM_DAYS = 92;

/** How far a projection is allowed to run before it stops meaning anything. */
const MAX_PROJECTION_DAYS = 3650;

function earlier(a: IsoDate | null, b: IsoDate | null): IsoDate | null {
  if (a === null) return b;
  if (b === null) return a;
  return compareIso(a, b) <= 0 ? a : b;
}

/**
 * Each rule's status turned into one row of the plan, most urgent first.
 *
 * Rules that can never fall due — no distance interval and no date — carry
 * nothing to plan and are dropped rather than listed with a dash.
 */
export function projectServicePlan(input: {
  /** `analytics.maintenance.rules` — statuses already computed by `analyseBike()`. */
  rules: readonly { rule: { id: string; name: string }; status: MaintenanceStatus }[];
  /** `averageMonthlyDistanceMetres(points)`; null when history is too thin. */
  monthlyMetres: number | null;
  today?: IsoDate;
}): PlannedService[] {
  const today = input.today ?? todayIso();
  const perDay =
    input.monthlyMetres === null || input.monthlyMetres <= 0 ? null : input.monthlyMetres / DAYS_PER_MONTH;

  const rows: PlannedService[] = [];

  for (const { rule, status } of input.rules) {
    if (status.dueAtMetres === null && status.dueOnDate === null) continue;

    const overdue = status.kind === 'overdue';

    // From distance: how many days of the rider's own recent pace are left.
    const fromDistance =
      overdue || perDay === null || status.remainingMetres === null || status.remainingMetres < 0
        ? null
        : (() => {
            const days = Math.round(status.remainingMetres / perDay);
            return days > MAX_PROJECTION_DAYS ? null : addDays(today, days);
          })();

    // From the calendar: the rule's own due date, when it has one still ahead.
    const fromDate =
      overdue || status.dueOnDate === null || compareIso(status.dueOnDate, today) < 0 ? null : status.dueOnDate;

    rows.push({
      ruleId: rule.id,
      name: rule.name,
      dueAtMetres: status.dueAtMetres,
      remainingMetres: status.remainingMetres,
      overdue,
      projectedOn: overdue ? null : earlier(fromDistance, fromDate),
    });
  }

  return rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.dueAtMetres !== null && b.dueAtMetres !== null && a.dueAtMetres !== b.dueAtMetres) {
      return a.dueAtMetres - b.dueAtMetres;
    }
    if (a.dueAtMetres === null && b.dueAtMetres !== null) return 1;
    if (a.dueAtMetres !== null && b.dueAtMetres === null) return -1;
    if (a.projectedOn !== null && b.projectedOn !== null && a.projectedOn !== b.projectedOn) {
      return compareIso(a.projectedOn, b.projectedOn);
    }
    return a.name.localeCompare(b.name);
  });
}

/** Inside this many days the plan counts days rather than naming a month. */
const DAYS_TERM = 14;

/**
 * The board's wording for a projected day: `In about 3 days` this fortnight,
 * `Around early Jan` near term, `Around May` further out and `Around May 2028`
 * once it is more than a year away. Null in, null out — the caller then shows
 * the distance on its own, which is the honest answer when no rate is known.
 */
export function describeProjection(date: IsoDate | null, today: IsoDate = todayIso()): string | null {
  if (date === null) return null;

  const ahead = daysBetween(today, date);
  if (ahead <= 0) return 'Due now';
  if (ahead <= DAYS_TERM) return ahead === 1 ? 'In about a day' : `In about ${ahead} days`;
  if (ahead <= NEAR_TERM_DAYS) {
    const day = Number(date.slice(8, 10));
    const phase = day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late';
    return `Around ${phase} ${monthName(date).slice(0, 3)}`;
  }
  const month = monthName(date).slice(0, 3);
  return ahead > 365 ? `Around ${month} ${date.slice(0, 4)}` : `Around ${month}`;
}

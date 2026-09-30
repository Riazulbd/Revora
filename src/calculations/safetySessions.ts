import type { IsoDate, SafetyArea, SafetyCheck, SafetyStatus } from '@/types';
import { compareIso, daysBetween, formatShortDate, todayIso } from '@/utils/date';
import type { OdometerPoint } from './odometer';
import { currentCondition, SAFETY_AREA_LABEL, SAFETY_AREAS, type AreaState } from './safety';

/**
 * The safety log as the redesign draws it.
 *
 * `safety.ts` already answers "what is the latest word on each area?". The
 * board asks three further questions that are all derived, and so belong here
 * rather than in the screen:
 *
 *   - what one line summarises an area's condition ("Watch · slack 32 mm",
 *     "Action · 3 days ago", "Never checked"),
 *   - which areas are asking for action right now, and how that reads as a
 *     sentence ("Brakes need action"),
 *   - how the flat list of checks reads as the walk-arounds it came from
 *     ("13 Sep · 34,712 km · 5 areas", then one row per status).
 *
 * The grouping is presentational and nothing else: a session is not stored and
 * never will be. Two checks share a session because they share a date, which is
 * exactly what the board's own footnote says — "the data stores no session,
 * just the checks". Storing one would give an edit somewhere to go stale.
 */

export const SAFETY_STATUS_LABEL: Record<SafetyStatus, string> = {
  ok: 'OK',
  watch: 'Watch',
  action: 'Action',
};

/**
 * An area nobody has looked at. Its own state on purpose: the absence of a
 * check is not a pass, and the board gives it its own dashed tile so that it
 * can never be mistaken for one.
 */
export const NEVER_CHECKED = 'Never checked';

export function safetyStatusLabel(status: SafetyStatus | null): string {
  return status === null ? NEVER_CHECKED : SAFETY_STATUS_LABEL[status];
}

/**
 * What the rider actually wrote, or `null` where they wrote nothing.
 *
 * `summary` cannot be empty — the schema insists on one — so a walk-around that
 * marks an area OK without a word stores the status itself. Repeating that back
 * as "OK · OK" tells the rider nothing, so a summary that only echoes the
 * status counts as no summary at all.
 */
export function observedSummary(check: SafetyCheck): string | null {
  const summary = check.summary.trim();
  if (summary === '') return null;
  return summary.toLowerCase() === SAFETY_STATUS_LABEL[check.status].toLowerCase() ? null : summary;
}

/** Areas whose name takes a plural verb — "Brakes need", "Chain needs". */
const PLURAL_AREAS: readonly SafetyArea[] = ['tyres', 'brakes', 'lights'];

/**
 * `'today'`, `'yesterday'`, `'3 days ago'`.
 *
 * A check dated in the future (a rider correcting a date) falls back to the
 * date itself rather than reading "-2 days ago".
 */
export function daysAgoLabel(date: IsoDate, today: IsoDate = todayIso()): string {
  const days = daysBetween(date, today);
  if (days < 0) return formatShortDate(date);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * The line under an area's name on the Current grid.
 *
 * An area marked for action shows how long it has been that way, because that
 * is the question a rider has about a fault they already know about. Anything
 * else shows what was actually observed, and falls back to the date when the
 * rider wrote nothing down.
 */
export function areaConditionLine(state: AreaState, today: IsoDate = todayIso()): string {
  const { latest, status } = state;
  if (latest === null || status === null) return NEVER_CHECKED;

  const label = SAFETY_STATUS_LABEL[status];
  if (status === 'action') return `${label} · ${daysAgoLabel(latest.date, today)}`;

  const observed = observedSummary(latest);
  return `${label} · ${observed ?? formatShortDate(latest.date)}`;
}

/** The areas whose latest check says action — the live faults, not the history. */
export function actionAreas(checks: readonly SafetyCheck[]): AreaState[] {
  return currentCondition(checks).filter((state) => state.status === 'action');
}

/** `'Brakes need action'`, `'Chain needs action'`, `'Brakes and chain need action'`. */
export function actionHeadline(states: readonly AreaState[]): string | null {
  if (states.length === 0) return null;

  const names = states.map((s) => s.label);
  const [first = '', ...rest] = names;
  const joined =
    rest.length === 0
      ? first
      : `${[first, ...rest.slice(0, -1)].join(', ')} and ${rest[rest.length - 1]?.toLowerCase() ?? ''}`;

  const singular = states.length === 1 && !PLURAL_AREAS.includes(states[0]?.area ?? 'tyres');
  return `${joined} ${singular ? 'needs' : 'need'} action`;
}

/**
 * The odometer as it stood on a given day.
 *
 * The last reading on or before the date, which is the only honest answer: a
 * safety check stores no odometer of its own, and reading forward from a later
 * fill would put a figure on the row that the rider never saw. Nothing on or
 * before the date gives `null`, and the screen renders `—`.
 */
export function odometerMetresOn(
  points: readonly OdometerPoint[],
  date: IsoDate,
): number | null {
  let best: OdometerPoint | null = null;
  for (const point of points) {
    if (compareIso(point.date, date) > 0) continue;
    if (best === null) {
      best = point;
      continue;
    }
    const order = compareIso(point.date, best.date);
    if (order > 0 || (order === 0 && point.metres > best.metres)) best = point;
  }
  return best === null ? null : best.metres;
}

/** `'Tyres, battery'` — the first area named, the rest folded in lower case. */
export function areaListLabel(areas: readonly SafetyArea[]): string {
  const [first, ...rest] = areas;
  if (first === undefined) return '';
  return [SAFETY_AREA_LABEL[first], ...rest.map((a) => SAFETY_AREA_LABEL[a].toLowerCase())].join(', ');
}

export type SafetySessionRow = {
  status: SafetyStatus;
  areas: SafetyArea[];
  /** `'Tyres, battery'`. */
  label: string;
  /** `'OK'` — carried as words as well as by the dot's colour. */
  statusLabel: string;
  /** What the rider wrote, deduplicated across the areas in the row. */
  detail: string | null;
  /** The checks behind the row, so tapping it can open one. */
  checkIds: string[];
  hasPhoto: boolean;
};

export type SafetySession = {
  date: IsoDate;
  /** Distinct areas looked at that day — the board's "5 areas". */
  areaCount: number;
  rows: SafetySessionRow[];
};

/** Worst first inside a session, so the row needing action is read first. */
const ROW_ORDER: readonly SafetyStatus[] = ['action', 'watch', 'ok'];

/**
 * Checks grouped by the day they were made, newest day first.
 *
 * Inside a day the areas collapse by status, because five separate green rows
 * saying "OK" is five rows a rider learns to skip.
 */
export function safetySessions(checks: readonly SafetyCheck[]): SafetySession[] {
  const byDate = new Map<IsoDate, SafetyCheck[]>();
  for (const check of checks) {
    const held = byDate.get(check.date);
    if (held === undefined) byDate.set(check.date, [check]);
    else held.push(check);
  }

  return [...byDate.entries()]
    .sort((a, b) => compareIso(b[0], a[0]))
    .map(([date, list]) => {
      const rows: SafetySessionRow[] = [];

      for (const status of ROW_ORDER) {
        const inStatus = [...list]
          .filter((c) => c.status === status)
          .sort((a, b) => SAFETY_AREAS.indexOf(a.area) - SAFETY_AREAS.indexOf(b.area));
        if (inStatus.length === 0) continue;

        const detail: string[] = [];
        for (const check of inStatus) {
          const observed = observedSummary(check);
          if (observed !== null && !detail.includes(observed)) detail.push(observed);
        }

        rows.push({
          status,
          areas: inStatus.map((c) => c.area),
          label: areaListLabel(inStatus.map((c) => c.area)),
          statusLabel: SAFETY_STATUS_LABEL[status],
          detail: detail.length === 0 ? null : detail.join(' · '),
          checkIds: inStatus.map((c) => c.id),
          hasPhoto: inStatus.some((c) => c.photoPath !== null),
        });
      }

      return { date, areaCount: new Set(list.map((c) => c.area)).size, rows };
    });
}

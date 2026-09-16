import type { SafetyArea, SafetyCheck, SafetyStatus } from '@/types';
import { compareIso } from '@/utils/date';

/**
 * The condition of the motorcycle now, and how it got there.
 *
 * A check record is one area, not one walk-around, so five checks done on the
 * same morning are five records. Listed flat and newest-first that reads as
 * five near-identical rows, and the question a rider actually has — "are my
 * brakes alright?" — takes scrolling to answer.
 *
 * So the screen leads with the latest word on each area and keeps the rest as
 * history. That is the same rule the Dashboard's attention list uses: an area
 * marked for action in March and cleared in August is not a live fault, and a
 * list that keeps crying wolf is one riders stop reading.
 */
export const SAFETY_AREAS: readonly SafetyArea[] = ['tyres', 'chain', 'brakes', 'battery', 'lights'];

export const SAFETY_AREA_LABEL: Record<SafetyArea, string> = {
  tyres: 'Tyres',
  chain: 'Chain',
  brakes: 'Brakes',
  battery: 'Battery',
  lights: 'Lights',
};

export type AreaState = {
  area: SafetyArea;
  label: string;
  /** The most recent check, or null where the area has never been checked. */
  latest: SafetyCheck | null;
  /**
   * `null` is not "ok". An area nobody has looked at is unknown, and showing it
   * in green would be the app vouching for something it has never seen.
   */
  status: SafetyStatus | null;
};

/** Worst first, so anything needing action is the first thing read. */
const STATUS_RANK: Record<SafetyStatus, number> = { action: 0, watch: 1, ok: 2 };

export function currentCondition(checks: readonly SafetyCheck[]): AreaState[] {
  const latest = new Map<SafetyArea, SafetyCheck>();
  for (const check of checks) {
    const held = latest.get(check.area);
    if (held === undefined || compareIso(check.date, held.date) > 0) latest.set(check.area, check);
  }

  return SAFETY_AREAS.map((area) => {
    const check = latest.get(area) ?? null;
    return { area, label: SAFETY_AREA_LABEL[area], latest: check, status: check?.status ?? null };
  }).sort((a, b) => {
    // Unchecked areas sit after everything checked: they are a gap in the
    // record, not a fault in the motorcycle.
    const rankA = a.status === null ? 3 : STATUS_RANK[a.status];
    const rankB = b.status === null ? 3 : STATUS_RANK[b.status];
    if (rankA !== rankB) return rankA - rankB;
    return SAFETY_AREAS.indexOf(a.area) - SAFETY_AREAS.indexOf(b.area);
  });
}

/** Checks that are no longer the latest word on their area. */
export function conditionHistory(checks: readonly SafetyCheck[]): SafetyCheck[] {
  const current = new Set(
    currentCondition(checks)
      .map((state) => state.latest?.id)
      .filter((id): id is string => id !== undefined),
  );
  return [...checks].filter((c) => !current.has(c.id)).sort((a, b) => compareIso(b.date, a.date));
}

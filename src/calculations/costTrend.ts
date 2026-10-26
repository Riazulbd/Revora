import type { DistanceUnit, IsoDate, LedgerEntry } from '@/types';
import { monthKey, recentMonthKeys } from '@/utils/date';
import type { OdometerPoint } from './odometer';
import { costPerDistance } from './units';

/**
 * Cost per distance over time — the Analytics bento's COST / KM tile: a
 * column per month and "▼ ৳0.18 vs last quarter".
 *
 * A month's rate is what was spent in it divided by what was ridden in it,
 * the distance read off the odometer history (the last reading of the month
 * against the last reading before it). A month with no ride, or no reading
 * to measure one by, has no rate — null, never zero — and the quarters are
 * compared as one sum over three months so a quiet month does not swing them.
 * Everything is recomputed from the ledger and the readings on read.
 */

export type CostTrend = {
  /** Oldest first, ending with the current month. Null where no distance could be measured. */
  months: readonly { key: string; scaled: number | null }[];
  /** The last three months, as one rate. */
  latestQuarterScaled: number | null;
  /** The three months before those. */
  previousQuarterScaled: number | null;
  /** latest − previous; negative means cheaper per distance. Null unless both are known. */
  deltaScaled: number | null;
};

export const COST_TREND_MONTHS = 7;

function highestBefore(points: readonly OdometerPoint[], cutoff: string): number | null {
  let best: number | null = null;
  for (const point of points) {
    if (point.date < cutoff) best = best === null ? point.metres : Math.max(best, point.metres);
  }
  return best;
}

function highestWithin(points: readonly OdometerPoint[], key: string): number | null {
  let best: number | null = null;
  for (const point of points) {
    if (monthKey(point.date) === key) best = best === null ? point.metres : Math.max(best, point.metres);
  }
  return best;
}

export function costPerDistanceTrend(input: {
  ledger: readonly Pick<LedgerEntry, 'date' | 'amountMinor'>[];
  points: readonly OdometerPoint[];
  today: IsoDate;
  distanceUnit: DistanceUnit;
  months?: number;
}): CostTrend {
  const keys = recentMonthKeys(input.months ?? COST_TREND_MONTHS, monthKey(input.today));

  const spend = new Map<string, number>(keys.map((key) => [key, 0]));
  for (const line of input.ledger) {
    const key = monthKey(line.date);
    if (spend.has(key)) spend.set(key, (spend.get(key) ?? 0) + line.amountMinor);
  }

  // Distance ridden in a month: the furthest reading in it against the furthest
  // reading before it. Both must exist, or nothing was measured.
  const distance = new Map<string, number | null>();
  for (const key of keys) {
    const end = highestWithin(input.points, key);
    const start = highestBefore(input.points, `${key}-01`);
    distance.set(key, end === null || start === null || end <= start ? null : end - start);
  }

  const months = keys.map((key) => {
    const metres = distance.get(key) ?? null;
    return { key, scaled: metres === null ? null : costPerDistance(spend.get(key) ?? 0, metres, input.distanceUnit) };
  });

  const quarter = (slice: readonly string[]): number | null => {
    if (slice.length < 3) return null;
    let minor = 0;
    let metres = 0;
    for (const key of slice) {
      const ridden = distance.get(key);
      if (ridden === null || ridden === undefined) return null;
      minor += spend.get(key) ?? 0;
      metres += ridden;
    }
    return costPerDistance(minor, metres, input.distanceUnit);
  };

  const latestQuarterScaled = quarter(keys.slice(-3));
  const previousQuarterScaled = quarter(keys.slice(-6, -3));

  return {
    months,
    latestQuarterScaled,
    previousQuarterScaled,
    deltaScaled:
      latestQuarterScaled === null || previousQuarterScaled === null ? null : latestQuarterScaled - previousQuarterScaled,
  };
}

import type { FuelAdjustment, FuelEntry } from '@/types';
import { adjustmentMlInRange } from './fuel';
import { efficiencyFrom, type Efficiency } from './units';

/**
 * The mileage engine.
 *
 * Revora only measures consumption between two **full-tank** fills. Everything
 * logged in between (partial fills, fills of unknown level) contributes its fuel
 * to that interval but never terminates one — computing a figure per partial
 * fill is the classic fuel-log bug and it is explicitly not done here
 * (requirement 18).
 *
 * Fuel adjustments are events on the motorcycle's timeline, not fields on a
 * fill — a leak happens between fills, not at one. Each interval nets the
 * adjustments dated inside it, so a litre lost to a leak is a litre that did not
 * propel the bike, and the rider's original fill is never altered.
 *
 * Nothing derived is ever stored. Every read recomputes from the raw entries, so
 * editing or deleting an old fill automatically corrects every later interval
 * (requirement 20).
 */

export type MileageConfidence = 'high' | 'medium' | 'estimated' | 'insufficient';

export type MileageInterval = {
  /** The fill that opened the interval (a full tank). */
  fromEntryId: string;
  /** The fill that closed it (a full tank) — the one the figure is shown against. */
  toEntryId: string;
  fromOdometerMetres: number;
  toOdometerMetres: number;
  distanceMetres: number;
  /** Fuel burned over the interval, after adjustments. */
  fuelMl: number;
  /** Raw fuel purchased over the interval, before adjustments. */
  rawFuelMl: number;
  /** Signed net adjustment applied to this interval. */
  adjustmentMl: number;
  efficiency: Efficiency;
  confidence: Exclude<MileageConfidence, 'insufficient'>;
  /** Fills counted into this interval that were not full tanks. */
  partialFills: number;
  unknownFills: number;
  hasAdjustments: boolean;
  /** The date the interval opened, so adjustments can be attributed. */
  fromDate: string;
  date: string;
};

/**
 * Fuel entries in the order distance accumulates. Odometer is the primary key
 * because that is what distance is measured from; date and creation order only
 * break ties.
 */
export function sortEntriesForMileage(entries: readonly FuelEntry[]): FuelEntry[] {
  return [...entries].sort((a, b) => {
    if (a.odometerMetres !== b.odometerMetres) return a.odometerMetres - b.odometerMetres;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

function confidenceOf(partialFills: number, unknownFills: number): Exclude<MileageConfidence, 'insufficient'> {
  if (unknownFills > 0) return 'estimated';
  if (partialFills > 0) return 'medium';
  return 'high';
}

/**
 * Every complete full-to-full interval in the log, oldest first.
 */
export function calculateMileageIntervals(
  entries: readonly FuelEntry[],
  adjustments: readonly FuelAdjustment[] = [],
): MileageInterval[] {
  const ordered = sortEntriesForMileage(entries);
  const intervals: MileageInterval[] = [];

  let anchor: FuelEntry | null = null;
  let rawFuelMl = 0;
  let partialFills = 0;
  let unknownFills = 0;
  let missedFill = false;

  const reset = (entry: FuelEntry) => {
    anchor = entry;
    rawFuelMl = 0;
    partialFills = 0;
    unknownFills = 0;
    missedFill = false;
  };

  for (const entry of ordered) {
    if (anchor === null) {
      // The log only starts measuring at the first full tank — a partial fill
      // before any full tank tells us nothing about the tank's level.
      if (entry.fillType === 'full') reset(entry);
      continue;
    }

    rawFuelMl += entry.litresMl;
    if (entry.missedPreviousFill) missedFill = true;

    if (entry.fillType === 'full') {
      const start: FuelEntry = anchor;
      const distanceMetres = entry.odometerMetres - start.odometerMetres;

      // Adjustments dated inside the interval, signed: fuel that left the tank
      // without covering distance reduces the fuel that did the work.
      const adjustmentMl = adjustmentMlInRange(adjustments, start.date, entry.date);
      const fuelMl = rawFuelMl + adjustmentMl;
      const efficiency = efficiencyFrom(distanceMetres, fuelMl);

      // A fill the rider has flagged as following an unlogged one cannot close a
      // trustworthy interval — the fuel in between was never recorded.
      if (efficiency !== null && !missedFill) {
        intervals.push({
          fromEntryId: start.id,
          toEntryId: entry.id,
          fromOdometerMetres: start.odometerMetres,
          toOdometerMetres: entry.odometerMetres,
          distanceMetres,
          fuelMl,
          rawFuelMl,
          adjustmentMl,
          efficiency,
          confidence: confidenceOf(partialFills, unknownFills),
          partialFills,
          unknownFills,
          hasAdjustments: adjustmentMl !== 0,
          fromDate: start.date,
          date: entry.date,
        });
      }
      reset(entry);
      continue;
    }

    if (entry.fillType === 'partial') partialFills += 1;
    else unknownFills += 1;
  }

  return intervals;
}

export type MileageSummary = {
  intervals: MileageInterval[];
  /** The most recent complete interval, or null. */
  latest: MileageInterval | null;
  /**
   * Distance-weighted average across every interval — total distance divided by
   * total fuel, which is the only correct way to average consumption.
   */
  average: Efficiency | null;
  /** Same calculation restricted to the five most recent intervals. */
  lastFive: Efficiency | null;
  best: MileageInterval | null;
  worst: MileageInterval | null;
  confidence: MileageConfidence;
  /** Number of complete intervals available. */
  count: number;
};

/** Best/worst and the rolling five-interval average only unlock at five intervals. */
export const RELIABLE_INTERVALS_REQUIRED = 5;

function weightedAverage(intervals: readonly MileageInterval[]): Efficiency | null {
  let distance = 0;
  let fuel = 0;
  for (const i of intervals) {
    distance += i.distanceMetres;
    fuel += i.fuelMl;
  }
  return efficiencyFrom(distance, fuel);
}

function overallConfidence(intervals: readonly MileageInterval[]): MileageConfidence {
  if (intervals.length === 0) return 'insufficient';
  if (intervals.some((i) => i.confidence === 'estimated')) return 'estimated';
  if (intervals.some((i) => i.confidence === 'medium')) return 'medium';
  return 'high';
}

export function calculateMileageSummary(
  entries: readonly FuelEntry[],
  adjustments: readonly FuelAdjustment[] = [],
): MileageSummary {
  const intervals = calculateMileageIntervals(entries, adjustments);
  const count = intervals.length;

  if (count === 0) {
    return {
      intervals,
      latest: null,
      average: null,
      lastFive: null,
      best: null,
      worst: null,
      confidence: 'insufficient',
      count: 0,
    };
  }

  const latest = intervals[count - 1] ?? null;
  const average = weightedAverage(intervals);

  let lastFive: Efficiency | null = null;
  let best: MileageInterval | null = null;
  let worst: MileageInterval | null = null;

  if (count >= RELIABLE_INTERVALS_REQUIRED) {
    lastFive = weightedAverage(intervals.slice(-RELIABLE_INTERVALS_REQUIRED));
    for (const i of intervals) {
      if (best === null || i.efficiency.metresPerMl > best.efficiency.metresPerMl) best = i;
      if (worst === null || i.efficiency.metresPerMl < worst.efficiency.metresPerMl) worst = i;
    }
  }

  return {
    intervals,
    latest,
    average,
    lastFive,
    best,
    worst,
    confidence: overallConfidence(intervals),
    count,
  };
}

export function confidenceLabel(confidence: MileageConfidence): string {
  switch (confidence) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'estimated':
      return 'ESTIMATED';
    case 'insufficient':
    default:
      return 'INSUFFICIENT';
  }
}

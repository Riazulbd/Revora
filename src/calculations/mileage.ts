import type { FuelAdjustment, FuelEntry } from '@/types';
import { adjustmentIndicesInRange, adjustmentMlAt } from './fuel';
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

/**
 * Why there is no measured interval yet.
 *
 * A rider who has logged four fills and sees an empty card has no way to tell a
 * broken app from a rule they tripped over. Every path that discards an
 * interval now names itself, so the screen can say which one it was.
 */
export type MileageBlocker =
  | 'no_fills'
  | 'one_fill'
  | 'no_closing_full_tank'
  | 'missed_fill'
  | 'dates_out_of_order'
  | 'no_distance'
  | 'adjustment_exceeds_fuel';

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
  return measureMileage(entries, adjustments).intervals;
}

/** The intervals, plus what stopped the ones that did not make it. */
function measureMileage(
  entries: readonly FuelEntry[],
  adjustments: readonly FuelAdjustment[],
): { intervals: MileageInterval[]; discardedBy: MileageBlocker | null } {
  const ordered = sortEntriesForMileage(entries);
  const intervals: MileageInterval[] = [];
  let discardedBy: MileageBlocker | null = null;

  // Adjustments are claimed as the intervals are walked, oldest first, so an
  // adjustment on the day two intervals share belongs to the earlier one and to
  // that one only. See `adjustmentIndicesInRange` in ./fuel.ts.
  const claimed = new Set<number>();

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
      // without covering distance reduces the fuel that did the work. Claiming
      // them makes the attribution total — every adjustment lands in exactly one
      // interval, including when an interval opens and closes on the same day.
      const mine = adjustmentIndicesInRange(adjustments, start.date, entry.date).filter(
        (i) => !claimed.has(i),
      );
      for (const i of mine) claimed.add(i);
      const adjustmentMl = adjustmentMlAt(adjustments, mine);
      const fuelMl = rawFuelMl + adjustmentMl;
      const efficiency = efficiencyFrom(distanceMetres, fuelMl);

      // Entries are ordered by odometer, so a mistyped reading sorts into the
      // wrong place and produces an interval that runs backwards in time. Real
      // distance never does: the odometer and the calendar advance together. A
      // closing fill dated before the one it closes is a typo, not a journey,
      // and a confident figure drawn across it would be worse than none.
      const coherent = entry.date >= start.date;

      // A fill the rider has flagged as following an unlogged one cannot close a
      // trustworthy interval — the fuel in between was never recorded.
      if (efficiency === null) {
        // Nothing to divide. Which half is missing decides what the rider is
        // told: falling through to 'no closing full tank' told them to mark a
        // fill Full when both ends already were.
        discardedBy =
          discardedBy ?? (distanceMetres <= 0 ? 'no_distance' : 'adjustment_exceeds_fuel');
      } else if (missedFill) {
        discardedBy = discardedBy ?? 'missed_fill';
      } else if (!coherent) {
        discardedBy = discardedBy ?? 'dates_out_of_order';
      }

      if (efficiency !== null && !missedFill && coherent) {
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

  return { intervals, discardedBy };
}

/**
 * What the summary reports, and in what order of precedence.
 *
 * The three things a rider can be shown — a measured figure, an estimate, and an
 * explanation — are not alternatives to be picked over by whichever screen gets
 * there first. The order is fixed here, once:
 *
 *  1. **A measured interval always wins.** The moment one full-to-full interval
 *     exists, `provisional` is null and `blockedBy` is null. A later pair that
 *     was discarded does not drag an explanation back onto a screen that already
 *     has a real figure, and an estimate never sits beside a measurement.
 *  2. **With no measured interval, the estimate is offered only if the span is
 *     safe.** `provisional` is withheld when the log contradicts itself — a fill
 *     flagged as following an unlogged one, a span running backwards in time, or
 *     nothing to divide. An estimate is still a number the rider will act on.
 *  3. **`blockedBy` is set whenever there is no measured interval**, safe
 *     estimate or not, because it answers a different question: not "roughly
 *     how much fuel" but "why is this not measured, and what do I do about it".
 *     Its message is written to sit beside an estimate when one exists.
 */
export type MileageSummary = {
  intervals: MileageInterval[];
  /**
   * A figure drawn across the whole log when no full-to-full interval exists.
   *
   * Full-to-full is the only way to *measure* consumption, because it is the
   * only arrangement where the tank holds the same amount at both ends. But a
   * rider four fills in, seeing nothing, has no way to tell whether the app is
   * working. This spans the first fill to the last and divides by every litre
   * bought in between, which spreads whatever the tank level difference is
   * across all of that distance instead of across one tank. It is always
   * labelled `estimated`, and a real interval always replaces it.
   */
  provisional: MileageInterval | null;
  /** Why `intervals` is empty, when it is. Null once a figure is measured. */
  blockedBy: MileageBlocker | null;
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

/**
 * The widest span the log supports, treated as one interval.
 *
 * Deliberately not exposed as a measured interval: it sits in `provisional`,
 * carries `estimated` confidence, and never feeds the average.
 */
function provisionalInterval(
  entries: readonly FuelEntry[],
  adjustments: readonly FuelAdjustment[],
): MileageInterval | null {
  const ordered = sortEntriesForMileage(entries);
  if (ordered.length < 2) return null;

  const start = ordered[0];
  const end = ordered[ordered.length - 1];
  if (start === undefined || end === undefined) return null;
  if (end.date < start.date) return null;

  // An estimate is still a figure the rider will read as theirs, so it is only
  // offered over a span the log does not itself contradict. A fill flagged as
  // following an unlogged one says the litres across this span are incomplete;
  // spreading them over the distance would put a number on a known gap.
  if (ordered.slice(1).some((e) => e.missedPreviousFill)) return null;

  const distanceMetres = end.odometerMetres - start.odometerMetres;
  // Every litre bought after the opening fill, the closing one included — the
  // opening fill's own fuel was burned before this span began.
  let rawFuelMl = 0;
  let partialFills = 0;
  let unknownFills = 0;
  for (const entry of ordered.slice(1)) {
    rawFuelMl += entry.litresMl;
    if (entry.fillType === 'partial') partialFills += 1;
    else if (entry.fillType !== 'full') unknownFills += 1;
  }

  // Closed range: nothing else can claim these, so an adjustment dated on the
  // opening fill counts here rather than nowhere.
  const adjustmentMl = adjustmentMlAt(
    adjustments,
    adjustmentIndicesInRange(adjustments, start.date, end.date),
  );
  const fuelMl = rawFuelMl + adjustmentMl;
  const efficiency = efficiencyFrom(distanceMetres, fuelMl);
  if (efficiency === null) return null;

  return {
    fromEntryId: start.id,
    toEntryId: end.id,
    fromOdometerMetres: start.odometerMetres,
    toOdometerMetres: end.odometerMetres,
    distanceMetres,
    fuelMl,
    rawFuelMl,
    adjustmentMl,
    efficiency,
    confidence: 'estimated',
    partialFills,
    unknownFills,
    hasAdjustments: adjustmentMl !== 0,
    fromDate: start.date,
    date: end.date,
  };
}

function weightedAverage(intervals: readonly MileageInterval[]): Efficiency | null {
  let distance = 0;
  let fuel = 0;
  for (const i of intervals) {
    distance += i.distanceMetres;
    fuel += i.fuelMl;
  }
  return efficiencyFrom(distance, fuel);
}

/**
 * How much the *average* can be relied on — not how clean any one interval was.
 *
 * A single flawless full-to-full measurement is still one measurement: traffic,
 * a pillion or a headwind move a tank's figure by several km/L. Reporting "high"
 * off one interval tells a rider their mileage is settled when it is not, which
 * is precisely the kind of confident-but-wrong number this app exists to avoid.
 */
function overallConfidence(intervals: readonly MileageInterval[]): MileageConfidence {
  if (intervals.length === 0) return 'insufficient';
  if (intervals.some((i) => i.confidence === 'estimated')) return 'estimated';
  if (intervals.some((i) => i.confidence === 'medium')) return 'medium';
  // Clean intervals, but too few of them to call the average settled.
  if (intervals.length < RELIABLE_INTERVALS_REQUIRED) return 'medium';
  return 'high';
}

export function calculateMileageSummary(
  entries: readonly FuelEntry[],
  adjustments: readonly FuelAdjustment[] = [],
): MileageSummary {
  const { intervals, discardedBy } = measureMileage(entries, adjustments);
  const count = intervals.length;

  // Step 1 of the precedence documented on MileageSummary: one measured interval
  // is enough, and it wins outright. Steps 2 and 3 only run when there is none —
  // the estimate if the span is safe, and always an explanation of why nothing
  // was measured.
  if (count === 0) {
    return {
      intervals,
      provisional: provisionalInterval(entries, adjustments),
      blockedBy: blockerFor(entries, discardedBy),
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
    // A measured figure is on screen, so neither an estimate nor an explanation
    // of a later discarded pair belongs beside it.
    provisional: null,
    blockedBy: null,
    latest,
    average,
    lastFive,
    best,
    worst,
    confidence: overallConfidence(intervals),
    count,
  };
}

/**
 * Which explanation the rider is owed, in the order that helps most.
 *
 * A discarded interval outranks a missing one: "your dates run backwards" tells
 * a rider what to fix, where "log another full tank" would send them to the
 * pump to repeat the same mistake.
 */
function blockerFor(entries: readonly FuelEntry[], discardedBy: MileageBlocker | null): MileageBlocker {
  if (discardedBy !== null) return discardedBy;
  if (entries.length === 0) return 'no_fills';
  if (entries.length === 1) return 'one_fill';
  return 'no_closing_full_tank';
}

/** What to put on screen when there is no measured figure. */
export function mileageBlockerMessage(blocker: MileageBlocker): string {
  switch (blocker) {
    case 'no_fills':
      return 'Log your first fill and Revora starts measuring from there.';
    case 'one_fill':
      return 'One fill is a starting point, not a measurement. The next one gives you a figure.';
    case 'missed_fill':
      return 'A fill is marked as following one that was never logged, so the fuel in between is unknown. Clear that flag, or log the missing fill, and the figure returns.';
    case 'dates_out_of_order':
      return 'Two fills disagree: the later odometer reading carries the earlier date. Correct whichever is wrong and the figure returns.';
    case 'no_distance':
      return 'Two fills marked Full share the same odometer reading, so there is no distance to measure across. Correct whichever reading is wrong and the figure returns.';
    case 'adjustment_exceeds_fuel':
      return 'The fuel adjustments logged over this stretch come to more than the fuel bought in it, so there is nothing left to divide. Check the amounts you logged as lost or added.';
    case 'no_closing_full_tank':
    default:
      return 'Measuring needs a fill marked Full tank at both ends of a stretch. Mark your next one Full and the measured figure replaces the estimate.';
  }
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

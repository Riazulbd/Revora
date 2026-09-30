import { RELIABLE_INTERVALS_REQUIRED, type MileageInterval } from './mileage';

/**
 * Totals across the measured mileage intervals.
 *
 * The Analytics board's "Mileage stats · 12 intervals" card prints DISTANCE and
 * LITRES beside the average, and both figures have to be the ones the average
 * was actually built from — the whole-log odometer distance would include the
 * stretches before the first full tank and after the last, which is precisely
 * the fuel nobody measured. Summing the intervals keeps the card internally
 * consistent: distance ÷ litres is the average printed next to it.
 */
export type MileageIntervalTotals = {
  /** Distance covered by the measured intervals, in metres. */
  distanceMetres: number;
  /** Fuel burned across those same intervals, in millilitres, after adjustments. */
  fuelMl: number;
  /** How many intervals were summed. */
  count: number;
};

export function mileageIntervalTotals(
  intervals: readonly MileageInterval[],
): MileageIntervalTotals {
  let distanceMetres = 0;
  let fuelMl = 0;

  for (const interval of intervals) {
    distanceMetres += interval.distanceMetres;
    fuelMl += interval.fuelMl;
  }

  return { distanceMetres, fuelMl, count: intervals.length };
}

/**
 * How many more measured intervals are needed before best / worst and the
 * rolling average unlock — the "so 3 to go" in the board's own sentence.
 *
 * Never negative: once the threshold is met there is nothing left to go.
 */
export function intervalsToReliable(
  count: number,
  required: number = RELIABLE_INTERVALS_REQUIRED,
): number {
  if (!Number.isFinite(count)) return required;
  return Math.max(0, required - Math.max(0, Math.trunc(count)));
}

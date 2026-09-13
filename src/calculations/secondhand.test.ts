import type { FuelEntry } from '@/types';
import { calculateMileageIntervals, calculateMileageSummary } from './mileage';
import { efficiencyToDisplay } from './units';

/**
 * Revora is installed by people who have already been riding for years.
 *
 * Every scenario below starts on a used vehicle, because that is the normal
 * case — the odometer reads 4,845 km or 80,000 km on day one and the app must
 * never treat the missing history as distance travelled, or as zero.
 */

let seq = 0;
const fill = (odoKm: number, litres: number, date: string, over: Partial<FuelEntry> = {}): FuelEntry => {
  seq += 1;
  return {
    id: `f${seq}`, userId: 'u1', bikeId: 'b1', createdAt: seq, updatedAt: seq,
    date, odometerMetres: Math.round(odoKm * 1000), litresMl: Math.round(litres * 1000),
    pricePerLitreMinor: 14_500, totalCostMinor: Math.round(litres * 14_500), currency: 'BDT',
    fillType: 'full', missedPreviousFill: false, station: null, notes: null,
    receiptPath: null, clientRef: `r${seq}`, ...over,
  };
};
const kmPerL = (e: { metresPerMl: number } | null) => (e === null ? null : Number(efficiencyToDisplay(e, 'km_per_l').toFixed(2)));

test("a bike first logged at 4,845 km measures 273 km to the next full tank", () => {
  // The exact case a rider reported: install the app mid-life, fill up, ride,
  // fill up again. Nothing about the 4,845 km already on the clock is distance
  // Revora may claim to have measured.
  const intervals = calculateMileageIntervals(
    [fill(4845, 8.0, '2026-08-01'), fill(5118, 6.0, '2026-08-13')], [],
  );
  expect(intervals).toHaveLength(1);
  expect(intervals[0]!.distanceMetres).toBe(273_000);
  // 273 km on the 6.0 L it took to refill — the 8.0 L that filled the tank at
  // the start did work Revora cannot see and must not count.
  expect(intervals[0]!.fuelMl).toBe(6_000);
  expect(kmPerL(intervals[0]!.efficiency)).toBe(45.5);
});

test('the first fill establishes a baseline and yields no figure at all', () => {
  const summary = calculateMileageSummary([fill(4845, 8.0, '2026-08-01')], []);
  expect(summary.intervals).toHaveLength(0);
  expect(summary.average).toBeNull();
  expect(summary.latest).toBeNull();
});

test('a partial fill before the first full tank tells us nothing and is ignored', () => {
  const intervals = calculateMileageIntervals([
    fill(4845, 3.0, '2026-08-01', { fillType: 'partial' }),
    fill(4900, 8.0, '2026-08-04'),
    fill(5173, 6.0, '2026-08-16'),
  ], []);
  expect(intervals).toHaveLength(1);
  expect(intervals[0]!.fromOdometerMetres).toBe(4_900_000);
  expect(intervals[0]!.distanceMetres).toBe(273_000);
});

test('partial fills between two full tanks all count toward the fuel used', () => {
  const intervals = calculateMileageIntervals([
    fill(4845, 8.0, '2026-08-01'),
    fill(4980, 3.0, '2026-08-06', { fillType: 'partial' }),
    fill(5050, 2.5, '2026-08-10', { fillType: 'partial' }),
    fill(5118, 4.0, '2026-08-13'),
  ], []);
  expect(intervals).toHaveLength(1);
  expect(intervals[0]!.distanceMetres).toBe(273_000);
  expect(intervals[0]!.fuelMl).toBe(9_500);          // 3.0 + 2.5 + 4.0
  expect(intervals[0]!.partialFills).toBe(2);
});

test('a fill flagged as following an unlogged one produces no figure', () => {
  // Fuel went in that Revora never saw, so the interval is unmeasurable. A
  // number here would look useful and be wrong.
  const intervals = calculateMileageIntervals([
    fill(4845, 8.0, '2026-08-01'),
    fill(5118, 6.0, '2026-08-13', { missedPreviousFill: true }),
  ], []);
  expect(intervals).toHaveLength(0);
});

test('an odometer typed lower than the previous fill yields no figure', () => {
  const intervals = calculateMileageIntervals(
    [fill(5118, 8.0, '2026-08-01'), fill(4845, 6.0, '2026-08-13')], [],
  );
  expect(intervals).toHaveLength(0);
});

test('two fills at the same odometer yield no figure rather than infinity', () => {
  const intervals = calculateMileageIntervals(
    [fill(5118, 8.0, '2026-08-01'), fill(5118, 6.0, '2026-08-13')], [],
  );
  expect(intervals).toHaveLength(0);
});

test('a fill recording zero litres yields no figure rather than a division by zero', () => {
  const intervals = calculateMileageIntervals(
    [fill(4845, 8.0, '2026-08-01'), fill(5118, 0, '2026-08-13')], [],
  );
  expect(intervals).toHaveLength(0);
});

test('deleting the middle fill re-spans the interval instead of leaving a stale figure', () => {
  const all = [fill(4845, 8.0, '2026-08-01'), fill(5118, 6.0, '2026-08-13'), fill(5400, 6.5, '2026-08-25')];
  expect(calculateMileageIntervals(all, [])).toHaveLength(2);
  const withoutMiddle = [all[0]!, all[2]!];
  const after = calculateMileageIntervals(withoutMiddle, []);
  expect(after).toHaveLength(1);
  expect(after[0]!.distanceMetres).toBe(555_000);   // 5,400 − 4,845, recomputed
});

test('editing an older odometer reading moves every figure that depended on it', () => {
  const before = calculateMileageIntervals(
    [fill(4845, 8.0, '2026-08-01'), fill(5118, 6.0, '2026-08-13')], [],
  );
  const corrected = calculateMileageIntervals(
    [fill(4845, 8.0, '2026-08-01'), fill(5018, 6.0, '2026-08-13')], [],
  );
  expect(before[0]!.distanceMetres).toBe(273_000);
  expect(corrected[0]!.distanceMetres).toBe(173_000);
  expect(kmPerL(corrected[0]!.efficiency)).toBe(28.83);
});

test('a high starting odometer never inflates the distance measured', () => {
  for (const start of [5_000, 25_000, 80_000, 180_000]) {
    const intervals = calculateMileageIntervals(
      [fill(start, 8.0, '2026-08-01'), fill(start + 273, 6.0, '2026-08-13')], [],
    );
    expect(intervals[0]!.distanceMetres).toBe(273_000);
    expect(kmPerL(intervals[0]!.efficiency)).toBe(45.5);
  }
});

import type { MileageInterval } from './mileage';
import { intervalsToReliable, mileageIntervalTotals } from './mileageStats';

function interval(distanceMetres: number, fuelMl: number): MileageInterval {
  return {
    fromEntryId: 'a',
    toEntryId: 'b',
    fromOdometerMetres: 0,
    toOdometerMetres: distanceMetres,
    distanceMetres,
    fuelMl,
    rawFuelMl: fuelMl,
    adjustmentMl: 0,
    efficiency: { metresPerMl: distanceMetres / fuelMl },
    confidence: 'high',
    partialFills: 0,
    unknownFills: 0,
    hasAdjustments: false,
    fromDate: '2026-09-01',
    date: '2026-09-13',
  };
}

describe('mileageIntervalTotals', () => {
  it('sums distance and fuel across every interval', () => {
    const totals = mileageIntervalTotals([
      interval(338_000, 8_200),
      interval(412_000, 10_100),
    ]);

    expect(totals.distanceMetres).toBe(750_000);
    expect(totals.fuelMl).toBe(18_300);
    expect(totals.count).toBe(2);
  });

  it('returns zeroes and a zero count for no intervals', () => {
    expect(mileageIntervalTotals([])).toEqual({ distanceMetres: 0, fuelMl: 0, count: 0 });
  });

  it('divides to the same figure the distance-weighted average reports', () => {
    const totals = mileageIntervalTotals([interval(400_000, 10_000), interval(200_000, 5_000)]);
    // 600 km on 15 L is 40 km/L, which is what both intervals ran at.
    expect(totals.distanceMetres / totals.fuelMl).toBeCloseTo(40, 6);
  });

  it('counts fuel after adjustments, not the raw purchase', () => {
    const adjusted: MileageInterval = {
      ...interval(300_000, 7_000),
      rawFuelMl: 9_000,
      adjustmentMl: -2_000,
      hasAdjustments: true,
    };
    expect(mileageIntervalTotals([adjusted]).fuelMl).toBe(7_000);
  });
});

describe('intervalsToReliable', () => {
  it('counts down to the five-interval threshold', () => {
    expect(intervalsToReliable(0)).toBe(5);
    expect(intervalsToReliable(2)).toBe(3);
    expect(intervalsToReliable(4)).toBe(1);
  });

  it('never goes negative once the threshold is met', () => {
    expect(intervalsToReliable(5)).toBe(0);
    expect(intervalsToReliable(12)).toBe(0);
  });

  it('treats a nonsense count as nothing measured', () => {
    expect(intervalsToReliable(Number.NaN)).toBe(5);
    expect(intervalsToReliable(-3)).toBe(5);
  });

  it('honours a different threshold', () => {
    expect(intervalsToReliable(1, 3)).toBe(2);
  });
});

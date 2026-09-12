import { buildAssistantContext } from './buildContext';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { UnitPreferences } from '@/types';

const units: UnitPreferences = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l', costBasis: 'running' };
const bike = { nickname: 'Hornet', manufacturer: 'Honda', model: 'Hornet 2.0', year: 2025 };

const analytics = {
  currency: 'BDT', units, today: '2026-09-01',
  odometer: { currentMetres: 5_588_000, totalDistanceMetres: 1_688_000, latest: { date: '2026-09-01' }, points: [] },
  // Efficiency is canonical metres-per-millilitre, which equals km/L numerically.
  mileage: {
    average: { metresPerMl: 46.2 }, lastFive: { metresPerMl: 47.5 },
    best: { efficiency: { metresPerMl: 49.1 } }, worst: { efficiency: { metresPerMl: 44.2 } },
    count: 9, intervals: [],
  },
  hasReliableStats: true,
  ownership: { runningCostMinor: 2_684_000, costPerDistanceScaled: 4_830_000 },
  thisMonthMinor: 426_800,
  fuel: { entries: [], adjustments: [], thisMonthSpendMinor: 264_600, averagePricePerLitreMinor: 14_500 },
  maintenance: { counts: { overdue: 1, due_soon: 2 }, rules: [] },
  ledger: [],
} as unknown as BikeAnalytics;

test('sends formatted figures, never raw numbers for the model to compute with', () => {
  const ctx = buildAssistantContext(analytics, units, bike, []);
  // Already formatted: the model quotes these verbatim and cannot disagree with
  // what the Dashboard renders beside them.
  expect(ctx.bike.odometer).toBe('5,588 km');
  expect(ctx.costs.runningCost).toBe('BDT 26,840');
  expect(ctx.mileage.average).toBe('46.2 km/L');
  expect(ctx.mileage.best).toBe('49.1 km/L');
  expect(typeof ctx.costs.thisMonth).toBe('string');
});

test('stays small enough to be cheap on every question', () => {
  const size = JSON.stringify(buildAssistantContext(analytics, units, bike, [])).length;
  expect(size).toBeLessThan(24_000);
});

test('a figure that cannot be computed travels as the em dash, not a zero', () => {
  const empty = { ...analytics, mileage: { ...analytics.mileage, average: null, lastFive: null, best: null, worst: null } } as unknown as BikeAnalytics;
  const ctx = buildAssistantContext(empty, units, bike, []);
  expect(ctx.mileage.average).toBe('—');
  expect(ctx.mileage.best).toBe('—');
});

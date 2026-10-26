import type { Accessory } from '@/types';
import { accessorySpendMinor, accessoryTotals } from './accessorySpend';

describe('accessory spend', () => {
  it('adds purchase and fitting into the one figure Costs counts', () => {
    // The board: ৳1,650 + ৳186 fitting = ৳1,836.
    expect(accessorySpendMinor(165_000, 18_600)).toBe(183_600);
  });

  it('counts a missing fitting cost as nothing, because nothing was paid', () => {
    expect(accessorySpendMinor(220_000, null)).toBe(220_000);
  });

  it('is null while nothing has been entered, so the helper shows no figure', () => {
    expect(accessorySpendMinor(null, null)).toBeNull();
  });

  it('stays an integer in minor units — no float ever enters the money path', () => {
    expect(Number.isInteger(accessorySpendMinor(1, 2))).toBe(true);
  });
});

describe('accessoryTotals', () => {
  const accessory = (purchaseCostMinor: number, installationCostMinor: number): Accessory =>
    ({ purchaseCostMinor, installationCostMinor }) as unknown as Accessory;

  it('adds purchase and fitting across the list, once each', () => {
    expect(accessoryTotals([accessory(950_000, 50_000), accessory(320_000, 30_000), accessory(70_000, 0)])).toEqual({
      count: 3,
      purchaseMinor: 1_340_000,
      fittingMinor: 80_000,
      totalMinor: 1_420_000,
    });
  });

  it('is all zeros for nothing fitted', () => {
    expect(accessoryTotals([])).toEqual({ count: 0, purchaseMinor: 0, fittingMinor: 0, totalMinor: 0 });
  });
});

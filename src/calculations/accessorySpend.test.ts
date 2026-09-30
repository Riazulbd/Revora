import { accessorySpendMinor } from './accessorySpend';

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

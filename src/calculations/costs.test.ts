import type { LedgerSource } from '@/types';
import { allowanceUnusedMinor, ledgerRowTag } from './costs';
import { calculateAllowance } from './ownership';

describe('every ledger row carries the board’s own tag', () => {
  const cases: [LedgerSource, string][] = [
    ['fuel', 'FUEL'],
    ['service', 'SERVICE'],
    ['part', 'PART'],
    ['accessory', 'ACCESSORY'],
    ['maintenance', 'MAINTENANCE'],
    ['manual', 'EXPENSE'],
  ];

  it.each(cases)('tags a %s line %s', (source, expected) => {
    expect(ledgerRowTag(source)).toBe(expected);
  });

  it('never leaves a line untagged', () => {
    for (const [source] of cases) expect(ledgerRowTag(source)).not.toBe('');
  });
});

describe('unused allowance', () => {
  const summary = (allowanceMinor: number, monthFuelSpendMinor: number) =>
    calculateAllowance({
      enabled: true,
      monthlyAllowanceMinor: allowanceMinor,
      monthFuelSpendMinor,
      monthTotalSpendMinor: monthFuelSpendMinor,
    });

  it('is what the fuel spend left behind', () => {
    // ৳3,000 allowance, ৳2,840 of fuel — the board's "৳160 … unused".
    expect(allowanceUnusedMinor(summary(300_000, 284_000))).toBe(16_000);
  });

  it('is zero, not negative, once the spend passes the allowance', () => {
    expect(allowanceUnusedMinor(summary(300_000, 450_000))).toBe(0);
  });

  it('is zero when no allowance was set', () => {
    expect(allowanceUnusedMinor(summary(0, 450_000))).toBe(0);
  });

  it('is the whole allowance in a month with no fuel', () => {
    expect(allowanceUnusedMinor(summary(300_000, 0))).toBe(300_000);
  });
});

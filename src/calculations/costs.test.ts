import type { LedgerEntry, LedgerSource } from '@/types';
import {
  allowanceSplit,
  allowanceUnusedMinor,
  costCategories,
  daysInMonth,
  earliestMonthKey,
  ledgerRowTag,
  monthCosts,
  nextMonthKey,
  previousMonthKey,
} from './costs';
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

const line = (over: Partial<LedgerEntry> & { id: string; date: string; amountMinor: number }): LedgerEntry => ({
  sourceId: over.id,
  source: 'fuel',
  label: 'Fuel',
  currency: 'BDT',
  ...over,
});

describe('month keys', () => {
  it('steps across a year boundary', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(nextMonthKey('2025-12')).toBe('2026-01');
  });

  it('knows the length of a month', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-09')).toBe(30);
  });

  it('finds the oldest month, or nothing', () => {
    expect(earliestMonthKey([])).toBeNull();
    expect(earliestMonthKey([line({ id: 'a', date: '2026-09-01', amountMinor: 1 }), line({ id: 'b', date: '2026-03-20', amountMinor: 1 })])).toBe('2026-03');
  });
});

describe('costCategories', () => {
  it('groups by source, and hand-entered expenses by their own category', () => {
    const groups = costCategories(
      [
        line({ id: 'a', date: '2026-09-01', amountMinor: 600 }),
        line({ id: 'b', date: '2026-09-02', amountMinor: 300, source: 'service', label: 'Brake pads' }),
        line({ id: 'c', date: '2026-09-03', amountMinor: 100, source: 'manual', label: 'Bashundhara parking', category: 'parking' }),
        line({ id: 'd', date: '2026-09-04', amountMinor: 50, source: 'manual', label: 'Parking', category: 'parking' }),
      ],
      'BDT',
    );
    expect(groups.map((g) => [g.key, g.amountMinor])).toEqual([
      ['fuel', 600],
      ['service', 300],
      ['manual:parking', 150],
    ]);
    expect(groups[2]?.label).toBe('Parking');
    expect(groups.reduce((sum, g) => sum + g.share, 0)).toBeCloseTo(1, 6);
  });

  it('leaves another currency out rather than adding it in', () => {
    expect(costCategories([line({ id: 'a', date: '2026-09-01', amountMinor: 600, currency: 'USD' })], 'BDT')).toEqual([]);
  });
});

describe('monthCosts', () => {
  const ledger = [
    line({ id: 'a', date: '2026-09-13', amountMinor: 100_400 }),
    line({ id: 'b', date: '2026-09-09', amountMinor: 165_000, source: 'service', label: 'Brake pads' }),
    line({ id: 'c', date: '2026-08-29', amountMinor: 95_500 }),
    line({ id: 'd', date: '2026-08-15', amountMinor: 95_500 }),
  ];

  it('totals the month and spreads it over the days so far', () => {
    const month = monthCosts(ledger, 'BDT', '2026-09', '2026-09-16');
    expect(month.totalMinor).toBe(265_400);
    expect(month.lines).toHaveLength(2);
    expect(month.daysElapsed).toBe(16);
    expect(month.perDayMinor).toBe(Math.round(265_400 / 16));
    expect(month.versusPrevious).toEqual({ percent: 39, lower: false, previousKey: '2026-08' });
  });

  it('uses the whole month once it is over, and has no per-day figure for nothing', () => {
    const august = monthCosts(ledger, 'BDT', '2026-08', '2026-09-16');
    expect(august.daysElapsed).toBe(31);
    expect(august.versusPrevious).toBeNull();
    expect(monthCosts(ledger, 'BDT', '2026-07', '2026-09-16').perDayMinor).toBeNull();
  });
});

describe('allowanceSplit', () => {
  it('divides the fuel bill between employer and rider', () => {
    const split = allowanceSplit({
      enabled: true,
      allowanceMinor: 300_000,
      fuelSpendMinor: 412_000,
      usedMinor: 300_000,
      usedFraction: 1,
      riderFuelCostMinor: 112_000,
      trueOperatingCostMinor: 412_000,
    });
    expect(split?.coveredShare).toBeCloseTo(0.728, 3);
    expect(split?.riderShare).toBeCloseTo(0.272, 3);
  });

  it('is null when nothing was spent', () => {
    expect(
      allowanceSplit({
        enabled: true,
        allowanceMinor: 300_000,
        fuelSpendMinor: 0,
        usedMinor: 0,
        usedFraction: 0,
        riderFuelCostMinor: 0,
        trueOperatingCostMinor: 0,
      }),
    ).toBeNull();
  });
});

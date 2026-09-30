
import type { LedgerEntry, LedgerSource } from '@/types';
import { calculateOwnershipCost } from './ownership';

const line = (source: LedgerSource, date: string, amountMinor: number): LedgerEntry => ({
  id: `l-${source}-${date}`,
  sourceId: `s-${source}`,
  source,
  label: source,
  date,
  amountMinor,
  currency: 'BDT',
});

describe('cost per distance is shown from the first kilometre', () => {
  const ledger = [line('fuel', '2026-09-01', 145_000), line('service', '2026-09-05', 600_000)];

  it('gives a rider with 400 km their own arithmetic rather than a dash', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger,
      distanceMetres: 400_000,
      distanceUnit: 'km',
    });
    expect(cost.costPerDistanceScaled).not.toBeNull();
    // BDT 7,450 over 400 km = BDT 18.63/km, scaled by 100.
    expect(cost.costPerDistanceScaled).toBe(186_250);
    expect(cost.costPerDistanceSettled).toBe(false);
  });

  it('marks the figure settled once one purchase no longer decides it', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger,
      distanceMetres: 1_000_000,
      distanceUnit: 'km',
    });
    expect(cost.costPerDistanceSettled).toBe(true);
  });

  it('still refuses to divide by no distance at all', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger,
      distanceMetres: 0,
      distanceUnit: 'km',
    });
    expect(cost.costPerDistanceScaled).toBeNull();
  });
});

describe('ownership cost is never summed across currencies', () => {
  const mixed: LedgerEntry[] = [
    { ...line('fuel', '2026-09-01', 100_000), currency: 'BDT' },
    { ...line('service', '2026-09-05', 5_000), currency: 'USD' },
  ];

  it('totals only the reporting currency the caller named', () => {
    // BDT 1,000.00 of fuel and USD 50.00 of service. Reported in BDT, the
    // running cost is 100_000 — never 105_000, which is money in no currency.
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger: mixed,
      distanceMetres: 1_000_000,
      distanceUnit: 'km',
      currency: 'BDT',
    });
    expect(cost.runningCostMinor).toBe(100_000);
    expect(cost.breakdown.total).toBe(100_000);
    expect(cost.currency).toBe('BDT');
    expect(cost.mixedCurrencies).toBe(true);
    expect(cost.currencies).toEqual(['BDT', 'USD']);
    expect(cost.totalsByCurrency).toEqual([
      { currency: 'BDT', totalMinor: 100_000 },
      { currency: 'USD', totalMinor: 5_000 },
    ]);
  });

  it('reports the same ledger in the other currency when asked', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger: mixed,
      distanceMetres: 1_000_000,
      distanceUnit: 'km',
      currency: 'USD',
    });
    expect(cost.runningCostMinor).toBe(5_000);
    // USD 50.00 over 1,000 km = 5 cents/km → 5 × RATE_SCALE(100) = 500.
    expect(cost.costPerDistanceScaled).toBe(500);
  });

  it('adds the purchase price to the reporting currency’s running cost', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: 28_500_000 },
      ledger: mixed,
      distanceMetres: 1_000_000,
      distanceUnit: 'km',
      currency: 'BDT',
    });
    // The purchase price is held in the bike's own currency: 28,500,000 + 100,000.
    expect(cost.totalOwnershipMinor).toBe(28_600_000);
  });

  it('says a single-currency ledger is not mixed', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger: [line('fuel', '2026-09-01', 145_000)],
      distanceMetres: 1_000_000,
      distanceUnit: 'km',
      currency: 'BDT',
    });
    expect(cost.mixedCurrencies).toBe(false);
    expect(cost.currencies).toEqual(['BDT']);
    expect(cost.runningCostMinor).toBe(145_000);
  });
});


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

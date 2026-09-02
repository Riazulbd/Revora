import type { FuelAdjustment } from '@/types';
import {
  adjustmentMlInRange,
  deriveFuelAmounts,
  litresFromPriceAndTotal,
  normaliseFuelAmounts,
  priceFromLitresAndTotal,
  totalAdjustmentMl,
  totalFromLitresAndPrice,
} from './fuel';

const adj = (litres: number, date: string): FuelAdjustment => ({
  id: `a-${date}-${litres}`,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  date,
  millilitres: Math.round(litres * 1000),
  reason: 'other',
  approximate: false,
  note: null,
  clientRef: 'r',
});

describe('price / quantity / total', () => {
  it('derives the total from litres and price per litre', () => {
    // 9 L at BDT 145 = BDT 1,305
    expect(totalFromLitresAndPrice(9000, 14500)).toBe(130500);
  });

  it('derives price per litre from litres and total', () => {
    expect(priceFromLitresAndTotal(9000, 130500)).toBe(14500);
  });

  it('derives litres from price and total', () => {
    expect(litresFromPriceAndTotal(14500, 130500)).toBe(9000);
  });

  it('round-trips awkward numbers without drift', () => {
    const litres = 8_350; // 8.35 L
    const price = 13_275; // BDT 132.75
    const total = totalFromLitresAndPrice(litres, price);
    expect(total).toBe(110_846); // 1108.4625 → 1108.46
    expect(priceFromLitresAndTotal(litres, total)).toBe(13_275);
  });

  it('refuses to divide by zero litres', () => {
    expect(priceFromLitresAndTotal(0, 130500)).toBeNull();
    expect(litresFromPriceAndTotal(0, 130500)).toBeNull();
  });
});

describe('deriveFuelAmounts', () => {
  it('fills the total when litres and price are known', () => {
    const out = deriveFuelAmounts(
      { litresMl: 9000, pricePerLitreMinor: 14500, totalCostMinor: null },
      'litres',
    );
    expect(out.totalCostMinor).toBe(130500);
  });

  it('fills the price when litres and total are known', () => {
    const out = deriveFuelAmounts(
      { litresMl: 9000, pricePerLitreMinor: null, totalCostMinor: 130500 },
      'total',
    );
    expect(out.pricePerLitreMinor).toBe(14500);
  });

  it('recomputes the price when the rider last edited the total', () => {
    const out = deriveFuelAmounts(
      { litresMl: 9000, pricePerLitreMinor: 14500, totalCostMinor: 135000 },
      'total',
    );
    expect(out.pricePerLitreMinor).toBe(15000);
    expect(out.totalCostMinor).toBe(135000);
  });

  it('recomputes the total when the rider last edited the litres', () => {
    const out = deriveFuelAmounts(
      { litresMl: 10_000, pricePerLitreMinor: 14500, totalCostMinor: 130500 },
      'litres',
    );
    expect(out.totalCostMinor).toBe(145000);
  });

  it('leaves an incomplete form alone', () => {
    const fields = { litresMl: null, pricePerLitreMinor: 14500, totalCostMinor: null };
    expect(deriveFuelAmounts(fields, 'price')).toEqual(fields);
  });
});

describe('adjustments on the timeline', () => {
  it('nets signed adjustments', () => {
    expect(totalAdjustmentMl([adj(-0.5, '2026-01-05'), adj(-0.5, '2026-01-06'), adj(2, '2026-01-07')])).toBe(
      1000,
    );
  });

  it('selects by half-open date range: after the opening fill, through the closing one', () => {
    const list = [adj(-1, '2026-01-01'), adj(-1, '2026-01-05'), adj(-1, '2026-01-10'), adj(-1, '2026-01-11')];
    expect(adjustmentMlInRange(list, '2026-01-01', '2026-01-10')).toBe(-2000);
  });

  it('returns zero for an empty range', () => {
    expect(adjustmentMlInRange([], '2026-01-01', '2026-01-10')).toBe(0);
  });
});

describe('normaliseFuelAmounts', () => {
  it('prefers the entered price and recomputes the total from it', () => {
    expect(normaliseFuelAmounts({ litresMl: 9000, pricePerLitreMinor: 14500, totalCostMinor: 999 })).toEqual({
      litresMl: 9000,
      pricePerLitreMinor: 14500,
      totalCostMinor: 130500,
    });
  });

  it('falls back to the total when no price was entered', () => {
    expect(normaliseFuelAmounts({ litresMl: 9000, pricePerLitreMinor: null, totalCostMinor: 130500 })).toEqual({
      litresMl: 9000,
      pricePerLitreMinor: 14500,
      totalCostMinor: 130500,
    });
  });

  it('rejects an entry with no money on it at all', () => {
    expect(normaliseFuelAmounts({ litresMl: 9000, pricePerLitreMinor: null, totalCostMinor: null })).toBeNull();
    expect(normaliseFuelAmounts({ litresMl: 0, pricePerLitreMinor: 14500, totalCostMinor: null })).toBeNull();
  });
});

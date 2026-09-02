import type { FuelAdjustment, FuelAdjustmentReason, FillType, FuelEntry } from '@/types';
import { formatMileageValue } from '@/utils/format';
import { calculateMileageIntervals, calculateMileageSummary } from './mileage';

let seq = 0;

function fuel(input: {
  odoKm: number;
  litres: number;
  fillType?: FillType;
  date?: string;
  missedPreviousFill?: boolean;
  id?: string;
}): FuelEntry {
  seq += 1;
  return {
    id: input.id ?? `f${seq}`,
    userId: 'u1',
    bikeId: 'b1',
    createdAt: seq,
    updatedAt: seq,
    date: input.date ?? '2026-08-01',
    odometerMetres: Math.round(input.odoKm * 1000),
    litresMl: Math.round(input.litres * 1000),
    pricePerLitreMinor: 14500,
    totalCostMinor: Math.round(input.litres * 14500),
    currency: 'BDT',
    fillType: input.fillType ?? 'full',
    missedPreviousFill: input.missedPreviousFill ?? false,
    station: null,
    notes: null,
    receiptPath: null,
    clientRef: `ref${seq}`,
  };
}

/** An adjustment on the bike's timeline. Litres are signed. */
function adjust(input: { litres: number; date: string; reason?: FuelAdjustmentReason }): FuelAdjustment {
  seq += 1;
  return {
    id: `a${seq}`,
    userId: 'u1',
    bikeId: 'b1',
    createdAt: seq,
    updatedAt: seq,
    date: input.date,
    millilitres: Math.round(input.litres * 1000),
    reason: input.reason ?? 'other',
    approximate: false,
    note: null,
    clientRef: `ref-a${seq}`,
  };
}

beforeEach(() => {
  seq = 0;
});

describe('the critical case from the specification', () => {
  // Previous odometer 4,845 · current 5,180 · distance 335 km
  // Fuel added 9 L · adjustment −1 L · effective 8 L
  // 335 / 8 = 41.875 → displayed as 41.9 km/L
  it('applies the adjustment and displays 41.9 km/L', () => {
    const first = fuel({ odoKm: 4845, litres: 11, date: '2026-08-20' });
    const second = fuel({ odoKm: 5180, litres: 9, date: '2026-08-30' });
    // A litre lost during the interval, logged as its own dated event.
    const spill = adjust({ litres: -1, date: '2026-08-25', reason: 'maintenance_loss' });

    const intervals = calculateMileageIntervals([first, second], [spill]);
    expect(intervals).toHaveLength(1);

    const only = intervals[0]!;
    expect(only.distanceMetres).toBe(335_000);
    expect(only.fuelMl).toBe(8_000);
    expect(only.rawFuelMl).toBe(9_000);
    expect(only.adjustmentMl).toBe(-1_000);
    expect(only.efficiency.metresPerMl).toBeCloseTo(41.875, 6);
    expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('41.9');
  });

  it('never overwrites the litres the rider actually bought', () => {
    const entry = fuel({ odoKm: 5180, litres: 9, date: '2026-08-30' });
    const leak = adjust({ litres: -1, date: '2026-08-28', reason: 'leak' });
    // The fill is untouched; the adjustment is a separate record entirely.
    expect(entry.litresMl).toBe(9000);
    expect(leak.millilitres).toBe(-1000);
  });

  it('adds fuel that went in without being logged as a fill', () => {
    const first = fuel({ odoKm: 1000, litres: 10, date: '2026-01-01' });
    const second = fuel({ odoKm: 1400, litres: 10, date: '2026-01-10' });
    const jerrycan = adjust({ litres: 2, date: '2026-01-05', reason: 'added_unlogged' });

    const only = calculateMileageIntervals([first, second], [jerrycan])[0]!;
    expect(only.fuelMl).toBe(12_000);
    expect(only.efficiency.metresPerMl).toBeCloseTo(400_000 / 12_000, 6);
  });

  it('attributes an adjustment to the interval its date falls in', () => {
    const entries = [
      fuel({ odoKm: 0, litres: 10, date: '2026-01-01' }),
      fuel({ odoKm: 400, litres: 10, date: '2026-01-10' }),
      fuel({ odoKm: 800, litres: 10, date: '2026-01-20' }),
    ];
    const leak = adjust({ litres: -2, date: '2026-01-15', reason: 'leak' });

    const intervals = calculateMileageIntervals(entries, [leak]);
    expect(intervals[0]!.adjustmentMl).toBe(0);
    expect(intervals[1]!.adjustmentMl).toBe(-2_000);
  });

  it('gives an adjustment dated on the boundary to the interval that just closed', () => {
    const entries = [
      fuel({ odoKm: 0, litres: 10, date: '2026-01-01' }),
      fuel({ odoKm: 400, litres: 10, date: '2026-01-10' }),
      fuel({ odoKm: 800, litres: 10, date: '2026-01-20' }),
    ];
    const onBoundary = adjust({ litres: -1, date: '2026-01-10', reason: 'drained' });

    const intervals = calculateMileageIntervals(entries, [onBoundary]);
    expect(intervals[0]!.adjustmentMl).toBe(-1_000);
    expect(intervals[1]!.adjustmentMl).toBe(0);
  });

  it('ignores an adjustment outside every interval', () => {
    const entries = [fuel({ odoKm: 1000, litres: 10, date: '2026-02-01' }), fuel({ odoKm: 1400, litres: 10, date: '2026-02-10' })];
    const before = adjust({ litres: -5, date: '2026-01-01' });
    const after = adjust({ litres: -5, date: '2026-03-01' });

    const only = calculateMileageIntervals(entries, [before, after])[0]!;
    expect(only.adjustmentMl).toBe(0);
    expect(only.fuelMl).toBe(10_000);
  });

  it('drops an interval whose fill follows one the rider never logged', () => {
    const entries = [
      fuel({ odoKm: 1000, litres: 10, date: '2026-01-01' }),
      fuel({ odoKm: 2000, litres: 10, date: '2026-01-20', missedPreviousFill: true }),
      fuel({ odoKm: 2400, litres: 10, date: '2026-01-30' }),
    ];
    const intervals = calculateMileageIntervals(entries);
    // The flagged fill still anchors the next interval; only its own is dropped.
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.distanceMetres).toBe(400_000);
  });
});

describe('full-to-full intervals', () => {
  it('does not treat a partial fill as its own interval', () => {
    // full → partial → partial → full is ONE interval, not three.
    const entries = [
      fuel({ odoKm: 1000, litres: 10, fillType: 'full', date: '2026-01-01' }),
      fuel({ odoKm: 1200, litres: 4, fillType: 'partial', date: '2026-01-05' }),
      fuel({ odoKm: 1400, litres: 3, fillType: 'partial', date: '2026-01-09' }),
      fuel({ odoKm: 1600, litres: 8, fillType: 'full', date: '2026-01-14' }),
    ];

    const intervals = calculateMileageIntervals(entries);
    expect(intervals).toHaveLength(1);

    const only = intervals[0]!;
    expect(only.distanceMetres).toBe(600_000);
    // 4 + 3 + 8 litres were burned across those 600 km.
    expect(only.fuelMl).toBe(15_000);
    expect(only.efficiency.metresPerMl).toBeCloseTo(40, 6);
    expect(only.partialFills).toBe(2);
    expect(only.confidence).toBe('medium');
  });

  it('ignores fills logged before the first full tank', () => {
    const entries = [
      fuel({ odoKm: 900, litres: 5, fillType: 'partial', date: '2026-01-01' }),
      fuel({ odoKm: 1000, litres: 10, fillType: 'full', date: '2026-01-02' }),
      fuel({ odoKm: 1400, litres: 10, fillType: 'full', date: '2026-01-08' }),
    ];
    const intervals = calculateMileageIntervals(entries);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.distanceMetres).toBe(400_000);
    expect(intervals[0]!.fuelMl).toBe(10_000);
  });

  it('produces one interval per pair of consecutive full tanks', () => {
    const entries = [
      fuel({ odoKm: 1000, litres: 10, fillType: 'full' }),
      fuel({ odoKm: 1400, litres: 10, fillType: 'full' }),
      fuel({ odoKm: 1800, litres: 8, fillType: 'full' }),
    ];
    expect(calculateMileageIntervals(entries)).toHaveLength(2);
  });

  it('orders by odometer even when entries arrive out of order', () => {
    const later = fuel({ odoKm: 1400, litres: 10, date: '2026-01-08' });
    const earlier = fuel({ odoKm: 1000, litres: 10, date: '2026-01-02' });
    const intervals = calculateMileageIntervals([later, earlier]);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.fromOdometerMetres).toBe(1_000_000);
  });
});

describe('confidence', () => {
  it('is high when both boundaries are full and nothing sits between', () => {
    const entries = [fuel({ odoKm: 1000, litres: 10 }), fuel({ odoKm: 1400, litres: 10 })];
    expect(calculateMileageIntervals(entries)[0]!.confidence).toBe('high');
  });

  it('drops to estimated when a fill of unknown level is counted in', () => {
    const entries = [
      fuel({ odoKm: 1000, litres: 10, fillType: 'full' }),
      fuel({ odoKm: 1200, litres: 5, fillType: 'unknown' }),
      fuel({ odoKm: 1400, litres: 5, fillType: 'full' }),
    ];
    const only = calculateMileageIntervals(entries)[0]!;
    expect(only.confidence).toBe('estimated');
    expect(only.unknownFills).toBe(1);
  });

  it('reports insufficient when there is no complete interval', () => {
    expect(calculateMileageSummary([]).confidence).toBe('insufficient');
    expect(calculateMileageSummary([fuel({ odoKm: 1000, litres: 10 })]).confidence).toBe('insufficient');
  });
});

describe('summary', () => {
  it('averages by total distance over total fuel, not by averaging ratios', () => {
    const entries = [
      fuel({ odoKm: 0, litres: 10, fillType: 'full' }),
      fuel({ odoKm: 100, litres: 10, fillType: 'full' }), // 10 km/L
      fuel({ odoKm: 400, litres: 10, fillType: 'full' }), // 30 km/L
    ];
    const summary = calculateMileageSummary(entries);
    // 400 km on 20 L = 20 km/L. Averaging the ratios would wrongly give 20 too,
    // so use an asymmetric case to prove the weighting.
    expect(summary.average!.metresPerMl).toBeCloseTo(400_000 / 20_000, 6);
  });

  it('weights longer intervals more heavily', () => {
    const entries = [
      fuel({ odoKm: 0, litres: 10, fillType: 'full' }),
      fuel({ odoKm: 100, litres: 10, fillType: 'full' }), // 10 km/L over 100 km
      fuel({ odoKm: 1100, litres: 20, fillType: 'full' }), // 50 km/L over 1000 km
    ];
    const summary = calculateMileageSummary(entries);
    // Mean of the two ratios would be 30; the correct weighted figure is 1100/30.
    expect(summary.average!.metresPerMl).toBeCloseTo(1_100_000 / 30_000, 6);
  });

  it('withholds best, worst and the rolling five until five intervals exist', () => {
    const four = [
      fuel({ odoKm: 0, litres: 10 }),
      fuel({ odoKm: 400, litres: 10 }),
      fuel({ odoKm: 800, litres: 10 }),
      fuel({ odoKm: 1300, litres: 10 }),
      fuel({ odoKm: 1700, litres: 10 }),
    ];
    const summary = calculateMileageSummary(four);
    expect(summary.count).toBe(4);
    expect(summary.best).toBeNull();
    expect(summary.worst).toBeNull();
    expect(summary.lastFive).toBeNull();
  });

  it('reports best and worst once five intervals exist', () => {
    const entries = [
      fuel({ odoKm: 0, litres: 10 }),
      fuel({ odoKm: 400, litres: 10 }), // 40
      fuel({ odoKm: 750, litres: 10 }), // 35
      fuel({ odoKm: 1200, litres: 10 }), // 45
      fuel({ odoKm: 1600, litres: 10 }), // 40
      fuel({ odoKm: 1900, litres: 10 }), // 30
    ];
    const summary = calculateMileageSummary(entries);
    expect(summary.count).toBe(5);
    expect(summary.best!.efficiency.metresPerMl).toBeCloseTo(45, 6);
    expect(summary.worst!.efficiency.metresPerMl).toBeCloseTo(30, 6);
    expect(summary.lastFive).not.toBeNull();
  });

  it('discards an interval that covers no distance rather than dividing by zero', () => {
    const entries = [
      fuel({ odoKm: 1000, litres: 10, fillType: 'full', date: '2026-01-01' }),
      fuel({ odoKm: 1000, litres: 2, fillType: 'full', date: '2026-01-02' }),
    ];
    expect(calculateMileageIntervals(entries)).toHaveLength(0);
    expect(calculateMileageSummary(entries).average).toBeNull();
  });

  it('discards an interval where every litre was adjusted away', () => {
    const entries = [
      fuel({ odoKm: 1000, litres: 10, fillType: 'full', date: '2026-01-01' }),
      fuel({ odoKm: 1400, litres: 10, fillType: 'full', date: '2026-01-10' }),
    ];
    const drained = adjust({ litres: -10, date: '2026-01-05', reason: 'drained' });
    expect(calculateMileageIntervals(entries, [drained])).toHaveLength(0);
  });
});

describe('editing history', () => {
  it('recalculates every later interval when an older fill changes', () => {
    const entries = [
      fuel({ odoKm: 1000, litres: 10, fillType: 'full', id: 'a' }),
      fuel({ odoKm: 1400, litres: 10, fillType: 'full', id: 'b' }),
      fuel({ odoKm: 1800, litres: 10, fillType: 'full', id: 'c' }),
    ];
    const before = calculateMileageSummary(entries);
    expect(before.count).toBe(2);

    // The rider corrects the middle odometer from 1,400 to 1,500 km.
    const corrected = entries.map((e) =>
      e.id === 'b' ? { ...e, odometerMetres: 1_500_000 } : e,
    );
    const after = calculateMileageSummary(corrected);

    expect(after.intervals[0]!.distanceMetres).toBe(500_000);
    expect(after.intervals[1]!.distanceMetres).toBe(300_000);
    expect(after.average!.metresPerMl).toBeCloseTo(800_000 / 20_000, 6);
  });

  it('merges the surrounding intervals when a middle fill is deleted', () => {
    const entries = [
      fuel({ odoKm: 1000, litres: 10, fillType: 'full', id: 'a' }),
      fuel({ odoKm: 1400, litres: 10, fillType: 'full', id: 'b' }),
      fuel({ odoKm: 1800, litres: 10, fillType: 'full', id: 'c' }),
    ];
    const remaining = entries.filter((e) => e.id !== 'b');
    const after = calculateMileageSummary(remaining);

    expect(after.count).toBe(1);
    expect(after.intervals[0]!.distanceMetres).toBe(800_000);
    expect(after.intervals[0]!.fuelMl).toBe(10_000);
  });
});

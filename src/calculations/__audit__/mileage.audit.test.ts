/**
 * QA audit — fuel & mileage calculations (sections 3, 4-mileage, 4-adjustments).
 *
 * Every expected value below is a literal computed by hand in the comment beside
 * it. Nothing is derived by calling the module under test.
 */
import type { FillType, FuelAdjustment, FuelAdjustmentReason, FuelEntry } from '@/types';
import { formatMileageValue } from '@/utils/format';
import { calculateMileageIntervals, calculateMileageSummary } from '../mileage';
import { adjustmentMlInRange } from '../fuel';
import { efficiencyFrom } from '../units';

let seq = 0;

function fill(input: {
  id?: string;
  odoM: number;
  ml: number;
  fillType: FillType;
  date: string;
  missedPreviousFill?: boolean;
  createdAt?: number;
}): FuelEntry {
  seq += 1;
  // price 145.00 BDT/L = 14_500 poisha per litre; total = ml * 14500 / 1000
  const totalCostMinor = Math.round((input.ml * 14_500) / 1000);
  return {
    id: input.id ?? `f${seq}`,
    userId: 'u1',
    bikeId: 'b1',
    createdAt: input.createdAt ?? seq,
    updatedAt: input.createdAt ?? seq,
    date: input.date,
    odometerMetres: input.odoM,
    litresMl: input.ml,
    pricePerLitreMinor: 14_500,
    totalCostMinor,
    currency: 'BDT',
    fillType: input.fillType,
    missedPreviousFill: input.missedPreviousFill ?? false,
    station: null,
    notes: null,
    receiptPath: null,
    clientRef: `ref${seq}`,
  };
}

function adj(input: { ml: number; date: string; reason: FuelAdjustmentReason; id?: string }): FuelAdjustment {
  seq += 1;
  return {
    id: input.id ?? `a${seq}`,
    userId: 'u1',
    bikeId: 'b1',
    createdAt: seq,
    updatedAt: seq,
    date: input.date,
    millilitres: input.ml,
    reason: input.reason,
    approximate: false,
    note: null,
    clientRef: `ref-a${seq}`,
  };
}

beforeEach(() => {
  seq = 0;
});

// Core fixture: A 4,845 km Full 9 L · B 4,965 km Partial 3 L · C 5,118 km Full 4 L
const A = () => fill({ id: 'A', odoM: 4_845_000, ml: 9_000, fillType: 'full', date: '2026-08-20' });
const B = () => fill({ id: 'B', odoM: 4_965_000, ml: 3_000, fillType: 'partial', date: '2026-08-25' });
const C = () => fill({ id: 'C', odoM: 5_118_000, ml: 4_000, fillType: 'full', date: '2026-08-30' });

function assertNoNonFinite(value: unknown, path = 'root'): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number at ${path}: ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNonFinite(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) assertNoNonFinite(v, `${path}.${k}`);
  }
}

describe('MIL-01 core fixture A→B→C', () => {
  it('produces exactly one interval, 273_000 m on 7_000 ml, 39.0 km/L, medium confidence', () => {
    const intervals = calculateMileageIntervals([A(), B(), C()]);
    expect(intervals).toHaveLength(1);
    const only = intervals[0]!;
    // 5,118,000 − 4,845,000 = 273,000 m
    expect(only.distanceMetres).toBe(273_000);
    // B 3,000 + C 4,000 = 7,000 ml; A's 9,000 ml was burned before the span opened
    expect(only.fuelMl).toBe(7_000);
    expect(only.rawFuelMl).toBe(7_000);
    expect(only.adjustmentMl).toBe(0);
    // 273,000 / 7,000 = 39 exactly
    expect(only.efficiency.metresPerMl).toBe(39);
    expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('39.0');
    expect(only.confidence).toBe('medium');
    expect(only.partialFills).toBe(1);
    expect(only.unknownFills).toBe(0);
    expect(only.fromEntryId).toBe('A');
    expect(only.toEntryId).toBe('C');
  });

  it('summary reads the same interval: count 1, latest = average = 39, no provisional, no blocker', () => {
    const s = calculateMileageSummary([A(), B(), C()]);
    expect(s.count).toBe(1);
    expect(s.latest?.efficiency.metresPerMl).toBe(39);
    // one interval → average is 273,000 / 7,000 = 39
    expect(s.average?.metresPerMl).toBe(39);
    expect(s.provisional).toBeNull();
    expect(s.blockedBy).toBeNull();
    expect(s.best).toBeNull();
    expect(s.worst).toBeNull();
    expect(s.lastFive).toBeNull();
  });
});

describe('MIL-02 editing B to 3.5 L', () => {
  it('recomputes fuel to 7_500 ml and mileage to 36.4', () => {
    const edited = { ...B(), litresMl: 3_500, totalCostMinor: 50_750 }; // 3.5 × 14,500 = 50,750
    const only = calculateMileageIntervals([A(), edited, C()])[0]!;
    // 3,500 + 4,000 = 7,500 ml
    expect(only.fuelMl).toBe(7_500);
    // 273,000 / 7,500 = 36.4 exactly
    expect(only.efficiency.metresPerMl).toBe(36.4);
    expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('36.4');
  });
});

describe('MIL-03 interval boundaries', () => {
  it('an unknown fill never closes an interval', () => {
    const entries = [
      A(),
      fill({ odoM: 4_965_000, ml: 3_000, fillType: 'unknown', date: '2026-08-25' }),
      fill({ odoM: 5_118_000, ml: 4_000, fillType: 'unknown', date: '2026-08-30' }),
    ];
    expect(calculateMileageIntervals(entries)).toHaveLength(0);
    expect(calculateMileageSummary(entries).blockedBy).toBe('no_closing_full_tank');
  });

  it('a partial fill never closes an interval', () => {
    const entries = [A(), B()];
    expect(calculateMileageIntervals(entries)).toHaveLength(0);
    expect(calculateMileageSummary(entries).blockedBy).toBe('no_closing_full_tank');
  });

  it('only a full fill closes; full→unknown→full is one interval counted as estimated', () => {
    const entries = [
      A(),
      fill({ odoM: 4_965_000, ml: 3_000, fillType: 'unknown', date: '2026-08-25' }),
      C(),
    ];
    const intervals = calculateMileageIntervals(entries);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.fuelMl).toBe(7_000); // 3,000 + 4,000
    expect(intervals[0]!.unknownFills).toBe(1);
    expect(intervals[0]!.confidence).toBe('estimated');
  });

  it('consecutive full fills produce one interval each', () => {
    const entries = [
      fill({ id: 'p', odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ id: 'q', odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
      fill({ id: 'r', odoM: 1_800_000, ml: 8_000, fillType: 'full', date: '2026-01-20' }),
    ];
    const intervals = calculateMileageIntervals(entries);
    expect(intervals).toHaveLength(2);
    // p→q: 1,400,000 − 1,000,000 = 400,000 m on q's 10,000 ml = 40
    expect(intervals[0]!.fromEntryId).toBe('p');
    expect(intervals[0]!.toEntryId).toBe('q');
    expect(intervals[0]!.distanceMetres).toBe(400_000);
    expect(intervals[0]!.fuelMl).toBe(10_000);
    expect(intervals[0]!.efficiency.metresPerMl).toBe(40);
    expect(intervals[0]!.confidence).toBe('high');
    // q→r: 1,800,000 − 1,400,000 = 400,000 m on r's 8,000 ml = 50
    expect(intervals[1]!.fromEntryId).toBe('q');
    expect(intervals[1]!.toEntryId).toBe('r');
    expect(intervals[1]!.distanceMetres).toBe(400_000);
    expect(intervals[1]!.fuelMl).toBe(8_000);
    expect(intervals[1]!.efficiency.metresPerMl).toBe(50);
  });

  it('same-day entries are ordered by odometer regardless of array or creation order', () => {
    // Higher odometer created first and listed first: ordering must still run low→high.
    const later = fill({ id: 'hi', odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-03-05', createdAt: 1 });
    const earlier = fill({ id: 'lo', odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-03-05', createdAt: 2 });
    const intervals = calculateMileageIntervals([later, earlier]);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.fromEntryId).toBe('lo');
    expect(intervals[0]!.toEntryId).toBe('hi');
    expect(intervals[0]!.distanceMetres).toBe(400_000); // 1,400,000 − 1,000,000
  });

  it('equal odometers (zero distance) produce no interval', () => {
    const entries = [
      fill({ odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 1_000_000, ml: 2_000, fillType: 'full', date: '2026-01-02' }),
    ];
    const s = calculateMileageSummary(entries);
    expect(s.intervals).toHaveLength(0);
    expect(s.average).toBeNull();
    expect(s.latest).toBeNull();
    assertNoNonFinite(s);
  });

  it('equal odometers: the blocker shown is no_closing_full_tank even though both fills are full (documented as observed)', () => {
    const entries = [
      fill({ odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 1_000_000, ml: 2_000, fillType: 'full', date: '2026-01-02' }),
    ];
    // The code has no 'zero_distance' blocker; it falls through to the generic one.
    expect(calculateMileageSummary(entries).blockedBy).toBe('no_closing_full_tank');
  });
});

describe('MIL-04 zero fuel denominator', () => {
  it('a closing full fill of 0 ml produces no interval and no NaN/Infinity', () => {
    const entries = [
      fill({ odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 1_400_000, ml: 0, fillType: 'full', date: '2026-01-10' }),
    ];
    const s = calculateMileageSummary(entries);
    expect(s.intervals).toHaveLength(0);
    expect(s.average).toBeNull();
    expect(s.latest).toBeNull();
    // provisional: 400,000 m on 0 ml → efficiencyFrom returns null → no provisional
    expect(s.provisional).toBeNull();
    assertNoNonFinite(s);
  });

  it('adjustments that net the fuel to exactly zero produce no interval and no NaN/Infinity', () => {
    const entries = [
      fill({ odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
    ];
    const drained = adj({ ml: -10_000, date: '2026-01-05', reason: 'drained' });
    const s = calculateMileageSummary(entries, [drained]);
    expect(s.intervals).toHaveLength(0);
    expect(s.average).toBeNull();
    assertNoNonFinite(s);
  });

  it('adjustments that net the fuel below zero produce no interval and no negative efficiency', () => {
    const entries = [
      fill({ odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
    ];
    const over = adj({ ml: -12_000, date: '2026-01-05', reason: 'leak' });
    const s = calculateMileageSummary(entries, [over]);
    expect(s.intervals).toHaveLength(0);
    expect(s.average).toBeNull();
    assertNoNonFinite(s);
  });

  it('efficiencyFrom guards both denominators directly', () => {
    expect(efficiencyFrom(273_000, 0)).toBeNull();
    expect(efficiencyFrom(0, 7_000)).toBeNull();
    expect(efficiencyFrom(-1, 7_000)).toBeNull();
    expect(efficiencyFrom(273_000, -1)).toBeNull();
    expect(formatMileageValue(null, 'km_per_l')).toBe('—');
    expect(formatMileageValue({ metresPerMl: Number.NaN }, 'km_per_l')).toBe('—');
    expect(formatMileageValue({ metresPerMl: Number.POSITIVE_INFINITY }, 'km_per_l')).toBe('—');
  });
});

describe('MIL-05 missedPreviousFill', () => {
  it('on the closing fill discards the interval and names missed_fill', () => {
    const c = { ...C(), missedPreviousFill: true };
    const s = calculateMileageSummary([A(), B(), c]);
    expect(s.intervals).toHaveLength(0);
    expect(s.count).toBe(0);
    expect(s.blockedBy).toBe('missed_fill');
  });

  it('on a partial fill inside the interval also discards it (the unknown gap is inside the span)', () => {
    const b = { ...B(), missedPreviousFill: true };
    const s = calculateMileageSummary([A(), b, C()]);
    expect(s.intervals).toHaveLength(0);
    expect(s.blockedBy).toBe('missed_fill');
  });

  it('the flagged fill still anchors the next interval', () => {
    const c = { ...C(), missedPreviousFill: true };
    const d = fill({ id: 'D', odoM: 5_518_000, ml: 10_000, fillType: 'full', date: '2026-09-10' });
    const intervals = calculateMileageIntervals([A(), B(), c, d]);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.fromEntryId).toBe('C');
    // 5,518,000 − 5,118,000 = 400,000 m
    expect(intervals[0]!.distanceMetres).toBe(400_000);
    expect(intervals[0]!.fuelMl).toBe(10_000);
  });
});

describe('MIL-06 all five blockers', () => {
  it('no_fills', () => {
    expect(calculateMileageSummary([]).blockedBy).toBe('no_fills');
  });
  it('one_fill', () => {
    expect(calculateMileageSummary([A()]).blockedBy).toBe('one_fill');
  });
  it('no_closing_full_tank', () => {
    expect(calculateMileageSummary([A(), B()]).blockedBy).toBe('no_closing_full_tank');
  });
  it('missed_fill', () => {
    const c = { ...C(), missedPreviousFill: true };
    expect(calculateMileageSummary([A(), c]).blockedBy).toBe('missed_fill');
  });
  it('dates_out_of_order', () => {
    const entries = [
      fill({ odoM: 5_000_000, ml: 10_000, fillType: 'full', date: '2026-09-10' }),
      fill({ odoM: 5_300_000, ml: 7_000, fillType: 'full', date: '2026-09-02' }),
    ];
    const s = calculateMileageSummary(entries);
    expect(s.intervals).toHaveLength(0);
    expect(s.blockedBy).toBe('dates_out_of_order');
  });
  it('a closing fill dated the SAME day as the opener is coherent, not out of order', () => {
    const entries = [
      fill({ odoM: 5_000_000, ml: 10_000, fillType: 'full', date: '2026-09-10' }),
      fill({ odoM: 5_300_000, ml: 7_000, fillType: 'full', date: '2026-09-10' }),
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(1);
    expect(s.blockedBy).toBeNull();
  });
});

describe('MIL-07 provisional estimate and its precedence against blockers', () => {
  const threePartials = () => [
    fill({ odoM: 5_000_000, ml: 10_000, fillType: 'partial', date: '2026-09-01' }),
    fill({ odoM: 5_300_000, ml: 7_000, fillType: 'partial', date: '2026-09-08' }),
    fill({ odoM: 5_600_000, ml: 8_000, fillType: 'partial', date: '2026-09-15' }),
  ];

  it('three partials spanning 5,000→5,600 km with 7+8 L after the opener', () => {
    const s = calculateMileageSummary(threePartials());
    expect(s.count).toBe(0);
    expect(s.provisional).not.toBeNull();
    // 5,600,000 − 5,000,000 = 600,000 m
    expect(s.provisional!.distanceMetres).toBe(600_000);
    // 7,000 + 8,000 = 15,000 ml (the opening 10,000 ml excluded)
    expect(s.provisional!.fuelMl).toBe(15_000);
    expect(s.provisional!.rawFuelMl).toBe(15_000);
    // 600,000 / 15,000 = 40
    expect(s.provisional!.efficiency.metresPerMl).toBe(40);
    expect(s.provisional!.confidence).toBe('estimated');
    expect(s.confidence).toBe('insufficient');
    expect(s.blockedBy).toBe('no_closing_full_tank');
    expect(s.average).toBeNull();
  });

  it('provisional is null the moment count > 0', () => {
    const s = calculateMileageSummary([A(), B(), C()]);
    expect(s.count).toBe(1);
    expect(s.provisional).toBeNull();
  });

  it('provisional is null with a single fill', () => {
    const s = calculateMileageSummary([fill({ odoM: 5_000_000, ml: 10_000, fillType: 'partial', date: '2026-09-01' })]);
    expect(s.provisional).toBeNull();
    expect(s.blockedBy).toBe('one_fill');
  });

  it('provisional is null when the whole span runs backwards in time', () => {
    const s = calculateMileageSummary([
      fill({ odoM: 5_000_000, ml: 10_000, fillType: 'partial', date: '2026-09-10' }),
      fill({ odoM: 5_300_000, ml: 7_000, fillType: 'partial', date: '2026-09-02' }),
    ]);
    expect(s.provisional).toBeNull();
    // Both partial → no full-to-full pair was ever attempted, so no 'dates_out_of_order'.
    expect(s.blockedBy).toBe('no_closing_full_tank');
  });

  it('PRECEDENCE (count = 0): a discarded pair and a provisional estimate coexist — blockedBy names the discard AND provisional is non-null', () => {
    const entries = [
      fill({ odoM: 5_000_000, ml: 10_000, fillType: 'partial', date: '2026-09-01' }),
      fill({ odoM: 5_300_000, ml: 7_000, fillType: 'full', date: '2026-09-08' }),
      fill({ odoM: 5_600_000, ml: 8_000, fillType: 'full', date: '2026-09-05' }), // dated before the fill it closes
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(0);
    expect(s.blockedBy).toBe('dates_out_of_order');
    // provisional spans first→last: 5,600,000 − 5,000,000 = 600,000 m on 7,000 + 8,000 = 15,000 ml
    expect(s.provisional).not.toBeNull();
    expect(s.provisional!.distanceMetres).toBe(600_000);
    expect(s.provisional!.fuelMl).toBe(15_000);
    // last.date '2026-09-05' >= first.date '2026-09-01' so the span is "coherent" even though
    // the pair inside it is not.
  });

  it('PRECEDENCE (count > 0): a real interval followed by an out-of-order pair reports NO blocker and NO provisional', () => {
    const entries = [
      fill({ id: 'p', odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ id: 'q', odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
      fill({ id: 'r', odoM: 1_800_000, ml: 8_000, fillType: 'full', date: '2026-01-05' }), // typo: dated before q
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(1);
    expect(s.latest!.toEntryId).toBe('q');
    expect(s.blockedBy).toBeNull();
    expect(s.provisional).toBeNull();
    // The discarded q→r interval is not surfaced anywhere in the summary.
    expect(s.intervals.map((i) => i.toEntryId)).toEqual(['q']);
  });

  it('PRECEDENCE (count > 0): a real interval followed by a missed-fill pair reports NO blocker', () => {
    const entries = [
      fill({ id: 'p', odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ id: 'q', odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
      fill({ id: 'r', odoM: 1_800_000, ml: 8_000, fillType: 'full', date: '2026-01-20', missedPreviousFill: true }),
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(1);
    expect(s.blockedBy).toBeNull();
  });
});

describe('MIL-08 confidence', () => {
  it('HIGH when both boundaries are full with nothing between', () => {
    const entries = [
      fill({ odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
    ];
    expect(calculateMileageIntervals(entries)[0]!.confidence).toBe('high');
  });

  it('MEDIUM when a partial sits inside', () => {
    expect(calculateMileageIntervals([A(), B(), C()])[0]!.confidence).toBe('medium');
  });

  it('ESTIMATED when an unknown sits inside, even alongside a partial', () => {
    const entries = [
      A(),
      B(),
      fill({ odoM: 5_000_000, ml: 2_000, fillType: 'unknown', date: '2026-08-27' }),
      C(),
    ];
    const only = calculateMileageIntervals(entries)[0]!;
    expect(only.confidence).toBe('estimated');
    expect(only.partialFills).toBe(1);
    expect(only.unknownFills).toBe(1);
    expect(only.fuelMl).toBe(9_000); // 3,000 + 2,000 + 4,000
  });

  it('overall stays medium below 5 intervals even when every interval is high', () => {
    // 5 full fills → 4 high intervals
    const entries = [
      fill({ odoM: 0, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
      fill({ odoM: 800_000, ml: 10_000, fillType: 'full', date: '2026-01-20' }),
      fill({ odoM: 1_200_000, ml: 10_000, fillType: 'full', date: '2026-01-30' }),
      fill({ odoM: 1_600_000, ml: 10_000, fillType: 'full', date: '2026-02-09' }),
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(4);
    expect(s.intervals.every((i) => i.confidence === 'high')).toBe(true);
    expect(s.confidence).toBe('medium');
  });

  it('overall becomes high at exactly 5 clean intervals', () => {
    const entries = [
      fill({ odoM: 0, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
      fill({ odoM: 800_000, ml: 10_000, fillType: 'full', date: '2026-01-20' }),
      fill({ odoM: 1_200_000, ml: 10_000, fillType: 'full', date: '2026-01-30' }),
      fill({ odoM: 1_600_000, ml: 10_000, fillType: 'full', date: '2026-02-09' }),
      fill({ odoM: 2_000_000, ml: 10_000, fillType: 'full', date: '2026-02-19' }),
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(5);
    expect(s.confidence).toBe('high');
  });

  it('overall is estimated if any interval is estimated, and medium if any is medium (at 5+)', () => {
    const base = [
      fill({ odoM: 0, ml: 10_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 400_000, ml: 10_000, fillType: 'full', date: '2026-01-10' }),
      fill({ odoM: 800_000, ml: 10_000, fillType: 'full', date: '2026-01-20' }),
      fill({ odoM: 1_200_000, ml: 10_000, fillType: 'full', date: '2026-01-30' }),
      fill({ odoM: 1_600_000, ml: 10_000, fillType: 'full', date: '2026-02-09' }),
      fill({ odoM: 2_000_000, ml: 10_000, fillType: 'full', date: '2026-02-19' }),
    ];
    const withPartial = [...base, fill({ odoM: 2_100_000, ml: 2_000, fillType: 'partial', date: '2026-02-20' }),
      fill({ odoM: 2_400_000, ml: 8_000, fillType: 'full', date: '2026-02-28' })];
    expect(calculateMileageSummary(withPartial).count).toBe(6);
    expect(calculateMileageSummary(withPartial).confidence).toBe('medium');
    const withUnknown = [...base, fill({ odoM: 2_100_000, ml: 2_000, fillType: 'unknown', date: '2026-02-20' }),
      fill({ odoM: 2_400_000, ml: 8_000, fillType: 'full', date: '2026-02-28' })];
    expect(calculateMileageSummary(withUnknown).confidence).toBe('estimated');
  });
});

describe('MIL-09 adjustments', () => {
  const reasons: FuelAdjustmentReason[] = ['other', 'leak', 'maintenance_loss', 'transferred', 'drained', 'theft'];

  for (const reason of reasons) {
    it(`${reason}: −500 ml dated inside the interval changes fuelMl by exactly −500 and touches nothing raw`, () => {
      const a = A();
      const b = B();
      const c = C();
      const loss = adj({ ml: -500, date: '2026-08-27', reason });
      const only = calculateMileageIntervals([a, b, c], [loss])[0]!;
      // 7,000 − 500 = 6,500 ml
      expect(only.fuelMl).toBe(6_500);
      expect(only.rawFuelMl).toBe(7_000);
      expect(only.adjustmentMl).toBe(-500);
      expect(only.hasAdjustments).toBe(true);
      // 273,000 / 6,500 = 42 exactly
      expect(only.efficiency.metresPerMl).toBe(42);
      expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('42.0');
      // Entries untouched
      expect(a.litresMl).toBe(9_000);
      expect(b.litresMl).toBe(3_000);
      expect(c.litresMl).toBe(4_000);
      expect(a.totalCostMinor).toBe(130_500); // 9 × 14,500
      expect(b.totalCostMinor).toBe(43_500); // 3 × 14,500
      expect(c.totalCostMinor).toBe(58_000); // 4 × 14,500
    });
  }

  it('added_unlogged: +500 ml dated inside the interval changes fuelMl by exactly +500', () => {
    const jerry = adj({ ml: 500, date: '2026-08-27', reason: 'added_unlogged' });
    const only = calculateMileageIntervals([A(), B(), C()], [jerry])[0]!;
    // 7,000 + 500 = 7,500 ml
    expect(only.fuelMl).toBe(7_500);
    expect(only.rawFuelMl).toBe(7_000);
    expect(only.adjustmentMl).toBe(500);
    // 273,000 / 7,500 = 36.4
    expect(only.efficiency.metresPerMl).toBe(36.4);
    expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('36.4');
  });

  it('several adjustments inside one interval are summed, signed', () => {
    const adjustments = [
      adj({ ml: -300, date: '2026-08-22', reason: 'leak' }),
      adj({ ml: -200, date: '2026-08-28', reason: 'other' }),
      adj({ ml: 1_000, date: '2026-08-26', reason: 'added_unlogged' }),
    ];
    const only = calculateMileageIntervals([A(), B(), C()], adjustments)[0]!;
    // −300 − 200 + 1,000 = +500; 7,000 + 500 = 7,500
    expect(only.adjustmentMl).toBe(500);
    expect(only.fuelMl).toBe(7_500);
  });

  it('boundary: an adjustment dated ON the opening fill date belongs to the PREVIOUS interval', () => {
    const z = fill({ id: 'Z', odoM: 4_500_000, ml: 8_000, fillType: 'full', date: '2026-08-10' });
    const onA = adj({ ml: -500, date: '2026-08-20', reason: 'leak' }); // A's date
    const intervals = calculateMileageIntervals([z, A(), B(), C()], [onA]);
    expect(intervals).toHaveLength(2);
    // Z→A: 4,845,000 − 4,500,000 = 345,000 m on A's 9,000 ml − 500 = 8,500 ml
    expect(intervals[0]!.fromEntryId).toBe('Z');
    expect(intervals[0]!.toEntryId).toBe('A');
    expect(intervals[0]!.rawFuelMl).toBe(9_000);
    expect(intervals[0]!.adjustmentMl).toBe(-500);
    expect(intervals[0]!.fuelMl).toBe(8_500);
    // A→C untouched: 7,000
    expect(intervals[1]!.adjustmentMl).toBe(0);
    expect(intervals[1]!.fuelMl).toBe(7_000);
  });

  it('boundary: an adjustment dated ON the closing fill date belongs to THIS interval', () => {
    const onC = adj({ ml: -500, date: '2026-08-30', reason: 'leak' }); // C's date
    const only = calculateMileageIntervals([A(), B(), C()], [onC])[0]!;
    expect(only.adjustmentMl).toBe(-500);
    expect(only.fuelMl).toBe(6_500);
  });

  it('boundary: an adjustment dated on the very first full fill with no earlier interval is silently dropped', () => {
    const onA = adj({ ml: -500, date: '2026-08-20', reason: 'leak' });
    const only = calculateMileageIntervals([A(), B(), C()], [onA])[0]!;
    expect(only.adjustmentMl).toBe(0);
    expect(only.fuelMl).toBe(7_000);
  });

  it('boundary edge: same-day opener and closer — an adjustment dated that day attaches to NEITHER interval', () => {
    // Form dates an adjustment with its fill; both fills share the date.
    const p = fill({ id: 'p', odoM: 1_000_000, ml: 10_000, fillType: 'full', date: '2026-03-05' });
    const q = fill({ id: 'q', odoM: 1_400_000, ml: 10_000, fillType: 'full', date: '2026-03-05' });
    const spill = adj({ ml: -1_000, date: '2026-03-05', reason: 'other' });
    const only = calculateMileageIntervals([p, q], [spill])[0]!;
    // after='2026-03-05' (exclusive) through='2026-03-05' (inclusive) → the range is empty
    expect(adjustmentMlInRange([spill], '2026-03-05', '2026-03-05')).toBe(0);
    expect(only.adjustmentMl).toBe(0);
    expect(only.fuelMl).toBe(10_000);
  });

  it('deleting the adjustment restores the original figure', () => {
    const loss = adj({ ml: -500, date: '2026-08-27', reason: 'leak' });
    const withLoss = calculateMileageIntervals([A(), B(), C()], [loss])[0]!;
    expect(withLoss.fuelMl).toBe(6_500);
    const without = calculateMileageIntervals([A(), B(), C()], [])[0]!;
    expect(without.fuelMl).toBe(7_000);
    expect(without.adjustmentMl).toBe(0);
    expect(without.hasAdjustments).toBe(false);
    expect(without.efficiency.metresPerMl).toBe(39);
  });

  it('adjustmentMlInRange is half-open on the left and closed on the right', () => {
    const list = [
      adj({ ml: -100, date: '2026-08-20', reason: 'leak' }), // on `after` → excluded
      adj({ ml: -200, date: '2026-08-21', reason: 'leak' }), // inside
      adj({ ml: -400, date: '2026-08-30', reason: 'leak' }), // on `through` → included
      adj({ ml: -800, date: '2026-08-31', reason: 'leak' }), // after → excluded
    ];
    // −200 − 400 = −600
    expect(adjustmentMlInRange(list, '2026-08-20', '2026-08-30')).toBe(-600);
  });
});

describe('MIL-10 distance-weighted average', () => {
  it('two unequal intervals: 100 km/2 L and 300 km/10 L → 400/12 = 33.33, not 40', () => {
    const entries = [
      fill({ odoM: 0, ml: 5_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 100_000, ml: 2_000, fillType: 'full', date: '2026-01-05' }), // 100,000 / 2,000 = 50
      fill({ odoM: 400_000, ml: 10_000, fillType: 'full', date: '2026-01-15' }), // 300,000 / 10,000 = 30
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(2);
    expect(s.intervals[0]!.efficiency.metresPerMl).toBe(50);
    expect(s.intervals[1]!.efficiency.metresPerMl).toBe(30);
    // (100,000 + 300,000) / (2,000 + 10,000) = 400,000 / 12,000 = 33.333…
    expect(s.average!.metresPerMl).toBeCloseTo(33.333333, 5);
    expect(formatMileageValue(s.average, 'km_per_l')).toBe('33.3');
    // and explicitly NOT the mean of the ratios (50 + 30) / 2 = 40
    expect(s.average!.metresPerMl).not.toBe(40);
  });

  it('lastFive is the weighted average of the five most recent intervals only', () => {
    // six intervals; the first (0→100 km on 1 L = 100 km/L) must be excluded from lastFive
    const entries = [
      fill({ odoM: 0, ml: 5_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 100_000, ml: 1_000, fillType: 'full', date: '2026-01-02' }), // 100 km / 1 L
      fill({ odoM: 500_000, ml: 10_000, fillType: 'full', date: '2026-01-03' }), // 400 km / 10 L
      fill({ odoM: 900_000, ml: 10_000, fillType: 'full', date: '2026-01-04' }), // 400 / 10
      fill({ odoM: 1_300_000, ml: 10_000, fillType: 'full', date: '2026-01-05' }), // 400 / 10
      fill({ odoM: 1_700_000, ml: 10_000, fillType: 'full', date: '2026-01-06' }), // 400 / 10
      fill({ odoM: 2_100_000, ml: 10_000, fillType: 'full', date: '2026-01-07' }), // 400 / 10
    ];
    const s = calculateMileageSummary(entries);
    expect(s.count).toBe(6);
    // all six: (100,000 + 5 × 400,000) / (1,000 + 5 × 10,000) = 2,100,000 / 51,000 = 41.176…
    expect(s.average!.metresPerMl).toBeCloseTo(41.176470, 5);
    // last five: 2,000,000 / 50,000 = 40
    expect(s.lastFive!.metresPerMl).toBe(40);
    // best is the 100 km/L interval, worst is one of the 40s
    expect(s.best!.efficiency.metresPerMl).toBe(100);
    expect(s.worst!.efficiency.metresPerMl).toBe(40);
  });
});

describe('MIL-11 display precision', () => {
  it('39 exact → "39.0"', () => {
    expect(formatMileageValue({ metresPerMl: 39 }, 'km_per_l')).toBe('39.0');
  });
  it('273_000 / 7_000 computed by the engine → "39.0"', () => {
    const only = calculateMileageIntervals([A(), B(), C()])[0]!;
    expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('39.0');
  });
  it('100 km / 3 L (non-terminating 33.333…) → "33.3"', () => {
    const entries = [
      fill({ odoM: 0, ml: 5_000, fillType: 'full', date: '2026-01-01' }),
      fill({ odoM: 100_000, ml: 3_000, fillType: 'full', date: '2026-01-05' }),
    ];
    const only = calculateMileageIntervals(entries)[0]!;
    expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('33.3');
  });
  it('335 km / 8 L = 41.875 → "41.9" (rounds half up at one decimal)', () => {
    const entries = [
      fill({ odoM: 4_845_000, ml: 11_000, fillType: 'full', date: '2026-08-20' }),
      fill({ odoM: 5_180_000, ml: 8_000, fillType: 'full', date: '2026-08-30' }),
    ];
    const only = calculateMileageIntervals(entries)[0]!;
    expect(only.efficiency.metresPerMl).toBe(41.875);
    expect(formatMileageValue(only.efficiency, 'km_per_l')).toBe('41.9');
  });
  it('200 km / 3 L = 66.666… → "66.7"; 100 km / 6 L = 16.666… → "16.7"', () => {
    expect(formatMileageValue({ metresPerMl: 200_000 / 3_000 }, 'km_per_l')).toBe('66.7');
    expect(formatMileageValue({ metresPerMl: 100_000 / 6_000 }, 'km_per_l')).toBe('16.7');
  });
  it('never more than one decimal even for 1/7', () => {
    // 100,000 / 7,000 = 14.2857… → "14.3"
    expect(formatMileageValue({ metresPerMl: 100_000 / 7_000 }, 'km_per_l')).toBe('14.3');
  });
  it('L/100km of 39 km/L → 100/39 = 2.5641… → "2.6"', () => {
    expect(formatMileageValue({ metresPerMl: 39 }, 'l_per_100km')).toBe('2.6');
  });
});

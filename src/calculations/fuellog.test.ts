import type { FuelAdjustment, FuelEntry, IsoDate } from '@/types';
import type { MileageInterval } from './mileage';
import {
  adjustmentReasonLabel,
  adjustmentReasonPhrase,
  buildFuelLog,
  filterFuelLog,
  filterFuelLogByRange,
  fuelRangeStart,
  fuelRangeSummary,
} from './fuellog';

const fill = (
  id: string,
  date: IsoDate,
  fillType: FuelEntry['fillType'] = 'full',
  createdAt = 1,
): FuelEntry => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt,
  updatedAt: createdAt,
  date,
  odometerMetres: 34_712_000,
  litresMl: 8_200,
  pricePerLitreMinor: 12_250,
  totalCostMinor: 100_450,
  currency: 'BDT',
  fillType,
  missedPreviousFill: false,
  station: null,
  notes: null,
  receiptPath: null,
  clientRef: id,
});

const adjustment = (id: string, date: IsoDate, note: string | null = null): FuelAdjustment => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  date,
  millilitres: -300,
  reason: 'other',
  approximate: false,
  note,
  clientRef: id,
});

const interval = (toEntryId: string): MileageInterval =>
  ({ toEntryId, distanceMetres: 338_000 }) as unknown as MileageInterval;

describe('buildFuelLog', () => {
  it('interleaves adjustments with fills, newest first', () => {
    const log = buildFuelLog(
      [fill('f1', '2026-09-13'), fill('f2', '2026-09-01')],
      [adjustment('a1', '2026-09-02')],
    );

    expect(log.map((item) => item.id)).toEqual(['fill:f1', 'adjustment:a1', 'fill:f2']);
  });

  it('puts the fill above an adjustment logged the same day', () => {
    const log = buildFuelLog([fill('f1', '2026-09-06')], [adjustment('a1', '2026-09-06')]);
    expect(log.map((item) => item.kind)).toEqual(['fill', 'adjustment']);
  });

  it('orders two fills on one day by when they were logged', () => {
    const log = buildFuelLog(
      [fill('early', '2026-09-06', 'full', 10), fill('late', '2026-09-06', 'full', 20)],
      [],
    );
    expect(log.map((item) => item.id)).toEqual(['fill:late', 'fill:early']);
  });

  it('attaches the interval a fill closed, and only to that fill', () => {
    const log = buildFuelLog([fill('f1', '2026-09-13'), fill('f2', '2026-09-01')], [], [interval('f1')]);

    const [first, second] = log;
    expect(first?.kind === 'fill' && first.interval?.toEntryId).toBe('f1');
    expect(second?.kind === 'fill' && second.interval).toBeNull();
  });
});

describe('filterFuelLog', () => {
  const log = buildFuelLog(
    [fill('full', '2026-09-13'), fill('part', '2026-09-06', 'partial'), fill('unk', '2026-09-04', 'unknown')],
    [adjustment('a1', '2026-09-02')],
  );

  it('keeps everything on "all"', () => {
    expect(filterFuelLog(log, 'all')).toHaveLength(4);
  });

  it('"full" is full tanks only', () => {
    expect(filterFuelLog(log, 'full').map((i) => i.id)).toEqual(['fill:full']);
  });

  it('"partial" keeps unknown fills too, so none falls through every filter', () => {
    expect(filterFuelLog(log, 'partial').map((i) => i.id)).toEqual(['fill:part', 'fill:unk']);
  });

  it('"adjusted" is the adjustment records themselves', () => {
    expect(filterFuelLog(log, 'adjusted').map((i) => i.id)).toEqual(['adjustment:a1']);
  });

  it('never mutates the list it was given', () => {
    const before = log.map((i) => i.id);
    filterFuelLog(log, 'all').reverse();
    expect(log.map((i) => i.id)).toEqual(before);
  });
});

describe('adjustment labels', () => {
  it('prefers the rider’s own note', () => {
    expect(adjustmentReasonLabel(adjustment('a1', '2026-09-02', 'Spillage'))).toBe('Spillage');
    expect(adjustmentReasonPhrase(adjustment('a1', '2026-09-02', 'Spillage'))).toBe('spillage');
  });

  it('falls back to the reason when the note is blank', () => {
    expect(adjustmentReasonLabel(adjustment('a1', '2026-09-02', '   '))).toBe('Other');
  });
});

const closedInterval = (date: IsoDate, distanceMetres: number, fuelMl: number): MileageInterval =>
  ({ date, distanceMetres, fuelMl, toEntryId: `to:${date}` }) as unknown as MileageInterval;

describe('fuel ranges', () => {
  const TODAY = '2026-09-16';

  it('starts three and twelve months back, and never for all time', () => {
    expect(fuelRangeStart('3m', TODAY)).toBe('2026-06-16');
    expect(fuelRangeStart('year', TODAY)).toBe('2025-09-16');
    expect(fuelRangeStart('all', TODAY)).toBeNull();
  });

  it('keeps only the log inside the range', () => {
    const log = buildFuelLog([fill('a', '2026-09-01'), fill('b', '2026-01-10')], []);
    expect(filterFuelLogByRange(log, '3m', TODAY).map((i) => i.id)).toEqual(['fill:a']);
    expect(filterFuelLogByRange(log, 'all', TODAY)).toHaveLength(2);
  });

  it('totals the fills in range and averages mileage by distance over fuel', () => {
    const summary = fuelRangeSummary(
      [fill('a', '2026-09-01'), fill('b', '2026-08-01'), fill('c', '2025-01-01')],
      [closedInterval('2026-09-01', 300_000, 8_000), closedInterval('2026-08-01', 100_000, 4_000), closedInterval('2025-01-01', 1, 1)],
      '3m',
      TODAY,
    );
    expect(summary.totals.fills).toBe(2);
    expect(summary.totals.spendMinor).toBe(200_900);
    expect(summary.intervals).toHaveLength(2);
    // 400 km over 12 L, not the mean of 37.5 and 25.
    expect(summary.average?.metresPerMl).toBeCloseTo(400_000 / 12_000, 6);
  });

  it('has no average when no interval closed in range', () => {
    expect(fuelRangeSummary([fill('a', '2026-09-01')], [], 'year', TODAY).average).toBeNull();
  });
});

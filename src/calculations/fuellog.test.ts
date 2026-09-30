import type { FuelAdjustment, FuelEntry, IsoDate } from '@/types';
import type { MileageInterval } from './mileage';
import {
  adjustmentReasonLabel,
  adjustmentReasonPhrase,
  buildFuelLog,
  filterFuelLog,
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

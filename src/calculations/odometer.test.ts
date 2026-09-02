import type { FuelEntry, OdometerReading, Part, ServiceRecord } from '@/types';
import {
  buildOdometerHistory,
  currentOdometerMetres,
  MAX_PLAUSIBLE_JUMP_METRES,
  totalDistanceMetres,
  validateOdometer,
} from './odometer';

const reading = (over: Partial<OdometerReading> = {}): OdometerReading => ({
  id: 'o1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  metres: 3_900_000,
  date: '2026-07-12',
  source: 'manual',
  sourceId: null,
  note: null,
  ...over,
});

const fuel = (id: string, km: number, date: string): FuelEntry => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  date,
  odometerMetres: km * 1000,
  litresMl: 9000,
  pricePerLitreMinor: 14500,
  totalCostMinor: 130_500,
  currency: 'BDT',
  fillType: 'full',
  missedPreviousFill: false,
  station: null,
  notes: null,
  receiptPath: null,
  clientRef: `r-${id}`,
});

const service = (id: string, km: number, date: string): ServiceRecord => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Oil change',
  workshop: null,
  selfService: true,
  date,
  odometerMetres: km * 1000,
  labourCostMinor: 0,
  partsCostMinor: 0,
  totalCostMinor: 0,
  currency: 'BDT',
  notes: null,
  completedRuleIds: [],
  itemsSummary: null,
  receiptPaths: [],
  estimate: null,
  clientRef: `r-${id}`,
});

const part = (id: string, km: number, date: string, linkedServiceId: string | null): Part => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Chain kit',
  installedOdometerMetres: km * 1000,
  installedDate: date,
  expectedLifeMetres: null,
  costMinor: 0,
  currency: 'BDT',
  fittedBy: null,
  linkedServiceId,
  removedDate: null,
  removedOdometerMetres: null,
  notes: null,
  clientRef: `r-${id}`,
});

describe('odometer history', () => {
  it('merges manual readings with those implied by fuel, services and parts', () => {
    const points = buildOdometerHistory({
      readings: [reading()],
      fuelEntries: [fuel('f1', 4845, '2026-08-20'), fuel('f2', 5180, '2026-08-30')],
      services: [service('s1', 5050, '2026-08-24')],
      parts: [part('p1', 5100, '2026-08-25', null)],
    });
    expect(points).toHaveLength(5);
    expect(points[0]!.metres).toBe(5_180_000); // newest first
    expect(points[points.length - 1]!.metres).toBe(3_900_000);
  });

  it('does not double-count a part fitted during a service', () => {
    const points = buildOdometerHistory({
      readings: [],
      fuelEntries: [],
      services: [service('s1', 5050, '2026-08-24')],
      parts: [part('p1', 5050, '2026-08-24', 's1')],
    });
    expect(points).toHaveLength(1);
  });

  it('reads the current odometer as the highest reading, not the newest', () => {
    const points = buildOdometerHistory({
      readings: [reading({ id: 'o2', metres: 4_000_000, date: '2026-09-01' })],
      fuelEntries: [fuel('f2', 5180, '2026-08-30')],
      services: [],
      parts: [],
    });
    expect(currentOdometerMetres(points)).toBe(5_180_000);
  });

  it('has no current reading for a brand new bike', () => {
    expect(currentOdometerMetres([])).toBeNull();
    expect(totalDistanceMetres([])).toBe(0);
  });

  it('measures total distance as the span of readings', () => {
    const points = buildOdometerHistory({
      readings: [reading()],
      fuelEntries: [fuel('f2', 5180, '2026-08-30')],
      services: [],
      parts: [],
    });
    expect(totalDistanceMetres(points)).toBe(1_280_000);
  });
});

describe('validation', () => {
  it('accepts any reading for a bike with no history', () => {
    expect(validateOdometer(5_180_000, null)).toEqual({ ok: true });
  });

  it('accepts a forward reading', () => {
    expect(validateOdometer(5_180_000, 5_050_000)).toEqual({ ok: true });
  });

  it('accepts an unchanged reading', () => {
    expect(validateOdometer(5_050_000, 5_050_000)).toEqual({ ok: true });
  });

  it('flags a backwards reading rather than silently accepting it', () => {
    expect(validateOdometer(4_000_000, 5_050_000)).toEqual({
      ok: false,
      reason: 'below_current',
      currentMetres: 5_050_000,
    });
  });

  it('flags an implausible jump', () => {
    const next = 5_050_000 + MAX_PLAUSIBLE_JUMP_METRES + 1;
    expect(validateOdometer(next, 5_050_000)).toEqual({
      ok: false,
      reason: 'implausible_jump',
      currentMetres: 5_050_000,
    });
  });
});

import type { FuelEntry, OdometerReading, Part, ServiceRecord } from '@/types';
import {
  buildOdometerHistory,
  currentOdometerMetres,
  MAX_PLAUSIBLE_JUMP_METRES,
  previewOdometerCorrection,
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


describe('correcting a mistyped reading', () => {
  // The rider meant 5,588 km and typed 6,000. Everything below is that mistake.
  const mistake = reading({ id: 'typo', metres: 6_000_000, date: '2026-09-01' });
  const bike = { initialOdometerMetres: 3_900_000, storedOdometerMetres: 6_000_000, createdAt: 1 };
  const history = (readings: OdometerReading[], fuelEntries = [] as FuelEntry[]) =>
    buildOdometerHistory({ readings, fuelEntries, services: [], parts: [], bike });

  it('lowers the odometer to the corrected figure', () => {
    const points = history([mistake]);
    expect(currentOdometerMetres(points)).toBe(6_000_000);

    const corrected = previewOdometerCorrection(points, 'typo', 5_588_000);
    expect(corrected.resultingMetres).toBe(5_588_000);
    expect(corrected.heldBy).toBeNull();
  });

  it('does not list the stored figure twice once a reading already reports it', () => {
    // storedOdometerMetres is 6,000,000 because the mistake was synced to it.
    // Showing it again would put an uneditable twin next to the reading itself.
    expect(history([mistake]).filter((p) => p.metres === 6_000_000)).toHaveLength(1);
  });

  it("ignores the bike's stored figure, which is an echo of the mistake", () => {
    // The web product left the odometer at 6,200 km with no reading behind it.
    // Counting that echo would pin the odometer there whatever the rider fixes.
    const drifted = buildOdometerHistory({
      readings: [mistake], fuelEntries: [], services: [], parts: [],
      bike: { ...bike, storedOdometerMetres: 6_200_000 },
    });
    expect(drifted.some((p) => p.id === 'bike:current' && p.metres === 6_200_000)).toBe(true);
    expect(previewOdometerCorrection(drifted, 'typo', 5_588_000).resultingMetres).toBe(5_588_000);
  });

  it('falls back to the next highest record when the reading is deleted', () => {
    const points = history([mistake, reading({ id: 'ok', metres: 5_400_000, date: '2026-08-20' })]);
    const removed = previewOdometerCorrection(points, 'typo', null);
    expect(removed.resultingMetres).toBe(5_400_000);
    expect(removed.heldBy?.readingId).toBe('ok');
  });

  it('cannot go below a fuel log, and says which record holds it up', () => {
    const points = history([mistake], [fuel('f1', 5800, '2026-08-28')]);
    const corrected = previewOdometerCorrection(points, 'typo', 5_588_000);
    expect(corrected.resultingMetres).toBe(5_800_000);
    expect(corrected.heldBy?.source).toBe('fuel');
    expect(corrected.heldBy?.sourceId).toBe('f1');
  });

  it('cannot go below the opening reading', () => {
    const points = history([mistake]);
    const corrected = previewOdometerCorrection(points, 'typo', 1_000_000);
    expect(corrected.resultingMetres).toBe(3_900_000);
    expect(corrected.heldBy?.id).toBe('bike:initial');
  });

  it('leaves nothing behind when the only reading is removed', () => {
    const points = buildOdometerHistory({
      readings: [mistake], fuelEntries: [], services: [], parts: [],
    });
    expect(previewOdometerCorrection(points, 'typo', null).resultingMetres).toBeNull();
  });

  it('corrects only the reading named, never a derived point', () => {
    const points = history([mistake], [fuel('f1', 5400, '2026-08-28')]);
    // A fuel log's point carries no readingId, so it can never be edited here.
    expect(points.filter((p) => p.readingId !== null)).toHaveLength(1);
    expect(previewOdometerCorrection(points, 'f1', 100).resultingMetres).toBe(6_000_000);
  });
});

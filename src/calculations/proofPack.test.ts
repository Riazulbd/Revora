import type { Bike, FuelEntry, ServiceRecord, VaultDocument } from '@/types';
import { analyseBike, type GarageData } from './analytics';
import {
  monthsBetween,
  proofPackRecords,
  proofPackSummary,
  PROOF_PACK_FUEL_ROW_LIMIT,
  PROOF_PACK_THIN_MONTHS,
} from './proofPack';

const units = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l', costBasis: 'running' } as const;

const bike: Bike = {
  id: 'b1',
  userId: 'u1',
  createdAt: 1,
  updatedAt: 1,
  manufacturer: 'Honda',
  model: 'Hornet 2.0',
  nickname: 'The Red One',
  year: 2025,
  tankCapacityMl: 12_000,
  purchasePriceMinor: 28_500_000,
  purchaseDate: '2022-02-10',
  engineNumber: null,
  chassisNumber: null,
  photoPath: null,
  currency: 'BDT',
  initialOdometerMetres: 0,
  storedOdometerMetres: 0,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 },
  archivedAt: null,
};

const fuel = (id: string, km: number, date: string): FuelEntry => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  date,
  odometerMetres: km * 1000,
  litresMl: 9_000,
  pricePerLitreMinor: 14_500,
  totalCostMinor: 130_500,
  currency: 'BDT',
  fillType: 'full',
  missedPreviousFill: false,
  station: null,
  notes: null,
  receiptPath: null,
  clientRef: `r-${id}`,
});

const service = (id: string, date: string): ServiceRecord => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Oil change',
  workshop: 'Rahim Motors',
  selfService: false,
  date,
  odometerMetres: 4_800_000,
  labourCostMinor: 30_000,
  partsCostMinor: 90_000,
  totalCostMinor: 120_000,
  currency: 'BDT',
  notes: null,
  completedRuleIds: [],
  itemsSummary: null,
  receiptPaths: [],
  estimate: null,
  clientRef: `r-${id}`,
});

const document = (id: string, expiresOn: string | null): VaultDocument => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  kind: 'tax_token',
  customKindLabel: null,
  title: 'Tax token',
  reference: 'DHA-TT-4471982',
  issuedOn: null,
  expiresOn,
  filePath: null,
  keepOfflineCopy: true,
  notes: null,
  clientRef: `r-${id}`,
});

const garage = (over: Partial<GarageData> = {}): GarageData => ({
  bike,
  fuelEntries: [],
  fuelAdjustments: [],
  odometerReadings: [],
  rules: [],
  services: [],
  parts: [],
  accessories: [],
  expenses: [],
  units,
  today: '2026-09-16',
  ...over,
});

describe('a pack with nothing in it', () => {
  const summary = proofPackSummary({ analytics: analyseBike(garage()), documents: [] });

  it('says so rather than offering a document that proves nothing', () => {
    expect(summary.isEmpty).toBe(true);
    expect(summary.certificate.recordCount).toBe(0);
  });

  it('leaves the coverage unknown rather than reporting zero months', () => {
    expect(summary.coverage).toBeNull();
    expect(summary.monthsCovered).toBeNull();
    expect(summary.isThin).toBe(false);
  });

  it('still lists the one thing every pack contains', () => {
    expect(summary.included).toEqual(['Motorcycle details']);
  });
});

describe('the INCLUDED list', () => {
  const analytics = analyseBike(
    garage({
      services: [service('s1', '2022-02-20'), service('s2', '2026-09-01')],
      fuelEntries: [fuel('f1', 4845, '2026-08-20'), fuel('f2', 5180, '2026-08-30')],
    }),
  );
  const summary = proofPackSummary({ analytics, documents: [document('d1', '2026-09-28')] });

  it('counts each kind of record and names it the way the board does', () => {
    expect(summary.included).toEqual([
      'Motorcycle details',
      '2 services',
      '2 fuel logs with mileage',
      '1 document',
    ]);
  });

  it('leaves out a kind the rider has none of', () => {
    expect(summary.included.some((line) => line.includes('part'))).toBe(false);
  });

  it('says "1 service", not "1 services"', () => {
    const one = proofPackSummary({
      analytics: analyseBike(garage({ services: [service('s1', '2026-09-01')] })),
      documents: [],
    });
    expect(one.included).toContain('1 service');
  });
});

describe('what the certificate covers', () => {
  const analytics = analyseBike(
    garage({
      services: [service('s1', '2022-02-20')],
      fuelEntries: [fuel('f1', 4845, '2026-08-20'), fuel('f2', 5180, '2026-08-30')],
    }),
  );
  const summary = proofPackSummary({ analytics, documents: [] });

  it('reads as the months the records span', () => {
    expect(summary.coverage).toBe('Feb 2022 – Aug 2026');
  });

  it('counts every record the PDF prints, and only those', () => {
    // One service and two fills — the three rows the PDF prints.
    expect(summary.certificate.recordCount).toBe(3);
  });

  it('is not thin over four years', () => {
    expect(summary.isThin).toBe(false);
  });
});

describe('a thin log', () => {
  const analytics = analyseBike(
    garage({
      fuelEntries: [fuel('f1', 4845, '2026-06-20'), fuel('f2', 5180, '2026-09-10')],
    }),
  );
  const summary = proofPackSummary({ analytics, documents: [] });

  it('is flagged so the pack can say so on its face', () => {
    expect(summary.monthsCovered).toBe(3);
    expect(summary.monthsCovered).toBeLessThan(PROOF_PACK_THIN_MONTHS);
    expect(summary.isThin).toBe(true);
  });
});

describe('the records attested to', () => {
  it('stops at the row limit the PDF prints, so the stamp never claims more than the page shows', () => {
    const entries = Array.from({ length: PROOF_PACK_FUEL_ROW_LIMIT + 5 }, (_, i) =>
      fuel(`f${i}`, 4000 + i * 10, '2026-08-20'),
    );
    const analytics = analyseBike(garage({ fuelEntries: entries }));
    const records = proofPackRecords({ analytics, documents: [] });
    expect(records.filter((r) => r.kind === 'fuel')).toHaveLength(PROOF_PACK_FUEL_ROW_LIMIT);
    expect(proofPackSummary({ analytics, documents: [] }).fuelLogs).toBe(PROOF_PACK_FUEL_ROW_LIMIT);
  });

  it('includes a document with no expiry, which carries no date of its own', () => {
    const analytics = analyseBike(garage());
    const records = proofPackRecords({ analytics, documents: [document('d1', null)] });
    expect(records).toEqual([{ kind: 'document', id: 'd1', date: null, figure: null }]);
  });
});

test('whole months are counted the way a rider would say them', () => {
  expect(monthsBetween('2026-06-20', '2026-09-10')).toBe(3);
  expect(monthsBetween('2026-09-01', '2026-09-30')).toBe(0);
  expect(monthsBetween('2022-02-01', '2026-09-01')).toBe(55);
});

describe('the Figma INCLUDED card', () => {
  it('names each section with its count, and counts the photos the pack carries', () => {
    const analytics = analyseBike(
      garage({ services: [service('s1', '2026-09-01')], fuelEntries: [fuel('f1', 4845, '2026-08-20')] }),
    );
    const summary = proofPackSummary({ analytics, documents: [document('d1', null)] });
    expect(summary.includedLines).toEqual([
      'Motorcycle details · chassis and engine no.',
      'Service history · 1 visit',
      'Odometer timeline · 1 fill-up',
      'Documents · 1 document',
    ]);
    expect(summary.photos).toBe(0);
  });
});

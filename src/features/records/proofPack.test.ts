import { analyseBike, type GarageData } from '@/calculations/analytics';
import { buildProofPackHtml } from './proofPack';
import type { Bike, FuelEntry, ServiceRecord } from '@/types';

const units = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l', costBasis: 'running' } as const;

const bike: Bike = {
  id: 'b1', userId: 'u1', createdAt: 1, updatedAt: 1,
  manufacturer: 'Yamaha', model: 'FZS-Fi V3', nickname: 'Yamaha FZS',
  year: 2024, tankCapacityMl: 13_000, purchasePriceMinor: 28_500_000,
  purchaseDate: '2024-11-02', engineNumber: null, chassisNumber: null, photoPath: null,
  currency: 'BDT', initialOdometerMetres: 3_900_000, storedOdometerMetres: 6_000_000,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 }, archivedAt: null,
};

const fuel = (id: string, km: number, litres: number, date: string): FuelEntry => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1, date,
  odometerMetres: km * 1000, litresMl: litres * 1000, pricePerLitreMinor: 14_500,
  totalCostMinor: Math.round(litres * 14_500), currency: 'BDT', fillType: 'full',
  missedPreviousFill: false, station: null, notes: null, receiptPath: null, clientRef: 'r' + id,
});

const service = (id: string, date: string, title: string, workshop: string, km: number, minor: number): ServiceRecord => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1, date, title,
  workshop, selfService: false, odometerMetres: km * 1000, totalCostMinor: minor,
  labourCostMinor: 0, partsCostMinor: minor, itemsSummary: null, estimate: null,
  currency: 'BDT', notes: null, receiptPaths: [], completedRuleIds: [], clientRef: 'r' + id,
});

const base: GarageData = {
  bike,
  fuelEntries: [fuel('f1', 4845, 11, '2026-08-20'), fuel('f2', 5180, 9, '2026-08-30'), fuel('f3', 5588, 10.4, '2026-09-06')],
  fuelAdjustments: [], odometerReadings: [], rules: [],
  services: [
    service('s1', '2026-03-04', 'Engine oil & filter', 'Rahim Moto Care', 4200, 180_000),
    service('s2', '2026-07-19', 'Chain clean, brake pads', 'Speed Zone Workshop', 4900, 265_000),
  ],
  parts: [], accessories: [], expenses: [], units, today: '2026-09-13',
};

const html = (over: Partial<GarageData> = {}, buyerSafe = false) => {
  const data = { ...base, ...over };
  return buildProofPackHtml({
    bike: data.bike,
    analytics: analyseBike(data),
    documents: [],
    options: { buyerSafe, consentGiven: true },
  });
};

const reference = (markup: string) => /([0-9A-F]{4}-[0-9A-F]{4})/.exec(markup)?.[1] ?? null;

describe('the masthead', () => {
  it('carries the Revora mark inside the document', () => {
    // expo-print resolves no assets, so a relative src would print an empty box.
    expect(html()).toContain('src="data:image/png;base64,');
  });

  it('states what the stamp covers', () => {
    const markup = html();
    expect(markup).toContain('Certified by Revora');
    expect(markup).toContain('5 records');
    expect(markup).toContain('4 Mar 2026');
    expect(markup).toContain('6 Sep 2026');
  });
});

describe('the certificate reference', () => {
  it('appears on the page and is repeated in the scope note', () => {
    const markup = html();
    const ref = reference(markup);
    expect(ref).not.toBeNull();
    expect(markup.split(ref as string).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('changes when a printed record changes', () => {
    const edited = base.services.map((s) =>
      s.id === 's1' ? { ...s, totalCostMinor: 999_000 } : s,
    );
    expect(reference(html({ services: edited }))).not.toBe(reference(html()));
  });

  it('does not change when only a hidden price is hidden', () => {
    // Buyer-safe mode withholds figures from the reader, but it is the same
    // logbook underneath — a buyer comparing two copies must not be told the
    // records differ when they do not.
    expect(reference(html({}, true))).toBe(reference(html()));
  });
});

describe('the stamp does not overclaim', () => {
  it('says plainly that Revora never saw the motorcycle', () => {
    const markup = html();
    expect(markup).toContain('Revora has never seen this motorcycle');
    expect(markup).toContain('not an independent inspection');
  });
});

describe('buyer-safe mode', () => {
  it('omits every price rather than styling it away', () => {
    const markup = html({}, true);
    expect(markup).not.toContain('BDT 1,595');
    expect(markup).toContain('Hidden (buyer-safe)');
  });
});

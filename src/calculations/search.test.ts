import type { Accessory, FuelEntry, Part, ServiceItem, ServiceRecord, VaultDocument } from '@/types';
import { countResults, normalise, searchRecords } from './search';

const service = (id: string, title: string, workshop: string | null, notes: string | null = null): ServiceRecord => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  date: '2026-09-09', title, workshop, selfService: workshop === null,
  odometerMetres: 34_650_000, labourCostMinor: 0, partsCostMinor: 165_000, totalCostMinor: 165_000,
  currency: 'BDT', notes, receiptPaths: [], itemsSummary: null, estimate: null,
  completedRuleIds: [], clientRef: id,
});

const item = (id: string, brand: string | null, product: string | null, spec: string | null): ServiceItem => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  serviceId: 'svc1', ruleId: null, category: 'Engine oil',
  brand, product, spec, quantity: 1, unit: 'litre', costMinor: 82_000, currency: 'BDT',
});

const doc = (id: string, title: string, reference: string | null): VaultDocument => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  kind: 'insurance', customKindLabel: null, title, reference,
  issuedOn: null, expiresOn: '2027-03-11', filePath: null, keepOfflineCopy: true, notes: null, clientRef: id,
});

const part = (id: string, name: string, fittedBy: string | null): Part => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  name, installedOdometerMetres: 30_000_000, installedDate: '2026-05-18',
  expectedLifeMetres: null, costMinor: 145_000, currency: 'BDT', fittedBy,
  linkedServiceId: null, removedDate: null, removedOdometerMetres: null, notes: null, clientRef: id,
});

const fuel = (id: string, station: string | null): FuelEntry => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  date: '2026-09-13', odometerMetres: 34_712_000, litresMl: 8_200,
  pricePerLitreMinor: 12_200, totalCostMinor: 100_400, currency: 'BDT',
  fillType: 'full', missedPreviousFill: false, station, notes: null, receiptPath: null, clientRef: id,
});

const accessory = (id: string, name: string): Accessory => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  name, purchaseCostMinor: 800_000, installationCostMinor: 90_000,
  currency: 'BDT', date: '2026-08-14', notes: null, photoPath: null, linkedServiceId: null, clientRef: id,
});

const data = {
  services: [service('s1', 'Brake pads + oil change', 'Rahim Motors'), service('s2', 'Chain clean', null, 'did it myself')],
  serviceItems: [item('i1', 'Shell', 'Advance AX7', '10W-40'), item('i2', 'NGK', null, 'CPR8EA-9')],
  fuelEntries: [fuel('f1', 'Padma Oil, Mirpur 10'), fuel('f2', null)],
  parts: [part('p1', 'Seat cushion', 'Rahim Motors')],
  accessories: [accessory('a1', 'Givi 27L tail box')],
  documents: [doc('d1', 'Insurance', 'TP-4432871')],
};

describe('an empty query asks nothing', () => {
  it('returns no groups rather than everything', () => {
    expect(searchRecords('', data)).toEqual([]);
    expect(searchRecords('   ', data)).toEqual([]);
  });
});

describe('matching is forgiving about how it was typed', () => {
  it('ignores case', () => {
    expect(countResults(searchRecords('RAHIM', data))).toBe(countResults(searchRecords('rahim', data)));
  });

  it('ignores punctuation, so a hyphen or apostrophe cannot lose a record', () => {
    expect(countResults(searchRecords('10w40', data))).toBeGreaterThan(0);
    expect(countResults(searchRecords('10W-40', data))).toBeGreaterThan(0);
    expect(countResults(searchRecords('cpr8ea9', data))).toBeGreaterThan(0);
  });

  it('matches inside a word, not only at its start', () => {
    expect(countResults(searchRecords('cushion', data))).toBe(1);
  });

  it('strips accents', () => {
    expect(normalise('Rahim’s Moto-Care')).toBe('rahim s moto care');
  });
});

describe('every term has to appear, so more words narrow', () => {
  it('finds the service on one term', () => {
    const groups = searchRecords('rahim', data);
    expect(groups.find((g) => g.kind === 'service')?.results).toHaveLength(1);
  });

  it('narrows rather than widens on two', () => {
    expect(countResults(searchRecords('rahim brake', data))).toBeLessThan(
      countResults(searchRecords('rahim', data)),
    );
  });

  it('finds nothing when one term does not appear', () => {
    expect(searchRecords('rahim kawasaki', data)).toEqual([]);
  });
});

describe('results carry enough to tell records apart', () => {
  it('gives a service its date and who did it', () => {
    const [result] = searchRecords('brake', data).find((g) => g.kind === 'service')?.results ?? [];
    expect(result?.detail).toMatch(/^Rahim Motors · 9 Sep/);
    expect(result?.amountMinor).toBe(165_000);
  });

  it('names a self-service visit as such rather than leaving it blank', () => {
    const [result] = searchRecords('chain', data).find((g) => g.kind === 'service')?.results ?? [];
    expect(result?.detail).toContain('Self-service');
  });

  it('routes a document straight to its own record', () => {
    const [result] = searchRecords('4432871', data).find((g) => g.kind === 'document')?.results ?? [];
    expect(result?.route).toBe('/records/document');
    expect(result?.params).toEqual({ id: 'd1' });
  });

  it('carries no amount on a document, which has no cost', () => {
    const [result] = searchRecords('insurance', data).find((g) => g.kind === 'document')?.results ?? [];
    expect(result?.amountMinor).toBeNull();
  });

  it('adds purchase and fitting for an accessory, the way the ledger does', () => {
    const [result] = searchRecords('givi', data).find((g) => g.kind === 'accessory')?.results ?? [];
    expect(result?.amountMinor).toBe(890_000);
  });
});

describe('what a rider actually remembers', () => {
  it('finds a service by its workshop', () => {
    expect(searchRecords('rahim', data).some((g) => g.kind === 'service')).toBe(true);
  });

  it('finds a fill by its station', () => {
    expect(searchRecords('padma', data).some((g) => g.kind === 'fuel')).toBe(true);
  });

  it('finds the oil by its grade', () => {
    const group = searchRecords('10w-40', data).find((g) => g.kind === 'product');
    expect(group?.results[0]?.title).toContain('Shell');
  });

  it('finds a note the rider wrote', () => {
    expect(searchRecords('myself', data).some((g) => g.kind === 'service')).toBe(true);
  });

  it('skips a fill with no station rather than titling it blank', () => {
    const titles = searchRecords('padma', data).flatMap((g) => g.results.map((r) => r.title));
    expect(titles).not.toContain('');
  });
});

describe('grouping', () => {
  it('orders groups by what riders hunt for most', () => {
    const kinds = searchRecords('rahim', data).map((g) => g.kind);
    expect(kinds.indexOf('service')).toBeLessThan(kinds.indexOf('part'));
  });

  it('caps each group so one type cannot bury the rest', () => {
    const many = { ...data, parts: Array.from({ length: 20 }, (_, i) => part(`p${i}`, `Brake pad ${i}`, null)) };
    const group = searchRecords('brake', many).find((g) => g.kind === 'part');
    expect(group?.results).toHaveLength(6);
  });

  it('omits a group entirely rather than showing it empty', () => {
    expect(searchRecords('givi', data).map((g) => g.kind)).toEqual(['accessory']);
  });
});

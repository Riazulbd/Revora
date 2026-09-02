import type { Accessory, Expense, FuelEntry, Part, ServiceRecord } from '@/types';
import { breakdown, buildLedger, monthlyTotals, totalMinor } from './expenses';

const base = { userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1, currency: 'BDT' as const };

const service = (over: Partial<ServiceRecord> = {}): ServiceRecord => ({
  ...base,
  id: 's1',
  title: 'Front brake job',
  workshop: 'Rahim Moto Care',
  selfService: false,
  date: '2026-08-24',
  odometerMetres: 5_050_000,
  labourCostMinor: 40_000,
  partsCostMinor: 200_000,
  totalCostMinor: 240_000, // BDT 2,400
  notes: null,
  completedRuleIds: [],
  itemsSummary: null,
  receiptPaths: [],
  estimate: null,
  clientRef: 'r-s1',
  ...over,
});

const part = (over: Partial<Part> = {}): Part => ({
  ...base,
  id: 'p1',
  name: 'Yongli front brake pads',
  installedOdometerMetres: 5_050_000,
  installedDate: '2026-08-24',
  expectedLifeMetres: 8_000_000,
  costMinor: 190_000,
  fittedBy: null,
  linkedServiceId: null,
  removedDate: null,
  removedOdometerMetres: null,
  notes: null,
  clientRef: 'r-p1',
  ...over,
});

const fuel = (over: Partial<FuelEntry> = {}): FuelEntry => ({
  ...base,
  id: 'f1',
  date: '2026-08-30',
  odometerMetres: 5_180_000,
  litresMl: 9000,
  pricePerLitreMinor: 14500,
  totalCostMinor: 130_500,
  fillType: 'full',
  missedPreviousFill: false,
  station: null,
  notes: null,
  receiptPath: null,
  clientRef: 'r-f1',
  ...over,
});

const accessory = (over: Partial<Accessory> = {}): Accessory => ({
  ...base,
  id: 'a1',
  name: 'Givi 27L tail box',
  purchaseCostMinor: 800_000,
  installationCostMinor: 90_000,
  date: '2026-08-10',
  notes: null,
  photoPath: null,
  linkedServiceId: null,
  clientRef: 'r-a1',
  ...over,
});

const expense = (over: Partial<Expense> = {}): Expense => ({
  ...base,
  id: 'e1',
  amountMinor: 6000,
  category: 'parking',
  derived: false,
  linkedRuleId: null,
  date: '2026-08-28',
  note: 'Parking — Bashundhara',
  clientRef: 'r-e1',
  ...over,
});

const empty = {
  fuelEntries: [],
  services: [],
  parts: [],
  accessories: [],
  expenses: [],
  currency: 'BDT' as const,
};

describe('the critical expense case from the specification', () => {
  it('counts a BDT 2,400 service exactly once', () => {
    const ledger = buildLedger({ ...empty, services: [service()] });
    expect(ledger).toHaveLength(1);
    expect(totalMinor(ledger)).toBe(240_000);
  });

  it('does not count a part again when it was fitted during that service', () => {
    const ledger = buildLedger({
      ...empty,
      services: [service()],
      parts: [part({ linkedServiceId: 's1', costMinor: 190_000 })],
    });
    expect(ledger).toHaveLength(1);
    expect(totalMinor(ledger)).toBe(240_000); // not 430,000
  });

  it('counts a standalone part on its own', () => {
    const ledger = buildLedger({ ...empty, parts: [part({ linkedServiceId: null })] });
    expect(totalMinor(ledger)).toBe(190_000);
  });

  it('counts a standalone maintenance completion, filed as a linked expense', () => {
    const ledger = buildLedger({
      ...empty,
      expenses: [expense({ id: 'e-maint', amountMinor: 50_000, category: 'other', linkedRuleId: 'rule1', note: 'Chain lube' })],
    });
    expect(totalMinor(ledger)).toBe(50_000);
    expect(ledger[0]!.source).toBe('maintenance');
  });

  it('keeps a web-filed derived cost out of the ledger entirely', () => {
    // The web product files fuel and part costs into `expenses` too. Those rows
    // are marked derived on read; counting them would double the fuel entry
    // that already carries the money.
    const ledger = buildLedger({
      ...empty,
      fuelEntries: [fuel()],
      expenses: [expense({ id: 'e-fuel', amountMinor: 130_500, derived: true, note: 'Fuel — 9.0 L' })],
    });
    expect(ledger).toHaveLength(1);
    expect(totalMinor(ledger)).toBe(130_500);
  });

  it('does not count an accessory again when it was fitted during a service', () => {
    const ledger = buildLedger({
      ...empty,
      services: [service()],
      accessories: [accessory({ linkedServiceId: 's1' })],
    });
    expect(totalMinor(ledger)).toBe(240_000);
  });
});

describe('ledger composition', () => {
  it('produces exactly one line per contributing record', () => {
    const ledger = buildLedger({
      ...empty,
      fuelEntries: [fuel()],
      services: [service()],
      parts: [part({ linkedServiceId: 's1' })],
      accessories: [accessory()],
      expenses: [expense()],
    });
    expect(ledger).toHaveLength(4);
    expect([...ledger.map((l) => l.source)].sort()).toEqual([
      'accessory',
      'fuel',
      'manual',
      'service',
    ]);
    expect(totalMinor(ledger)).toBe(130_500 + 240_000 + 890_000 + 6_000);
  });

  it('sorts newest first', () => {
    const ledger = buildLedger({ ...empty, fuelEntries: [fuel()], services: [service()] });
    expect(ledger[0]!.date).toBe('2026-08-30');
    expect(ledger[1]!.date).toBe('2026-08-24');
  });

  it('skips zero-value records rather than filling the ledger with noise', () => {
    const ledger = buildLedger({
      ...empty,
      parts: [part({ costMinor: 0 })],
      accessories: [accessory({ purchaseCostMinor: 0, installationCostMinor: 0 })],
    });
    expect(ledger).toHaveLength(0);
  });

  it('breaks spending down by source without losing a taka', () => {
    const ledger = buildLedger({
      ...empty,
      fuelEntries: [fuel()],
      services: [service()],
      accessories: [accessory()],
      expenses: [expense()],
    });
    const b = breakdown(ledger);
    expect(b.fuel).toBe(130_500);
    expect(b.services).toBe(240_000);
    expect(b.accessories).toBe(890_000);
    expect(b.other).toBe(6_000);
    expect(b.total).toBe(b.fuel + b.services + b.parts + b.accessories + b.other);
  });

  it('handles an entirely empty garage', () => {
    const ledger = buildLedger(empty);
    expect(ledger).toEqual([]);
    expect(totalMinor(ledger)).toBe(0);
    expect(monthlyTotals(ledger)).toEqual([]);
  });
});

describe('monthlyTotals', () => {
  it('groups by calendar month, oldest first', () => {
    const ledger = buildLedger({
      ...empty,
      fuelEntries: [fuel({ id: 'f1', date: '2026-07-05', totalCostMinor: 100 }), fuel({ id: 'f2', date: '2026-08-30', totalCostMinor: 200 })],
    });
    expect(monthlyTotals(ledger)).toEqual([
      { key: '2026-07', totalMinor: 100 },
      { key: '2026-08', totalMinor: 200 },
    ]);
  });
});

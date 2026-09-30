/**
 * QA audit — Phase B fixture pins.
 *
 * Every string the e2e/audit/*.yaml flows assert on a device is produced here
 * from the calculation layer with the SAME fixture, so a red flow in Phase B
 * can be split into "the screen disagrees with analyseBike()" versus "the
 * flow itself is wrong". Nothing here touches a device.
 *
 * Every expected value is a literal with its arithmetic in a comment. Nothing
 * is derived by calling the module under test.
 */
import type {
  Accessory,
  Bike,
  Expense,
  FuelEntry,
  MaintenanceRule,
  OdometerReading,
  SafetyCheck,
  ServiceItem,
  UnitPreferences,
  VaultDocument,
} from '@/types';
import { analyseBike, type GarageData } from '@/calculations/analytics';
import { calculateMileageSummary, confidenceLabel, mileageBlockerMessage } from '@/calculations/mileage';
import { deriveFuelAmounts } from '@/calculations/fuel';
import {
  calculateMaintenanceStatus,
  countByStatus,
  DEFAULT_RULES,
  STATUS_LABEL,
} from '@/calculations/maintenance';
import { SETTLED_DISTANCE_FOR_COST_PER_UNIT } from '@/calculations/ownership';
import { documentStatus } from '@/calculations/documents';
import { attentionItems } from '@/calculations/attention';
import { currentCondition } from '@/calculations/safety';
import { GROUP_LABEL, searchRecords } from '@/calculations/search';
import { describeRule } from '@/features/maintenance/describeRule';
import { fromMinor } from '@/features/shared/formValues';
import { documentSchema } from '@/validation/schemas';
import {
  costPerDistanceHint,
  formatCurrency,
  formatDistance,
  formatDistanceValue,
  formatMileage,
  formatMileageValue,
  formatRate,
  formatVolume,
} from '@/utils/format';

const TODAY = '2026-09-16';
// Local-time createdAt on TODAY so the bike's starting-reading point is dated TODAY.
const CREATED_AT = new Date(2026, 8, 16, 10, 0, 0).getTime();

const units: UnitPreferences = {
  currency: 'BDT',
  distance: 'km',
  volume: 'L',
  mileage: 'km_per_l',
  costBasis: 'running',
};

// ---------------------------------------------------------------------------
// Fixtures — every required field present (src/types/index.ts). These mirror
// what lib/fresh-anon-bike.yaml + lib/add-fill.yaml create on the device.
// ---------------------------------------------------------------------------

const bike: Bike = {
  id: 'b1', userId: 'u1', createdAt: CREATED_AT, updatedAt: CREATED_AT,
  manufacturer: '', model: '', nickname: 'Audit Bike',
  year: null, tankCapacityMl: null, purchasePriceMinor: null,
  purchaseDate: null, engineNumber: null, chassisNumber: null, photoPath: null,
  currency: 'BDT', initialOdometerMetres: 4_845_000, storedOdometerMetres: 4_845_000,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 }, archivedAt: null,
};

const startingReading: OdometerReading = {
  id: 'o0', userId: 'u1', bikeId: 'b1', createdAt: CREATED_AT, updatedAt: CREATED_AT,
  metres: 4_845_000, date: TODAY, source: 'manual', sourceId: null, note: 'Starting reading',
};

/** A fill as the add-fuel form stores it: total = round(litresMl × price / 1000). */
const fill = (
  id: string,
  metres: number,
  litresMl: number,
  pricePerLitreMinor: number,
  fillType: FuelEntry['fillType'],
  totalCostMinor: number,
  createdAt: number,
): FuelEntry => ({
  id, userId: 'u1', bikeId: 'b1', createdAt, updatedAt: createdAt, date: TODAY,
  odometerMetres: metres, litresMl, pricePerLitreMinor, totalCostMinor, currency: 'BDT',
  fillType, missedPreviousFill: false, station: null, notes: null, receiptPath: null,
  clientRef: 'cr-' + id,
});

/** The five starter rules exactly as useAddBike seeds them at 4,845 km / today. */
const seededRules = (): MaintenanceRule[] =>
  DEFAULT_RULES.map((t, i) => ({
    id: `rule${i}`, userId: 'u1', bikeId: 'b1', createdAt: CREATED_AT, updatedAt: CREATED_AT,
    name: t.name, intervalMetres: t.intervalMetres, intervalDays: t.intervalDays,
    warnAheadMetres: t.warnAheadMetres, warnAheadDays: t.warnAheadDays, enabled: true,
    lastCompletedMetres: 4_845_000, lastCompletedDate: TODAY, notes: null,
  }));

const garage = (over: Partial<GarageData> = {}): GarageData => ({
  bike,
  fuelEntries: [],
  fuelAdjustments: [],
  odometerReadings: [startingReading],
  rules: seededRules(),
  services: [],
  parts: [],
  accessories: [],
  expenses: [],
  units,
  today: TODAY,
  ...over,
});

// A 4,845 Full 9 L @145 → 9,000 × 14,500 / 1,000 = 130,500 minor
// B 4,965 Partial 3 L @145 → 3,000 × 14,500 / 1,000 = 43,500 minor
// C 5,118 Full 4 L @145 → 4,000 × 14,500 / 1,000 = 58,000 minor
const A = fill('A', 4_845_000, 9_000, 14_500, 'full', 130_500, CREATED_AT + 1);
const B = fill('B', 4_965_000, 3_000, 14_500, 'partial', 43_500, CREATED_AT + 2);
const C = fill('C', 5_118_000, 4_000, 14_500, 'full', 58_000, CREATED_AT + 3);

// ---------------------------------------------------------------------------
// 10 — fuel fixture
// ---------------------------------------------------------------------------

describe('10-fuel-fixture — A/B/C then edit B to 3.5 L (same-day fills, ordered by odometer)', () => {
  it('A, B, C → 273 km / 7 L = 39.0 km/L, one interval, MEDIUM, odometer 5,118', () => {
    const a = analyseBike(garage({ fuelEntries: [A, B, C] }));
    const latest = a.mileage.latest;
    expect(latest).not.toBeNull();
    // 5,118,000 − 4,845,000 = 273,000 m ; fuel B + C = 3,000 + 4,000 = 7,000 ml
    expect(latest!.distanceMetres).toBe(273_000);
    expect(latest!.fuelMl).toBe(7_000);
    // 273 / 7 = 39.0
    expect(formatMileageValue(latest!.efficiency, 'km_per_l')).toBe('39.0');
    expect(formatMileage(latest!.efficiency, 'km_per_l')).toBe('39.0 km/L');
    expect(a.mileage.count).toBe(1);
    // one partial inside the interval → medium
    expect(confidenceLabel(a.mileage.confidence)).toBe('MEDIUM');
    // Dashboard hero: 5,118,000 m → "5,118"
    expect(formatDistanceValue(a.odometer.currentMetres, 'km')).toBe('5,118');
    // Row A total: 130,500 minor at 0 decimals → "BDT 1,305"
    expect(formatCurrency(A.totalCostMinor, 'BDT')).toBe('BDT 1,305');
    // The badge sits on C (the closing fill), not on A or B.
    expect(latest!.toEntryId).toBe('C');
  });

  it('B edited to 3.5 L → 273 km / 7.5 L = 36.4 km/L; explain sheet strings; B total BDT 508', () => {
    // 3,500 × 14,500 / 1,000 = 50,750 minor
    const B2: FuelEntry = { ...B, litresMl: 3_500, totalCostMinor: 50_750 };
    const a = analyseBike(garage({ fuelEntries: [A, B2, C] }));
    const latest = a.mileage.latest!;
    // fuel = 3,500 + 4,000 = 7,500 ml
    expect(latest.fuelMl).toBe(7_500);
    // 273 / 7.5 = 36.4
    expect(formatMileageValue(latest.efficiency, 'km_per_l')).toBe('36.4');
    // "How is this calculated?" sheet: "273 km ÷ 7.5 L = 36.4 km/L"
    expect(formatDistance(latest.distanceMetres, 'km')).toBe('273 km');
    expect(formatVolume(latest.fuelMl, 'L')).toBe('7.5 L');
    expect(formatMileage(latest.efficiency, 'km_per_l')).toBe('36.4 km/L');
    // 50,750 minor shown at 0 decimals, half-up: 507.5 → 508
    expect(formatCurrency(B2.totalCostMinor, 'BDT')).toBe('BDT 508');
    // the form's total box after the litres edit: fromMinor(50,750, 2) = "507.5"
    expect(fromMinor(50_750, 2)).toBe('507.5');
    // Dashboard AVERAGE = weighted average over the single interval = the same figure
    expect(formatMileageValue(a.mileage.average, 'km_per_l')).toBe('36.4');
  });
});

// ---------------------------------------------------------------------------
// 11 — fuel money
// ---------------------------------------------------------------------------

describe('11-fuel-money — deriveFuelAmounts as the form calls it', () => {
  it('litres 9 + price 145 → total 1305', () => {
    // 9,000 ml × 14,500 minor / 1,000 = 130,500 minor → fromMinor → "1305"
    const d = deriveFuelAmounts({ litresMl: 9_000, pricePerLitreMinor: 14_500, totalCostMinor: null }, 'price');
    expect(d.totalCostMinor).toBe(130_500);
    expect(fromMinor(d.totalCostMinor, 2)).toBe('1305');
  });

  it('litres 9 + total 1305 → price 145', () => {
    // 130,500 × 1,000 / 9,000 = 14,500 minor → "145"
    const d = deriveFuelAmounts({ litresMl: 9_000, pricePerLitreMinor: null, totalCostMinor: 130_500 }, 'total');
    expect(d.pricePerLitreMinor).toBe(14_500);
    expect(fromMinor(d.pricePerLitreMinor, 2)).toBe('145');
  });

  it('price 145 + total 1305 → litres 9 (the calculation does this; the form never writes it back)', () => {
    // 130,500 / 14,500 × 1,000 = 9,000 ml
    const d = deriveFuelAmounts({ litresMl: null, pricePerLitreMinor: 14_500, totalCostMinor: 130_500 }, 'litres');
    expect(d.litresMl).toBe(9_000);
    // src/app/fuel/add.tsx recalculate() only calls setTotal / setPrice — see
    // the audit finding; flow 11's third leg is expected to fail on device.
  });
});

// ---------------------------------------------------------------------------
// 12 — blocked states
// ---------------------------------------------------------------------------

describe('12-blocked-states — each "no figure" state names itself', () => {
  it('no fills → no_fills message', () => {
    const s = calculateMileageSummary([]);
    expect(s.blockedBy).toBe('no_fills');
    expect(mileageBlockerMessage(s.blockedBy!)).toBe(
      'Log your first fill and Revora starts measuring from there.',
    );
  });

  it('one partial fill → one_fill message, no provisional estimate', () => {
    // 4,900 Partial 4 L @145 → 4,000 × 14,500 / 1,000 = 58,000
    const p1 = fill('P1', 4_900_000, 4_000, 14_500, 'partial', 58_000, CREATED_AT + 1);
    const s = calculateMileageSummary([p1]);
    expect(s.latest).toBeNull();
    expect(s.provisional).toBeNull();
    expect(s.blockedBy).toBe('one_fill');
    expect(mileageBlockerMessage('one_fill')).toBe(
      'One fill is a starting point, not a measurement. The next one gives you a figure.',
    );
  });

  it('two partial fills → ESTIMATED 40.0 across 200 km from 5.0 L + "Mark your next one Full"', () => {
    const p1 = fill('P1', 4_900_000, 4_000, 14_500, 'partial', 58_000, CREATED_AT + 1);
    // 5,100 Partial 5 L @145 → 5,000 × 14,500 / 1,000 = 72,500
    const p2 = fill('P2', 5_100_000, 5_000, 14_500, 'partial', 72_500, CREATED_AT + 2);
    const s = calculateMileageSummary([p1, p2]);
    expect(s.latest).toBeNull();
    const est = s.provisional!;
    // 5,100,000 − 4,900,000 = 200,000 m ; fuel after the opening fill = 5,000 ml
    expect(est.distanceMetres).toBe(200_000);
    expect(est.fuelMl).toBe(5_000);
    // 200 / 5 = 40.0
    expect(formatMileageValue(est.efficiency, 'km_per_l')).toBe('40.0');
    expect(confidenceLabel(est.confidence)).toBe('ESTIMATED');
    expect(s.blockedBy).toBe('no_closing_full_tank');
    // Dashboard hint-mileage-estimated text prefix
    expect(`Estimated across ${formatDistance(est.distanceMetres, 'km')} from ${formatVolume(est.fuelMl, 'L')}.`).toBe(
      'Estimated across 200 km from 5.0 L.',
    );
    expect(mileageBlockerMessage(s.blockedBy!)).toContain('Mark your next one Full');
  });
});

// ---------------------------------------------------------------------------
// 20 — costs fixture
// ---------------------------------------------------------------------------

describe('20-costs-fixture — 100 km tracked, eligible 1,000, accessory 500', () => {
  // 4,945 Full 5 L @100 → 5,000 × 10,000 / 1,000 = 50,000 minor (500)
  const F = fill('F', 4_945_000, 5_000, 10_000, 'full', 50_000, CREATED_AT + 1);
  const parking: Expense = {
    id: 'e1', userId: 'u1', bikeId: 'b1', createdAt: CREATED_AT + 2, updatedAt: CREATED_AT + 2,
    amountMinor: 50_000, currency: 'BDT', category: 'parking', derived: false, linkedRuleId: null,
    date: TODAY, note: 'Audit parking', clientRef: 'cr-e1',
  };
  const tailBox: Accessory = {
    id: 'a1', userId: 'u1', bikeId: 'b1', createdAt: CREATED_AT + 3, updatedAt: CREATED_AT + 3,
    name: 'Audit tail box', purchaseCostMinor: 50_000, installationCostMinor: 0,
    currency: 'BDT', date: TODAY, notes: null, photoPath: null, linkedServiceId: null, clientRef: 'cr-a1',
  };
  const a = analyseBike(garage({ fuelEntries: [F], expenses: [parking], accessories: [tailBox] }));

  it('tracked distance 100 km (max 4,945,000 − min 4,845,000)', () => {
    expect(a.ownership.distanceMetres).toBe(100_000);
  });

  it('TOTAL SPENT = 500 + 500 + 500 = 1,500 → "BDT 1,500"', () => {
    expect(a.ownership.headlineCostMinor).toBe(150_000);
    expect(formatCurrency(a.ownership.headlineCostMinor, 'BDT')).toBe('BDT 1,500');
  });

  it('COST / KM = (500 + 500) / 100 km = 10 → "BDT 10.0"; accessory excluded', () => {
    // consumption = 100,000 minor ; scaled ×100 ×1,000 m/km / 100,000 m = 100,000
    expect(a.ownership.consumptionCostMinor).toBe(100_000);
    expect(a.ownership.costPerDistanceScaled).toBe(100_000);
    expect(formatRate(a.ownership.costPerDistanceScaled, 'BDT')).toBe('BDT 10.0');
  });

  it('caveat line below the 1,000 km settle point', () => {
    expect(a.ownership.costPerDistanceSettled).toBe(false);
    expect(costPerDistanceHint(a.ownership.distanceMetres, SETTLED_DISTANCE_FOR_COST_PER_UNIT, 'km')).toBe(
      'Based on 100 km so far, so one large purchase still moves it a lot. It settles around 1,000 km.',
    );
  });
});

// ---------------------------------------------------------------------------
// 30 — maintenance
// ---------------------------------------------------------------------------

describe('30-maintenance — five starter rules on day one, then Mark done at 5,000 km', () => {
  it('day one: all five GOOD, "5 good", expected subtitle text', () => {
    const rules = seededRules();
    expect(rules.map((r) => r.name)).toEqual([
      'Engine oil & filter',
      'Chain clean, lube & tension',
      'Tyre pressure & tread',
      'Air filter',
      'Brake pads & fluid',
    ]);
    const statuses = rules.map((r) => calculateMaintenanceStatus(r, 4_845_000, TODAY));
    expect(statuses.map((s) => STATUS_LABEL[s.kind])).toEqual(['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD']);
    expect(countByStatus(statuses).good).toBe(5);
    expect(countByStatus(statuses).overdue).toBe(0);
    // Engine oil: remaining 3,000 km of 3,000; 180 of 180 days → distance leads (<=)
    expect(describeRule(rules[0]!, statuses[0]!, units)).toBe('in 3,000 km · every 3,000 km · or 180 days');
    // Chain: 500 km of 500; 14 of 14 days
    expect(describeRule(rules[1]!, statuses[1]!, units)).toBe('in 500 km · every 500 km · or 14 days');
  });

  it('sheet preview: 5,000 + 3,000 → "moves to 8,000 km"', () => {
    expect(`The next due point moves to ${formatDistance(5_000_000 + 3_000_000, 'km')}.`).toBe(
      'The next due point moves to 8,000 km.',
    );
  });

  it('after completing Engine oil at 5,000 km the OTHER rules move: chain 345 km, tyre 845 km', () => {
    const rules = seededRules();
    rules[0] = { ...rules[0]!, lastCompletedMetres: 5_000_000, lastCompletedDate: TODAY };
    const statuses = rules.map((r) => calculateMaintenanceStatus(r, 5_000_000, TODAY));
    // chain: 4,845,000 + 500,000 − 5,000,000 = 345,000
    expect(statuses[1]!.remainingMetres).toBe(345_000);
    expect(describeRule(rules[1]!, statuses[1]!, units)).toBe('in 345 km · every 500 km · or 14 days');
    // tyre: 4,845,000 + 1,000,000 − 5,000,000 = 845,000
    expect(statuses[2]!.remainingMetres).toBe(845_000);
    expect(describeRule(rules[2]!, statuses[2]!, units)).toBe('in 845 km · every 1,000 km · or 30 days');
    // engine oil: 5,000,000 + 3,000,000 − 5,000,000 = 3,000,000 — unchanged text
    expect(describeRule(rules[0]!, statuses[0]!, units)).toBe('in 3,000 km · every 3,000 km · or 180 days');
    // 345,000 > 2 × 100,000 and 845,000 > 2 × 200,000 → still all good
    expect(countByStatus(statuses).good).toBe(5);
    expect(formatDistanceValue(5_000_000, 'km')).toBe('5,000');
  });
});

// ---------------------------------------------------------------------------
// 40 — documents
// ---------------------------------------------------------------------------

describe('40-documents — tax token refused undated; VALID needs > 30 days', () => {
  const taxToken = (expiresOn: string | null): VaultDocument => ({
    id: 'd1', userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
    kind: 'tax_token', customKindLabel: null, title: 'Tax token', reference: 'AUD-TT-0001',
    issuedOn: null, expiresOn, filePath: null, keepOfflineCopy: true, notes: null, clientRef: 'cr-d1',
  });

  it('schema refuses a tax token with no valid-until, naming "runs out"', () => {
    const r = documentSchema.safeParse({
      kind: 'tax_token', title: 'Tax token', reference: 'AUD-TT-0001',
      issuedOn: null, expiresOn: null, keepOfflineCopy: true, notes: null,
    });
    expect(r.success).toBe(false);
    const msg = r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
    expect(msg).toContain('tax token runs out');
  });

  it('15th of next month (29 days) is EXPIRING, 15th two months ahead (60 days) is VALID', () => {
    // 2026-09-16 → 2026-10-15 = 29 days ≤ 30 → expiring
    expect(documentStatus(taxToken('2026-10-15'), TODAY)).toBe('expiring');
    // 2026-09-16 → 2026-11-15 = 60 days > 30 → valid
    expect(documentStatus(taxToken('2026-11-15'), TODAY)).toBe('valid');
  });
});

// ---------------------------------------------------------------------------
// 41 — safety
// ---------------------------------------------------------------------------

describe('41-safety — Action reaches attention; only a LATER OK clears it', () => {
  const check = (id: string, date: string, status: SafetyCheck['status'], summary: string, createdAt: number): SafetyCheck => ({
    id, userId: 'u1', bikeId: 'b1', createdAt, updatedAt: createdAt,
    area: 'brakes', date, status, summary, measurements: null, note: null, photoPath: null, clientRef: 'cr-' + id,
  });
  const action = check('c1', '2026-08-15', 'action', 'Spongy lever', 1);

  it('brakes Action dated 2026-08-15 → "Brakes marked action" with the rider\'s summary', () => {
    const items = attentionItems({ rules: [], documents: [], safetyChecks: [action], distanceUnit: 'km', today: TODAY });
    expect(items.map((i) => i.title)).toEqual(['Brakes marked action']);
    // 2026-08-15 → 2026-09-16 = 32 days
    expect(items[0]!.detail).toBe('Spongy lever · 32 days ago');
  });

  it('brakes OK dated TODAY (later) → attention clears', () => {
    const ok = check('c2', TODAY, 'ok', 'Lever firm after bleed', 2);
    const items = attentionItems({ rules: [], documents: [], safetyChecks: [action, ok], distanceUnit: 'km', today: TODAY });
    expect(items).toEqual([]);
  });

  it('SPEC GAP: an OK check on the SAME day as the Action does not clear it (strict > on date)', () => {
    const sameDayOk = check('c3', '2026-08-15', 'ok', 'Rechecked, fine', 2);
    const items = attentionItems({ rules: [], documents: [], safetyChecks: [action, sameDayOk], distanceUnit: 'km', today: TODAY });
    // latestByArea keeps the first-seen check on a date tie → the Action stays.
    expect(items.map((i) => i.title)).toEqual(['Brakes marked action']);
  });

  it('unchecked areas have status null → the screen labels them NOT CHECKED', () => {
    const state = currentCondition([action]);
    const tyres = state.find((s) => s.area === 'tyres')!;
    expect(tyres.status).toBeNull();
    expect(tyres.latest).toBeNull();
    const brakes = state.find((s) => s.area === 'brakes')!;
    expect(brakes.status).toBe('action');
  });
});

// ---------------------------------------------------------------------------
// 50 — search
// ---------------------------------------------------------------------------

describe('50-search — "10w40" finds a service item whose spec is "10W-40"', () => {
  it('returns one "Products fitted" result titled 10W-40', () => {
    const item: ServiceItem = {
      id: 'si1', userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
      serviceId: 's1', ruleId: 'rule0', category: 'Engine oil & filter',
      brand: null, product: null, spec: '10W-40', quantity: 1, unit: 'piece', costMinor: null, currency: 'BDT',
    };
    const groups = searchRecords('10w40', {
      services: [], serviceItems: [item], fuelEntries: [], parts: [], accessories: [], documents: [],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe('product');
    expect(GROUP_LABEL[groups[0]!.kind]).toBe('Products fitted');
    expect(groups[0]!.results.map((r) => r.title)).toEqual(['10W-40']);
    expect(groups[0]!.results[0]!.detail).toBe('Engine oil & filter');
  });
});

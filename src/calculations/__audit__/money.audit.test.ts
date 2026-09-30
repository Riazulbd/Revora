/**
 * QA audit — money, costs, currencies (sections 3-money, 5).
 *
 * Every expected value below is a literal computed by hand in the comment
 * beside it. Nothing is derived by calling the module under test.
 */
import type { Accessory, Expense, FuelEntry, LedgerEntry, Part, ServiceRecord } from '@/types';
import { buildLedger, breakdown, monthlyTotals, totalMinor } from '../expenses';
import { litresFromPriceAndTotal, normaliseFuelAmounts, priceFromLitresAndTotal, totalFromLitresAndPrice } from '../fuel';
import { currencyDecimals, divideRound, formatMoney, parseDecimal } from '../money';
import { CURRENCIES, CURRENCY_CODES } from '../currencies';
import { calculateOwnershipCost, SETTLED_DISTANCE_FOR_COST_PER_UNIT } from '../ownership';
import { buildOdometerHistory, totalDistanceMetres } from '../odometer';
import { RATE_SCALE, costPerDistance } from '../units';
import { costPerDistanceHint, formatCurrency, formatPricePerVolume, formatRate } from '@/utils/format';

// wire.ts imports the native Firestore module only for the Timestamp type
// guard; a stub keeps the pure conversion helpers importable under jest.
jest.mock('@react-native-firebase/firestore', () => ({ Timestamp: class {} }));
// eslint-disable-next-line import/first
import { majorToMinor, minorToMajor } from '@/repositories/wire';

// ---------------------------------------------------------------------------
// Fixtures — every required field from src/types/index.ts
// ---------------------------------------------------------------------------

const base = { userId: 'u1', bikeId: 'b1', createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 };

const fuel = (over: Partial<FuelEntry> = {}): FuelEntry => ({
  ...base,
  id: 'f1',
  date: '2026-09-02',
  odometerMetres: 4_945_000,
  litresMl: 4_000,
  pricePerLitreMinor: 15_000,
  totalCostMinor: 60_000, // 4 L × BDT 150 = BDT 600
  currency: 'BDT',
  fillType: 'full',
  missedPreviousFill: false,
  station: null,
  notes: null,
  receiptPath: null,
  clientRef: 'r-f1',
  ...over,
});

const service = (over: Partial<ServiceRecord> = {}): ServiceRecord => ({
  ...base,
  id: 's1',
  title: 'Oil change',
  workshop: null,
  selfService: true,
  date: '2026-09-05',
  odometerMetres: null,
  labourCostMinor: 10_000,
  partsCostMinor: 30_000,
  totalCostMinor: 40_000, // BDT 400
  currency: 'BDT',
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
  name: 'Oil filter',
  installedOdometerMetres: 0,
  installedDate: '2026-09-05',
  expectedLifeMetres: null,
  costMinor: 25_000,
  currency: 'BDT',
  fittedBy: null,
  linkedServiceId: 's1',
  removedDate: null,
  removedOdometerMetres: null,
  notes: null,
  clientRef: 'r-p1',
  ...over,
});

const accessory = (over: Partial<Accessory> = {}): Accessory => ({
  ...base,
  id: 'a1',
  name: 'Tail box',
  purchaseCostMinor: 45_000,
  installationCostMinor: 5_000, // 450 + 50 = BDT 500
  currency: 'BDT',
  date: '2026-09-08',
  notes: null,
  photoPath: null,
  linkedServiceId: null,
  clientRef: 'r-a1',
  ...over,
});

const expense = (over: Partial<Expense> = {}): Expense => ({
  ...base,
  id: 'e1',
  amountMinor: 12_345,
  currency: 'BDT',
  category: 'parking',
  derived: true,
  linkedRuleId: null,
  date: '2026-09-09',
  note: null,
  clientRef: 'r-e1',
  ...over,
});

/** fuel 60_000 + service 40_000 + accessory 50_000 = 150_000 minor = BDT 1,500. */
const ledgerInput = {
  fuelEntries: [fuel()],
  services: [service()],
  parts: [
    part(), // linked to s1 → no line
    part({ id: 'p2', name: 'Free bolt', linkedServiceId: null, costMinor: 0, clientRef: 'r-p2' }), // zero → no line
  ],
  accessories: [
    accessory(),
    accessory({ id: 'a2', name: 'Linked grips', linkedServiceId: 's1', clientRef: 'r-a2' }), // linked → no line
  ],
  expenses: [expense()], // derived → no line
  currency: 'BDT' as const,
};

const line = (source: LedgerEntry['source'], amountMinor: number, currency: LedgerEntry['currency'] = 'BDT', id = `${source}-${amountMinor}`): LedgerEntry => ({
  id,
  sourceId: id,
  source,
  label: source,
  date: '2026-09-01',
  amountMinor,
  currency,
});

// ---------------------------------------------------------------------------
// 1. Fuel money triad
// ---------------------------------------------------------------------------

describe('MON-01 fuel triad is exact in integer minor units', () => {
  it('total = 9_000 ml × 14_500 minor/L = 130_500 minor (BDT 1,305.00)', () => {
    // 9_000 × 14_500 = 130_500_000; ÷ 1_000 ml/L = 130_500 exactly.
    expect(totalFromLitresAndPrice(9_000, 14_500)).toBe(130_500);
  });
  it('price/L = 130_500 × 1_000 ÷ 9_000 = 14_500', () => {
    // 130_500_000 ÷ 9_000 = 14_500 exactly.
    expect(priceFromLitresAndTotal(9_000, 130_500)).toBe(14_500);
  });
  it('litres = 130_500 × 1_000 ÷ 14_500 = 9_000 ml', () => {
    // 130_500_000 ÷ 14_500 = 9_000 exactly.
    expect(litresFromPriceAndTotal(14_500, 130_500)).toBe(9_000);
  });
});

// ---------------------------------------------------------------------------
// 2. Non-representable division and the rounding rule
// ---------------------------------------------------------------------------

describe('MON-02 non-representable division returns an integer, half away from zero', () => {
  it('100_000 minor over 7_000 ml → 14285.714… → 14_286 (an integer)', () => {
    // 100_000 × 1_000 = 100_000_000; ÷ 7_000 = 14_285.714…; nearest = 14_286.
    const price = priceFromLitresAndTotal(7_000, 100_000);
    expect(Number.isInteger(price)).toBe(true);
    expect(price).toBe(14_286);
  });
  it('exact .5 rounds up (5 ÷ 2 = 2.5 → 3), so it is not banker\'s (2) and not truncation (2)', () => {
    expect(divideRound(5, 2)).toBe(3);
  });
  it('3.5 → 4 (banker\'s and half-up agree here; guards against a mixed rule)', () => {
    expect(divideRound(7, 2)).toBe(4);
  });
  it('negative .5 rounds away from zero (-5 ÷ 2 = -2.5 → -3), not toward +∞ (-2)', () => {
    expect(divideRound(-5, 2)).toBe(-3);
  });
  it('below .5 rounds down (1 ÷ 3 = 0.333 → 0; 2 ÷ 3 = 0.667 → 1)', () => {
    expect(divideRound(1, 3)).toBe(0);
    expect(divideRound(2, 3)).toBe(1);
  });
  it('fuel boundary: total 6 minor over 4_000 ml → 1.5 minor/L → 2', () => {
    // 6 × 1_000 = 6_000; ÷ 4_000 = 1.5; half away from zero → 2.
    expect(priceFromLitresAndTotal(4_000, 6)).toBe(2);
  });
  it('the triad does not always round-trip: 7_000 ml at 14_286/L recomputes to 100_002, not 100_000', () => {
    // 7_000 × 14_286 = 100_002_000; ÷ 1_000 = 100_002. A rider who typed a
    // total of 1,000.00 and 7 L will see price 142.86 and total 1,000.02 if the
    // total is ever re-derived from the rounded price.
    expect(totalFromLitresAndPrice(7_000, 14_286)).toBe(100_002);
  });
  it('save path keeps the total the rider paid: 7 L, total 100_000, form-derived price 14_286 → stored total 100_000', () => {
    // The rider typed BDT 1,000.00 on the receipt. The form derived 142.86/L.
    // On save both are present; the stored total must be the receipt figure.
    const saved = normaliseFuelAmounts({ litresMl: 7_000, pricePerLitreMinor: 14_286, totalCostMinor: 100_000 });
    expect(saved?.totalCostMinor).toBe(100_000);
  });
  it('parseDecimal half-up on the dropped digit: "9.005" at 2 dp → 901; "9.004" → 900', () => {
    expect(parseDecimal('9.005', 2)).toBe(901);
    expect(parseDecimal('9.004', 2)).toBe(900);
  });
});

// ---------------------------------------------------------------------------
// 3. Minor-unit exponents and the currency table
// ---------------------------------------------------------------------------

describe('MON-03 ISO 4217 exponents and formatting of the same 1_305 minor units', () => {
  it('JPY → 0, BDT → 2, KWD → 3', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('BDT')).toBe(2);
    expect(currencyDecimals('KWD')).toBe(3);
  });
  it('1_305 minor units: JPY 1,305 / BDT 13 (13.05) / KWD 1 (1.305)', () => {
    // JPY: exponent 0 → 1_305 yen → "JPY 1,305".
    expect(formatCurrency(1_305, 'JPY')).toBe('JPY 1,305');
    // BDT: 1_305 poisha = 13.05 taka → default 0 dp → 13; with 2 dp → 13.05.
    expect(formatCurrency(1_305, 'BDT')).toBe('BDT 13');
    expect(formatCurrency(1_305, 'BDT', 2)).toBe('BDT 13.05');
    // KWD: 1_305 fils = 1.305 dinar → 0 dp → 1; 3 dp → 1.305.
    expect(formatCurrency(1_305, 'KWD')).toBe('KWD 1');
    expect(formatCurrency(1_305, 'KWD', 3)).toBe('KWD 1.305');
  });
  it('design example: 130_500 poisha → "BDT 1,305"', () => {
    expect(formatCurrency(130_500, 'BDT')).toBe('BDT 1,305');
  });
  it('the table holds 149 unique codes', () => {
    // Hand count of the TABLE literal in currencies.ts: 149 rows, no repeats.
    expect(CURRENCIES.length).toBe(149);
    expect(new Set(CURRENCY_CODES).size).toBe(149);
  });
  it('every exponent in the table is 0, 2 or 3 and the seven 3-dp currencies are the ISO ones', () => {
    const three = CURRENCIES.filter((c) => c.minorUnits === 3).map((c) => c.code).sort();
    expect(three).toEqual(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
  });
  it('unknown code falls back to exponent 2', () => {
    expect(currencyDecimals('XXX' as never)).toBe(2);
  });
});

describe('MON-03b display helpers with a non-2 exponent', () => {
  it('formatPricePerVolume: ¥150/L must not render as "JPY 1.50"', () => {
    // 150 yen, exponent 0 → expected "JPY 150".
    expect(formatPricePerVolume(150, 'JPY')).toBe('JPY 150');
  });
  it('formatPricePerVolume: 0.300 KWD/L (300 fils) must not render as "KWD 0"', () => {
    // 300 fils = 0.300 dinar → expected "KWD 0.300".
    expect(formatPricePerVolume(300, 'KWD')).toBe('KWD 0.300');
  });
  it('formatRate scales by the currency exponent: 100_000 scaled → BDT 10.0 / JPY 1,000 / KWD 1.0', () => {
    // scaled 100_000 ÷ RATE_SCALE 100 = 1_000 minor per km.
    // BDT: 1_000 poisha = 10.00 → "BDT 10.0". JPY: 1_000 yen → ≥100 → "JPY 1,000".
    // KWD: 1_000 fils = 1.000 → "KWD 1.0".
    expect(formatRate(100_000, 'BDT')).toBe('BDT 10.0');
    expect(formatRate(100_000, 'JPY')).toBe('JPY 1,000');
    expect(formatRate(100_000, 'KWD')).toBe('KWD 1.0');
  });
  it('formatMoney with decimals above the exponent must not move the point: ¥1,305 at 2 dp', () => {
    // Exponent 0: the amount is 1,305 yen whatever precision is asked for.
    expect(formatMoney(1_305, 'JPY', { decimals: 2 })).toBe('JPY 1,305.00');
  });
});

// ---------------------------------------------------------------------------
// 4. Ledger fixture → ownership cost
// ---------------------------------------------------------------------------

describe('MON-04 ownership cost over the 100 km fixture', () => {
  const ledger = buildLedger(ledgerInput);
  const cost = calculateOwnershipCost({
    bike: { purchasePriceMinor: null },
    ledger,
    distanceMetres: 100_000,
    distanceUnit: 'km',
  });

  it('RATE_SCALE is 100 (483 means 4.83/km)', () => {
    expect(RATE_SCALE).toBe(100);
  });
  it('runningCostMinor = 60_000 + 40_000 + 50_000 = 150_000', () => {
    expect(cost.runningCostMinor).toBe(150_000);
  });
  it('consumptionCostMinor excludes the accessory: 60_000 + 40_000 = 100_000', () => {
    expect(cost.consumptionCostMinor).toBe(100_000);
  });
  it('costPerDistanceScaled = 100_000 minor ÷ 100 km = 1_000 minor/km = BDT 10.00/km → scaled 100_000', () => {
    // 100_000 × 100 (RATE_SCALE) × 1_000 (m/km) = 10_000_000_000; ÷ 100_000 m = 100_000.
    expect(cost.costPerDistanceScaled).toBe(100_000);
    expect(formatRate(cost.costPerDistanceScaled, 'BDT')).toBe('BDT 10.0');
  });
  it('is not settled at 100 km (threshold 1_000_000 m)', () => {
    expect(SETTLED_DISTANCE_FOR_COST_PER_UNIT).toBe(1_000_000);
    expect(cost.costPerDistanceSettled).toBe(false);
  });
  it('the caveat names the tracked 100 km and the 1,000 km settling point', () => {
    const hint = costPerDistanceHint(100_000, SETTLED_DISTANCE_FOR_COST_PER_UNIT, 'km');
    expect(hint).toBe(
      'Based on 100 km so far, so one large purchase still moves it a lot. It settles around 1,000 km.',
    );
  });
  it('the caveat does NOT state the 900 km remaining (brief expected "900 km")', () => {
    const hint = costPerDistanceHint(100_000, SETTLED_DISTANCE_FOR_COST_PER_UNIT, 'km');
    expect(hint).not.toContain('900 km');
  });
  it('the caveat disappears at the threshold', () => {
    expect(costPerDistanceHint(1_000_000, SETTLED_DISTANCE_FOR_COST_PER_UNIT, 'km')).toBeNull();
  });
  it('breakdown: fuel 60_000, services 40_000, accessories 50_000, parts 0, other 0, total 150_000', () => {
    expect(cost.breakdown).toEqual({ fuel: 60_000, services: 40_000, parts: 0, accessories: 50_000, other: 0, total: 150_000 });
  });
  it('miles: BDT 10.00/km × 1.609344 = 16.09344/mi → scaled 160_934 (code rounds the mile to 1_609 m → 160_900)', () => {
    // Exact: 100_000 × 1_609.344 ÷ 1_000 = 160_934.4 → 160_934.
    // Code path: 100_000 × round(1609.344)=1_609 = 160_900_000 ÷ 1_000 = 160_900.
    expect(costPerDistance(100_000, 100_000, 'mi')).toBe(160_934);
  });
});

// ---------------------------------------------------------------------------
// 5. Opening odometer excluded from tracked distance
// ---------------------------------------------------------------------------

describe('MON-05 tracked distance is highest minus lowest, not the odometer face', () => {
  it('opening 4_845_000 m, fuel at 4_945_000 m → 100_000 m tracked', () => {
    const points = buildOdometerHistory({
      readings: [],
      fuelEntries: [fuel({ odometerMetres: 4_945_000 })],
      services: [],
      parts: [],
      bike: { initialOdometerMetres: 4_845_000, storedOdometerMetres: 4_945_000, createdAt: base.createdAt },
    });
    // 4_945_000 − 4_845_000 = 100_000.
    expect(totalDistanceMetres(points)).toBe(100_000);
    expect(totalDistanceMetres(points)).not.toBe(4_945_000);
  });
  it('a bike with an opening reading and no other record has 0 tracked distance', () => {
    const points = buildOdometerHistory({
      readings: [],
      fuelEntries: [],
      services: [],
      parts: [],
      bike: { initialOdometerMetres: 4_845_000, storedOdometerMetres: 4_845_000, createdAt: base.createdAt },
    });
    expect(totalDistanceMetres(points)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Zero distance
// ---------------------------------------------------------------------------

describe('MON-06 zero distance yields null, never 0', () => {
  it('calculateOwnershipCost with 0 m → costPerDistanceScaled null', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger: [line('fuel', 60_000)],
      distanceMetres: 0,
      distanceUnit: 'km',
    });
    expect(cost.costPerDistanceScaled).toBeNull();
    expect(cost.costPerDistanceScaled).not.toBe(0);
    expect(formatRate(cost.costPerDistanceScaled, 'BDT')).toBe('—');
  });
  it('negative distance also yields null', () => {
    expect(costPerDistance(60_000, -5, 'km')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. All-in (total) cost basis
// ---------------------------------------------------------------------------

describe('MON-07 purchase price enters only on the total basis', () => {
  const ledger = buildLedger(ledgerInput); // running 150_000; consumption 100_000

  it('running basis: headline 150_000, per-km scaled 100_000, totalOwnership 28_650_000 still reported', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: 28_500_000 },
      ledger,
      distanceMetres: 100_000,
      distanceUnit: 'km',
      costBasis: 'running',
    });
    // 28_500_000 + 150_000 = 28_650_000.
    expect(cost.totalOwnershipMinor).toBe(28_650_000);
    expect(cost.headlineCostMinor).toBe(150_000);
    expect(cost.costPerDistanceScaled).toBe(100_000);
  });
  it('default basis (omitted) is running', () => {
    const cost = calculateOwnershipCost({ bike: { purchasePriceMinor: 28_500_000 }, ledger, distanceMetres: 100_000, distanceUnit: 'km' });
    expect(cost.costBasis).toBe('running');
    expect(cost.headlineCostMinor).toBe(150_000);
  });
  it('total basis: headline 28_650_000; per-km = (100_000 + 28_500_000) ÷ 100 km → scaled 28_600_000', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: 28_500_000 },
      ledger,
      distanceMetres: 100_000,
      distanceUnit: 'km',
      costBasis: 'total',
    });
    expect(cost.headlineCostMinor).toBe(28_650_000);
    // 28_600_000 minor ÷ 100 km = 286_000 minor/km; × RATE_SCALE 100 = 28_600_000.
    expect(cost.costPerDistanceScaled).toBe(28_600_000);
    expect(formatRate(cost.costPerDistanceScaled, 'BDT')).toBe('BDT 2,860');
  });
  it('total basis with no purchase price falls back to running for headline and per-km', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger,
      distanceMetres: 100_000,
      distanceUnit: 'km',
      costBasis: 'total',
    });
    expect(cost.totalOwnershipMinor).toBeNull();
    expect(cost.headlineCostMinor).toBe(150_000);
    expect(cost.costPerDistanceScaled).toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// 8. Every ledger line appears once
// ---------------------------------------------------------------------------

describe('MON-08 one ledger line per cost, and none for carried or zero costs', () => {
  const ledger = buildLedger(ledgerInput);

  it('has exactly 3 lines: fuel, service, accessory', () => {
    expect(ledger).toHaveLength(3);
    expect(ledger.map((l) => l.source).sort()).toEqual(['accessory', 'fuel', 'service']);
  });
  it('the part linked to a service is absent; the zero-cost part is absent', () => {
    expect(ledger.find((l) => l.source === 'part')).toBeUndefined();
  });
  it('the accessory linked to a service is absent', () => {
    expect(ledger.find((l) => l.sourceId === 'a2')).toBeUndefined();
  });
  it('the derived expense is absent', () => {
    expect(ledger.find((l) => l.source === 'manual')).toBeUndefined();
  });
  it('total 150_000 and one month key 2026-09 = 150_000', () => {
    expect(totalMinor(ledger)).toBe(150_000);
    expect(monthlyTotals(ledger)).toEqual([{ key: '2026-09', totalMinor: 150_000 }]);
  });
  it('ids are unique and sorted newest first', () => {
    expect(new Set(ledger.map((l) => l.id)).size).toBe(3);
    expect(ledger.map((l) => l.date)).toEqual(['2026-09-08', '2026-09-05', '2026-09-02']);
  });
  it('a zero-cost SERVICE still produces a line (asymmetry with parts/accessories)', () => {
    const only = buildLedger({ ...ledgerInput, fuelEntries: [], accessories: [], parts: [], services: [service({ totalCostMinor: 0, labourCostMinor: 0, partsCostMinor: 0 })] });
    // Documented expectation from the brief: zero-cost record → no line.
    expect(only).toHaveLength(0);
  });
  it('a zero-cost FUEL entry still produces a line (asymmetry with parts/accessories)', () => {
    const only = buildLedger({ ...ledgerInput, services: [], accessories: [], parts: [], fuelEntries: [fuel({ totalCostMinor: 0, pricePerLitreMinor: 0 })] });
    expect(only).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Float operations on the money path — executed checks
// ---------------------------------------------------------------------------

describe('MON-09 float boundaries that touch stored money', () => {
  it('wire minorToMajor/majorToMinor round-trips a 2-dp amount: 130_505 poisha ↔ 1305.05', () => {
    expect(minorToMajor(130_505, 'BDT')).toBe(1305.05);
    expect(majorToMinor(1305.05, 'BDT')).toBe(130_505);
  });
  it('wire round-trips a 0-dp amount: 1_305 yen ↔ 1305', () => {
    expect(minorToMajor(1_305, 'JPY')).toBe(1305);
    expect(majorToMinor(1305, 'JPY')).toBe(1_305);
  });
  it('wire must round-trip a 3-dp amount: 1_305 fils ↔ 1.305 KWD (not 1.31 → 1_310)', () => {
    // 1_305 fils is 1.305 dinar exactly; storing it must give back 1_305.
    expect(minorToMajor(1_305, 'KWD')).toBe(1.305);
    expect(majorToMinor(minorToMajor(1_305, 'KWD'), 'KWD')).toBe(1_305);
  });
  it('wire must round-trip a 3-dp fuel price: 305 fils/L ↔ 0.305 KWD', () => {
    expect(majorToMinor(minorToMajor(305, 'KWD'), 'KWD')).toBe(305);
  });
  it('majorToMinor on the classic float trap: 0.1 + 0.2 major → 30 minor', () => {
    expect(majorToMinor(0.1 + 0.2, 'BDT')).toBe(30);
  });
  it('divideRound stays exact at realistic magnitudes: 28_650_000 × 100 × 1_000 ÷ 3 → 955_000_000_000', () => {
    // 2_865_000_000_000 ÷ 3 = 955_000_000_000 exactly.
    expect(divideRound(2_865_000_000_000, 3)).toBe(955_000_000_000);
  });
});

// ---------------------------------------------------------------------------
// 10. Mixed currencies
// ---------------------------------------------------------------------------

describe('MON-10 mixed currencies in one ledger', () => {
  it('buildLedger carries each record\'s own currency onto its line', () => {
    const ledger = buildLedger({
      ...ledgerInput,
      parts: [],
      accessories: [],
      expenses: [],
      fuelEntries: [fuel({ currency: 'USD', totalCostMinor: 5_000 })], // $50.00
      services: [service({ currency: 'BDT', totalCostMinor: 100_000 })], // BDT 1,000
    });
    expect(ledger.map((l) => [l.currency, l.amountMinor]).sort()).toEqual([['BDT', 100_000], ['USD', 5_000]]);
  });
  it('calculateOwnershipCost must not silently add BDT 1,000 and USD 50 into "105_000"', () => {
    const cost = calculateOwnershipCost({
      bike: { purchasePriceMinor: null },
      ledger: [line('service', 100_000, 'BDT', 'svc'), line('fuel', 5_000, 'USD', 'fuel-usd')],
      distanceMetres: 100_000,
      distanceUnit: 'km',
    });
    // 100_000 poisha + 5_000 cents summed as if one currency = 105_000. A
    // guarded implementation would either reject, or sum only the bike's currency.
    expect(cost.runningCostMinor).not.toBe(105_000);
  });
  it('totalMinor and breakdown likewise sum across currencies', () => {
    const lines = [line('service', 100_000, 'BDT', 'svc'), line('fuel', 5_000, 'USD', 'fuel-usd')];
    expect(totalMinor(lines)).not.toBe(105_000);
    expect(breakdown(lines).total).not.toBe(105_000);
  });
});

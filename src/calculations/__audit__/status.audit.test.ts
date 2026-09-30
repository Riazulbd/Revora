/**
 * QA audit — maintenance status, parts life, document status, safety,
 * certificate and attention (audit sections 6, 7, 8 calculation halves).
 *
 * Every expected value below is a literal computed by hand in a comment.
 * Nothing is derived by calling the module under test.
 */
import type {
  Accessory,
  Bike,
  Expense,
  FuelEntry,
  MaintenanceRule,
  Part,
  SafetyCheck,
  ServiceRecord,
  VaultDocument,
} from '@/types';
import { calculateMaintenanceStatus, DEFAULT_RULES } from '@/calculations/maintenance';
import { calculatePartLife } from '@/calculations/parts';
import { documentStatus } from '@/calculations/documents';
import { currentCondition } from '@/calculations/safety';
import { proofCertificate, type AttestedRecord } from '@/calculations/certificate';
import { attentionItems } from '@/calculations/attention';
import { analyseBike, type GarageData } from '@/calculations/analytics';
import { buildProofPackHtml } from '@/features/records/proofPack';

const TODAY = '2026-09-16';

// ---------------------------------------------------------------------------
// Fixtures — every required field present (src/types/index.ts)
// ---------------------------------------------------------------------------

const rule = (over: Partial<MaintenanceRule> = {}): MaintenanceRule => ({
  id: 'r1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Engine oil & filter',
  intervalMetres: 3_000_000,
  intervalDays: null,
  warnAheadMetres: 500_000,
  warnAheadDays: 14,
  enabled: true,
  lastCompletedMetres: 10_000_000,
  lastCompletedDate: null,
  notes: null,
  ...over,
});

const part = (over: Partial<Part> = {}): Part => ({
  id: 'p1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Rear tyre',
  installedOdometerMetres: 30_000_000,
  installedDate: '2026-01-10',
  expectedLifeMetres: 8_000_000,
  costMinor: 450_000,
  currency: 'BDT',
  fittedBy: null,
  linkedServiceId: null,
  removedDate: null,
  removedOdometerMetres: null,
  notes: null,
  clientRef: 'cr-p1',
  ...over,
});

const doc = (over: Partial<VaultDocument> = {}): VaultDocument => ({
  id: 'd1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  kind: 'tax_token',
  customKindLabel: null,
  title: 'Tax token',
  reference: 'TT-1',
  issuedOn: null,
  expiresOn: '2026-10-16',
  filePath: null,
  keepOfflineCopy: false,
  notes: null,
  clientRef: 'cr-d1',
  ...over,
});

const check = (over: Partial<SafetyCheck> = {}): SafetyCheck => ({
  id: 'c1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  area: 'brakes',
  date: '2026-03-02',
  status: 'action',
  summary: 'Front pads thin',
  measurements: null,
  note: null,
  photoPath: null,
  clientRef: 'cr-c1',
  ...over,
});

// ---------------------------------------------------------------------------
// 1. Maintenance boundaries
// ---------------------------------------------------------------------------

describe('1. maintenance boundaries — distance (interval 3_000_000 m, warnAhead 500_000 m)', () => {
  // dueAt = lastCompleted 10_000_000 + interval 3_000_000 = 13_000_000.
  // remaining = 13_000_000 - current, so current = 13_000_000 - remaining.
  const at = (remaining: number) => calculateMaintenanceStatus(rule(), 13_000_000 - remaining, TODAY);

  it('remaining -1 → overdue', () => {
    // current = 13_000_001; remaining = -1 < 0 → overdue
    const s = at(-1);
    expect(s.remainingMetres).toBe(-1);
    expect(s.kind).toBe('overdue');
  });

  it('remaining 0 → NOT overdue (code puts 0 on the due_soon side: remaining < 0 is overdue)', () => {
    // current = 13_000_000; remaining = 0; 0 < 0 false; 0 <= 500_000 → due_soon
    const s = at(0);
    expect(s.remainingMetres).toBe(0);
    expect(s.kind).not.toBe('overdue');
    expect(s.kind).toBe('due_soon');
  });

  it('remaining 500_000 (= warnAhead) → due_soon', () => {
    // 500_000 <= 500_000 → due_soon
    expect(at(500_000).kind).toBe('due_soon');
  });

  it('remaining 500_001 → upcoming', () => {
    // 500_001 > 500_000 and 500_001 <= 2 × 500_000 = 1_000_000 → upcoming
    expect(at(500_001).kind).toBe('upcoming');
  });

  it('remaining 1_000_000 (= 2 × warnAhead) → upcoming', () => {
    // 1_000_000 <= 1_000_000 → upcoming
    expect(at(1_000_000).kind).toBe('upcoming');
  });

  it('remaining 1_000_001 → good', () => {
    // 1_000_001 > 1_000_000 → good
    expect(at(1_000_001).kind).toBe('good');
  });
});

describe('1. maintenance boundaries — days (interval 180 d, warnAhead 14 d)', () => {
  // lastCompletedDate 2026-03-20 + 180 days: Mar 20→Mar 31 = 11, Apr 30, May 31,
  // Jun 30, Jul 31, Aug 31 → 11+30+31+30+31+31 = 164 → Sep 1 is day 164 + 1 = 165,
  // so day 180 is Sep 16. dueOnDate = 2026-09-16.
  const timeRule = rule({
    intervalMetres: null,
    intervalDays: 180,
    warnAheadDays: 14,
    lastCompletedMetres: null,
    lastCompletedDate: '2026-03-20',
  });

  it('projects the due date to 2026-09-16', () => {
    expect(calculateMaintenanceStatus(timeRule, null, '2026-09-01').dueOnDate).toBe('2026-09-16');
  });

  it('remaining -1 day (today 2026-09-17) → overdue', () => {
    const s = calculateMaintenanceStatus(timeRule, null, '2026-09-17');
    expect(s.remainingDays).toBe(-1);
    expect(s.kind).toBe('overdue');
  });

  it('remaining 0 days (today = due date) → due_soon, not overdue', () => {
    const s = calculateMaintenanceStatus(timeRule, null, '2026-09-16');
    expect(s.remainingDays).toBe(0);
    expect(s.kind).toBe('due_soon');
  });

  it('remaining 14 days (today 2026-09-02) → due_soon', () => {
    // 14 <= 14 → due_soon
    const s = calculateMaintenanceStatus(timeRule, null, '2026-09-02');
    expect(s.remainingDays).toBe(14);
    expect(s.kind).toBe('due_soon');
  });

  it('remaining 15 days (today 2026-09-01) → upcoming', () => {
    // 15 > 14, 15 <= 28 → upcoming
    const s = calculateMaintenanceStatus(timeRule, null, '2026-09-01');
    expect(s.remainingDays).toBe(15);
    expect(s.kind).toBe('upcoming');
  });

  it('remaining 28 days (today 2026-08-19) → upcoming', () => {
    // Aug 19 → Sep 16: Aug has 31 days → 31-19 = 12, + 16 = 28. 28 <= 28 → upcoming
    const s = calculateMaintenanceStatus(timeRule, null, '2026-08-19');
    expect(s.remainingDays).toBe(28);
    expect(s.kind).toBe('upcoming');
  });

  it('remaining 29 days (today 2026-08-18) → good', () => {
    const s = calculateMaintenanceStatus(timeRule, null, '2026-08-18');
    expect(s.remainingDays).toBe(29);
    expect(s.kind).toBe('good');
  });
});

describe('1. combined rule — most urgent wins', () => {
  it('distance good + time overdue → overdue', () => {
    // distance: dueAt 13_000_000, current 10_000_000 → remaining 3_000_000 > 1_000_000 → good
    // time: last 2026-01-01 + 30 d = 2026-01-31; today 2026-09-16 → remaining < 0 → overdue
    const combined = rule({
      intervalDays: 30,
      warnAheadDays: 5,
      lastCompletedDate: '2026-01-01',
    });
    const s = calculateMaintenanceStatus(combined, 10_000_000, TODAY);
    expect(s.remainingMetres).toBe(3_000_000);
    expect(s.dueOnDate).toBe('2026-01-31');
    // Jan 31 → Sep 16: Jan 31→Feb 28 = 28, Mar 31, Apr 30, May 31, Jun 30, Jul 31, Aug 31, Sep 16
    // = 28+31+30+31+30+31+31+16 = 228 → remainingDays = -228
    expect(s.remainingDays).toBe(-228);
    expect(s.kind).toBe('overdue');
  });

  it('distance overdue + time good → overdue (symmetric)', () => {
    // distance: current 13_000_001 → remaining -1 → overdue
    // time: last 2026-09-01 + 180 d → far off → good
    const combined = rule({ intervalDays: 180, warnAheadDays: 14, lastCompletedDate: '2026-09-01' });
    expect(calculateMaintenanceStatus(combined, 13_000_001, TODAY).kind).toBe('overdue');
  });
});

// ---------------------------------------------------------------------------
// 2. Day-one status for a used bike (seeding per useBikeMutations.ts:100-119)
// ---------------------------------------------------------------------------

describe('2. day-one status of the five starter rules on a used bike', () => {
  // Seeding (src/features/bikes/useBikeMutations.ts:100-119) sets
  // lastCompletedMetres = opening odometer and lastCompletedDate = today.
  const OPENING = 4_845_000;
  const seeded: MaintenanceRule[] = DEFAULT_RULES.map((t, i) => ({
    id: `seed-${i}`,
    userId: 'u1',
    bikeId: 'b1',
    createdAt: 1,
    updatedAt: 1,
    name: t.name,
    intervalMetres: t.intervalMetres,
    intervalDays: t.intervalDays,
    warnAheadMetres: t.warnAheadMetres,
    warnAheadDays: t.warnAheadDays,
    enabled: true,
    lastCompletedMetres: OPENING,
    lastCompletedDate: TODAY,
    notes: null,
  }));

  it('seeds exactly five rules', () => {
    expect(seeded).toHaveLength(5);
  });

  it('every seeded rule is good or upcoming — none overdue, due_soon or unknown', () => {
    const kinds = seeded.map((r) => calculateMaintenanceStatus(r, OPENING, TODAY).kind);
    for (const k of kinds) expect(['good', 'upcoming']).toContain(k);
  });

  it('each starter rule is exactly "good" (interval exceeds 2 × warnAhead on both axes)', () => {
    // Engine oil: 3_000_000 > 2×300_000 = 600_000; 180 > 2×14 = 28 → good
    // Chain:      500_000 > 2×100_000 = 200_000;   14 > 2×3 = 6    → good
    // Tyres:      1_000_000 > 2×200_000 = 400_000; 30 > 2×7 = 14   → good
    // Air filter: 6_000_000 > 2×500_000 = 1_000_000; 365 > 60      → good
    // Brakes:     8_000_000 > 2×800_000 = 1_600_000; 365 > 60      → good
    const statuses = seeded.map((r) => calculateMaintenanceStatus(r, OPENING, TODAY));
    expect(statuses.map((s) => s.kind)).toEqual(['good', 'good', 'good', 'good', 'good']);
    // Remaining equals the interval on day one.
    expect(statuses.map((s) => s.remainingMetres)).toEqual([3_000_000, 500_000, 1_000_000, 6_000_000, 8_000_000]);
    expect(statuses.map((s) => s.remainingDays)).toEqual([180, 14, 30, 365, 365]);
    // Due-at odometer = 4_845_000 + interval.
    expect(statuses.map((s) => s.dueAtMetres)).toEqual([7_845_000, 5_345_000, 5_845_000, 10_845_000, 12_845_000]);
  });
});

// ---------------------------------------------------------------------------
// 3. Never-completed rule
// ---------------------------------------------------------------------------

describe('3. never-completed rule', () => {
  const fresh = rule({ lastCompletedMetres: null, lastCompletedDate: null, intervalDays: 180 });

  it('with no odometer → unknown and every figure null', () => {
    const s = calculateMaintenanceStatus(fresh, null, TODAY);
    expect(s.kind).toBe('unknown');
    expect(s.neverCompleted).toBe(true);
    expect(s.dueAtMetres).toBeNull();
    expect(s.remainingMetres).toBeNull();
    expect(s.dueOnDate).toBeNull();
    expect(s.remainingDays).toBeNull();
  });

  it('even with an odometer → still unknown (no completion to project from)', () => {
    const s = calculateMaintenanceStatus(fresh, 12_000_000, TODAY);
    expect(s.kind).toBe('unknown');
    expect(s.dueAtMetres).toBeNull();
    expect(s.remainingMetres).toBeNull();
  });

  it('completed rule but no odometer → distance side unknown, no fabricated remaining', () => {
    // distance-only rule, lastCompletedMetres set, odometer null → nothing can be measured
    const s = calculateMaintenanceStatus(rule(), null, TODAY);
    expect(s.kind).toBe('unknown');
    expect(s.dueAtMetres).toBe(13_000_000); // 10_000_000 + 3_000_000 is a projection, not a status
    expect(s.remainingMetres).toBeNull();
    expect(s.neverCompleted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Parts life
// ---------------------------------------------------------------------------

describe('4. parts life (fitted 30_000_000, expected 8_000_000)', () => {
  it('current 34_000_000 → used 4_000_000, remaining 4_000_000, 50%', () => {
    // used = 34_000_000 - 30_000_000 = 4_000_000
    // remaining = 8_000_000 - 4_000_000 = 4_000_000 → 4_000_000 / 8_000_000 = 50%
    const life = calculatePartLife(part(), 34_000_000);
    expect(life.usedMetres).toBe(4_000_000);
    expect(life.remainingMetres).toBe(4_000_000);
    expect(life.remainingPercent).toBe(50);
    expect(life.overdueMetres).toBe(0);
    expect(life.isOverdue).toBe(false);
    expect(life.isRemoved).toBe(false);
    expect(life.actualLifeMetres).toBeNull();
  });

  it('current 38_000_000 → 0% remaining, overdue 0, not overdue (boundary)', () => {
    // used = 8_000_000; remaining = 0; 0 < 0 false → not overdue; 0/8_000_000 = 0%
    const life = calculatePartLife(part(), 38_000_000);
    expect(life.usedMetres).toBe(8_000_000);
    expect(life.remainingMetres).toBe(0);
    expect(life.remainingPercent).toBe(0);
    expect(life.overdueMetres).toBe(0);
    expect(life.isOverdue).toBe(false);
  });

  it('current 38_000_001 → overdueMetres 1, isOverdue, remaining 0 (never negative), 0%', () => {
    // used = 8_000_001; raw remaining = -1 → overdue by 1
    const life = calculatePartLife(part(), 38_000_001);
    expect(life.usedMetres).toBe(8_000_001);
    expect(life.overdueMetres).toBe(1);
    expect(life.isOverdue).toBe(true);
    expect(life.remainingMetres).toBe(0);
    expect(life.remainingPercent).toBe(0);
  });

  it('expectedLife null → remainingPercent null (not 0), remaining null, not overdue', () => {
    const life = calculatePartLife(part({ expectedLifeMetres: null }), 34_000_000);
    expect(life.usedMetres).toBe(4_000_000);
    expect(life.remainingPercent).toBeNull();
    expect(life.remainingMetres).toBeNull();
    expect(life.overdueMetres).toBe(0);
    expect(life.isOverdue).toBe(false);
  });

  it('removed at 33_000_000 with current 40_000_000 → used frozen at 3_000_000', () => {
    // used = removed 33_000_000 - fitted 30_000_000 = 3_000_000 (current 40_000_000 ignored)
    // remaining = 8_000_000 - 3_000_000 = 5_000_000 → 62.5% → rounds to 63
    const life = calculatePartLife(
      part({ removedOdometerMetres: 33_000_000, removedDate: '2026-06-01' }),
      40_000_000,
    );
    expect(life.usedMetres).toBe(3_000_000);
    expect(life.isRemoved).toBe(true);
    expect(life.actualLifeMetres).toBe(3_000_000);
    expect(life.removedDate).toBe('2026-06-01');
    expect(life.remainingMetres).toBe(5_000_000);
    expect(life.remainingPercent).toBe(63);
    expect(life.isOverdue).toBe(false);
  });

  it('no odometer at all → used 0 (fitted reading stands in), 100%', () => {
    // end = installed 30_000_000 → used 0 → remaining 8_000_000 → 100%
    const life = calculatePartLife(part(), null);
    expect(life.usedMetres).toBe(0);
    expect(life.remainingPercent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 5. Document status (today 2026-09-16)
// ---------------------------------------------------------------------------

describe('5. document status with today = 2026-09-16', () => {
  it('expiresOn 2026-09-15 → expired', () => {
    // daysBetween(09-16, 09-15) = -1 < 0 → expired
    expect(documentStatus(doc({ expiresOn: '2026-09-15' }), TODAY)).toBe('expired');
  });

  it('expiresOn 2026-09-16 (today) → expiring (code treats the expiry day as still valid-but-expiring)', () => {
    // days = 0; 0 < 0 false; 0 <= 30 → expiring
    expect(documentStatus(doc({ expiresOn: '2026-09-16' }), TODAY)).toBe('expiring');
  });

  it('expiresOn 2026-10-16 (30 days) → expiring', () => {
    // Sep 16 → Oct 16: Sep has 30 days → 30-16 = 14, + 16 = 30. 30 <= 30 → expiring
    expect(documentStatus(doc({ expiresOn: '2026-10-16' }), TODAY)).toBe('expiring');
  });

  it('expiresOn 2026-10-17 (31 days) → valid', () => {
    expect(documentStatus(doc({ expiresOn: '2026-10-17' }), TODAY)).toBe('valid');
  });

  it('expiresOn null → no_expiry', () => {
    expect(documentStatus(doc({ expiresOn: null }), TODAY)).toBe('no_expiry');
  });
});

// ---------------------------------------------------------------------------
// 6. Safety
// ---------------------------------------------------------------------------

describe('6. safety — current condition', () => {
  it('brakes action 2026-03-02 then ok 2026-08-20 → ok', () => {
    const states = currentCondition([
      check({ id: 'c1', area: 'brakes', date: '2026-03-02', status: 'action' }),
      check({ id: 'c2', area: 'brakes', date: '2026-08-20', status: 'ok' }),
    ]);
    const brakes = states.find((s) => s.area === 'brakes');
    expect(brakes?.status).toBe('ok');
    expect(brakes?.latest?.id).toBe('c2');
  });

  it('input order does not matter — newest wins even when handed over first', () => {
    const states = currentCondition([
      check({ id: 'c2', area: 'brakes', date: '2026-08-20', status: 'ok' }),
      check({ id: 'c1', area: 'brakes', date: '2026-03-02', status: 'action' }),
    ]);
    expect(states.find((s) => s.area === 'brakes')?.status).toBe('ok');
  });

  it('areas never checked → status null and latest null (never "ok")', () => {
    const states = currentCondition([check({ id: 'c1', area: 'brakes', status: 'ok' })]);
    for (const area of ['tyres', 'chain', 'battery', 'lights'] as const) {
      const s = states.find((x) => x.area === area);
      expect(s?.status).toBeNull();
      expect(s?.latest).toBeNull();
    }
    expect(states).toHaveLength(5);
  });

  it('orders action → watch → ok → null', () => {
    const states = currentCondition([
      check({ id: 'a', area: 'lights', date: '2026-09-01', status: 'ok' }),
      check({ id: 'b', area: 'battery', date: '2026-09-01', status: 'action' }),
      check({ id: 'c', area: 'tyres', date: '2026-09-01', status: 'watch' }),
    ]);
    expect(states.map((s) => s.status)).toEqual(['action', 'watch', 'ok', null, null]);
    expect(states.map((s) => s.area)).toEqual(['battery', 'tyres', 'lights', 'chain', 'brakes']);
  });
});

// ---------------------------------------------------------------------------
// 7. Certificate
// ---------------------------------------------------------------------------

const attested: AttestedRecord[] = [
  { kind: 'service', id: 's1', date: '2026-03-04', figure: 180_000 },
  { kind: 'fuel', id: 'f1', date: '2026-08-20', figure: 4_845_000 },
  { kind: 'part', id: 'p1', date: '2026-01-10', figure: 30_000_000 },
  { kind: 'document', id: 'd1', date: '2026-10-16', figure: null },
];

const HEX_REF = /^[0-9A-F]{4}-[0-9A-F]{4}$/;

describe('7. proof certificate — pure function', () => {
  it('has the 8-hex A1B2-C3D4 format', () => {
    expect(proofCertificate(attested).reference).toMatch(HEX_REF);
  });

  it('empty set → FNV-1a 32-bit offset basis 0x811C9DC5 → "811C-9DC5", 0 records, null dates', () => {
    // FNV-1a over the empty string is the offset basis itself: 0x811c9dc5.
    const c = proofCertificate([]);
    expect(c.reference).toBe('811C-9DC5');
    expect(c.recordCount).toBe(0);
    expect(c.firstDate).toBeNull();
    expect(c.lastDate).toBeNull();
  });

  it('is identical across two calls, and independent of input order', () => {
    const a = proofCertificate(attested);
    const b = proofCertificate(attested);
    const c = proofCertificate([...attested].reverse());
    expect(a).toEqual(b);
    expect(a.reference).toBe(c.reference);
    expect(a.recordCount).toBe(4);
    expect(a.firstDate).toBe('2026-01-10');
    expect(a.lastDate).toBe('2026-10-16');
  });

  it('changes when a figure changes', () => {
    const edited = attested.map((r) => (r.id === 's1' ? { ...r, figure: 180_001 } : r));
    expect(proofCertificate(edited).reference).not.toBe(proofCertificate(attested).reference);
  });

  it('changes when a date changes', () => {
    const edited = attested.map((r) => (r.id === 'f1' ? { ...r, date: '2026-08-21' } : r));
    expect(proofCertificate(edited).reference).not.toBe(proofCertificate(attested).reference);
  });

  it('changes when an id changes', () => {
    const edited = attested.map((r) => (r.id === 'p1' ? { ...r, id: 'p2' } : r));
    expect(proofCertificate(edited).reference).not.toBe(proofCertificate(attested).reference);
  });

  it('changes when a record is added or dropped', () => {
    const base = proofCertificate(attested).reference;
    expect(proofCertificate(attested.slice(1)).reference).not.toBe(base);
    expect(
      proofCertificate([...attested, { kind: 'fuel', id: 'f2', date: '2026-08-30', figure: 5_180_000 }]).reference,
    ).not.toBe(base);
  });

  it('same id in a different table is a different record', () => {
    const a = proofCertificate([{ kind: 'service', id: 'x', date: null, figure: null }]).reference;
    const b = proofCertificate([{ kind: 'part', id: 'x', date: null, figure: null }]).reference;
    expect(a).not.toBe(b);
  });
});

// --- Certificate through the real Proof Pack builder (features/records/proofPack.ts)

const units = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l', costBasis: 'running' } as const;

const bike: Bike = {
  id: 'b1', userId: 'u1', createdAt: 1, updatedAt: 1,
  manufacturer: 'Yamaha', model: 'FZS', nickname: 'FZS',
  year: 2024, tankCapacityMl: 13_000, purchasePriceMinor: 28_500_000,
  purchaseDate: '2024-11-02', engineNumber: null, chassisNumber: null, photoPath: null,
  currency: 'BDT', initialOdometerMetres: 3_900_000, storedOdometerMetres: 4_000_000,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 }, archivedAt: null,
};

const fuel = (id: string, metres: number, date: string): FuelEntry => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1, date,
  odometerMetres: metres, litresMl: 10_000, pricePerLitreMinor: 14_500,
  totalCostMinor: 145_000, currency: 'BDT', fillType: 'full',
  missedPreviousFill: false, station: null, notes: null, receiptPath: null, clientRef: 'r' + id,
});

const service = (id: string, date: string, metres: number, minor: number): ServiceRecord => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1, date, title: 'Service',
  workshop: 'Shop', selfService: false, odometerMetres: metres, totalCostMinor: minor,
  labourCostMinor: 0, partsCostMinor: minor, itemsSummary: null, estimate: null,
  currency: 'BDT', notes: null, receiptPaths: [], completedRuleIds: [], clientRef: 'r' + id,
});

const accessory: Accessory = {
  id: 'a1', userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  name: 'Phone mount', purchaseCostMinor: 120_000, installationCostMinor: 0,
  currency: 'BDT', date: '2026-05-05', notes: null, photoPath: null, linkedServiceId: null, clientRef: 'ra1',
};

const expense: Expense = {
  id: 'e1', userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  amountMinor: 50_000, currency: 'BDT', category: 'parking', derived: false,
  linkedRuleId: null, date: '2026-06-06', note: null, clientRef: 're1',
};

const garage: GarageData = {
  bike,
  fuelEntries: [fuel('f1', 4_845_000, '2026-08-20'), fuel('f2', 5_180_000, '2026-08-30')],
  fuelAdjustments: [], odometerReadings: [], rules: [],
  services: [service('s1', '2026-03-04', 4_200_000, 180_000)],
  parts: [part()], accessories: [], expenses: [], units, today: TODAY,
};

const packReference = (over: Partial<GarageData> = {}, documents: VaultDocument[] = []) => {
  const data = { ...garage, ...over };
  const markup = buildProofPackHtml({
    bike: data.bike,
    analytics: analyseBike(data),
    documents,
    options: { buyerSafe: false, consentGiven: true },
  });
  return /([0-9A-F]{4}-[0-9A-F]{4})/.exec(markup)?.[1] ?? null;
};

describe('7. proof certificate — via the Proof Pack certified set', () => {
  it('prints a reference in the 8-hex format', () => {
    expect(packReference()).toMatch(HEX_REF);
  });

  it('adding an accessory leaves the reference unchanged (accessories are not printed, so not certified)', () => {
    expect(packReference({ accessories: [accessory] })).toBe(packReference());
  });

  it('adding an expense leaves the reference unchanged (expenses are not printed, so not certified)', () => {
    expect(packReference({ expenses: [expense] })).toBe(packReference());
  });

  it('changing a printed service cost changes the reference', () => {
    expect(packReference({ services: [service('s1', '2026-03-04', 4_200_000, 180_001)] })).not.toBe(packReference());
  });

  it('changing a printed part\'s fitted odometer changes the reference', () => {
    expect(packReference({ parts: [part({ installedOdometerMetres: 30_000_001 })] })).not.toBe(packReference());
  });

  it('adding a document changes the reference', () => {
    expect(packReference({}, [doc()])).not.toBe(packReference());
  });

  it('a 41st fill older than the printed 40 does not move the reference; a newer one does', () => {
    // 40 fills dated 2026-03-01..03-28 then 2026-04-01..04-12, odometer 4_100_000 + 10_000·i.
    // The pack prints the newest 40 (fuel.entries is newest-first), so an extra fill that is
    // older than all of them falls outside the certified set, and one newer than all of them
    // enters it and pushes the oldest printed fill out.
    const dated = Array.from({ length: 40 }, (_, i) =>
      fuel(
        `f${i + 1}`,
        4_100_000 + 10_000 * i,
        i < 28 ? `2026-03-${String(i + 1).padStart(2, '0')}` : `2026-04-${String(i - 27).padStart(2, '0')}`,
      ),
    );
    const withForty = packReference({ fuelEntries: dated });
    const extraOldest = fuel('f0', 4_090_000, '2026-02-01');
    const extraNewest = fuel('f41', 4_500_000, '2026-05-01');
    expect(packReference({ fuelEntries: [extraOldest, ...dated] })).toBe(withForty);
    expect(packReference({ fuelEntries: [...dated, extraNewest] })).not.toBe(withForty);
  });
});

// ---------------------------------------------------------------------------
// 8. Attention
// ---------------------------------------------------------------------------

describe('8. attention', () => {
  const overdueRule = {
    rule: { id: 'r-over', name: 'Engine oil & filter', intervalMetres: 3_000_000 },
    status: calculateMaintenanceStatus(rule(), 13_000_001, TODAY), // remaining -1 → overdue
  };
  const goodRule = {
    rule: { id: 'r-good', name: 'Air filter', intervalMetres: 6_000_000 },
    status: calculateMaintenanceStatus(rule(), 10_000_000, TODAY), // remaining 3_000_000 → good
  };

  it('expired document → critical', () => {
    const items = attentionItems({
      rules: [],
      documents: [doc({ id: 'd-exp', expiresOn: '2026-09-15' })],
      safetyChecks: [],
      distanceUnit: 'km',
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('critical');
    expect(items[0]?.kind).toBe('document');
    expect(items[0]?.id).toBe('doc:d-exp');
  });

  it('expiring document → warning', () => {
    const items = attentionItems({
      rules: [],
      documents: [doc({ id: 'd-soon', expiresOn: '2026-10-16' })], // 30 days → expiring
      safetyChecks: [],
      distanceUnit: 'km',
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('warning');
    expect(items[0]?.title).toBe('Tax token expires in 30 days');
  });

  it('document expiring today → warning (not critical), titled "expires today"', () => {
    const items = attentionItems({
      rules: [],
      documents: [doc({ id: 'd-today', expiresOn: TODAY })],
      safetyChecks: [],
      distanceUnit: 'km',
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('warning');
    expect(items[0]?.title).toBe('Tax token expires today');
  });

  it('valid and no-expiry documents produce nothing', () => {
    const items = attentionItems({
      rules: [],
      documents: [doc({ id: 'ok', expiresOn: '2026-10-17' }), doc({ id: 'none', expiresOn: null })],
      safetyChecks: [],
      distanceUnit: 'km',
      today: TODAY,
    });
    expect(items).toHaveLength(0);
  });

  it('overdue rule → critical with a Mark done action; good rule is silent', () => {
    const items = attentionItems({
      rules: [goodRule, overdueRule],
      documents: [],
      safetyChecks: [],
      distanceUnit: 'km',
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('critical');
    expect(items[0]?.kind).toBe('maintenance');
    expect(items[0]?.id).toBe('rule:r-over');
    expect(items[0]?.action).toEqual({ label: 'Mark done', ruleId: 'r-over' });
    // -1 m → round(1/1000) = 0 km past; interval 3_000_000 → "3,000 km"
    expect(items[0]?.detail).toBe('0 km past · rule every 3,000 km');
  });

  it('due_soon rule is NOT an attention item', () => {
    const dueSoon = {
      rule: { id: 'r-ds', name: 'Chain', intervalMetres: 3_000_000 },
      status: calculateMaintenanceStatus(rule(), 13_000_000, TODAY), // remaining 0 → due_soon
    };
    expect(attentionItems({ rules: [dueSoon], documents: [], safetyChecks: [], distanceUnit: 'km', today: TODAY })).toHaveLength(0);
  });

  it('safety action superseded by a later ok does not appear', () => {
    const items = attentionItems({
      rules: [],
      documents: [],
      safetyChecks: [
        check({ id: 'c1', area: 'brakes', date: '2026-03-02', status: 'action' }),
        check({ id: 'c2', area: 'brakes', date: '2026-08-20', status: 'ok' }),
      ],
      distanceUnit: 'km',
      today: TODAY,
    });
    expect(items).toHaveLength(0);
  });

  it('orders critical before warning, then safety → document → maintenance', () => {
    const items = attentionItems({
      rules: [overdueRule],
      documents: [
        doc({ id: 'd-soon', expiresOn: '2026-10-16' }), // warning
        doc({ id: 'd-exp', expiresOn: '2026-09-15' }), // critical
      ],
      safetyChecks: [check({ id: 'c-act', area: 'tyres', date: '2026-09-10', status: 'action' })],
      distanceUnit: 'km',
      today: TODAY,
    });
    expect(items.map((i) => `${i.severity}/${i.kind}`)).toEqual([
      'critical/safety',
      'critical/document',
      'critical/maintenance',
      'warning/document',
    ]);
    expect(items.map((i) => i.id)).toEqual(['safety:c-act', 'doc:d-exp', 'rule:r-over', 'doc:d-soon']);
  });
});

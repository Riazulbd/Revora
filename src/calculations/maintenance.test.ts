import type { MaintenanceRule } from '@/types';
import { calculateMaintenanceStatus, compareByUrgency, countByStatus } from './maintenance';

const rule = (over: Partial<MaintenanceRule> = {}): MaintenanceRule => ({
  id: 'r1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Engine oil & filter',
  intervalMetres: 3_000_000, // 3,000 km
  intervalDays: null,
  warnAheadMetres: 300_000, // 300 km
  warnAheadDays: 14,
  enabled: true,
  lastCompletedMetres: 5_000_000,
  lastCompletedDate: '2026-08-01',
  notes: null,
  ...over,
});

describe('distance-based rules', () => {
  it('is good when a long way off', () => {
    const s = calculateMaintenanceStatus(rule(), 5_500_000, '2026-09-01');
    expect(s.dueAtMetres).toBe(8_000_000);
    expect(s.remainingMetres).toBe(2_500_000);
    expect(s.kind).toBe('good');
  });

  it('is upcoming inside twice the warn-ahead window', () => {
    expect(calculateMaintenanceStatus(rule(), 7_500_000, '2026-09-01').kind).toBe('upcoming');
  });

  it('is due soon inside the warn-ahead window', () => {
    expect(calculateMaintenanceStatus(rule(), 7_800_000, '2026-09-01').kind).toBe('due_soon');
  });

  it('is due soon exactly at the warn-ahead boundary', () => {
    expect(calculateMaintenanceStatus(rule(), 7_700_000, '2026-09-01').kind).toBe('due_soon');
  });

  it('is overdue past the due point, and reports how far past', () => {
    const s = calculateMaintenanceStatus(rule(), 9_250_000, '2026-09-01');
    expect(s.kind).toBe('overdue');
    expect(s.remainingMetres).toBe(-1_250_000);
  });

  it('is unknown when the odometer has never been read', () => {
    expect(calculateMaintenanceStatus(rule(), null, '2026-09-01').kind).toBe('unknown');
  });

  it('is unknown when the rule has never been completed', () => {
    const s = calculateMaintenanceStatus(
      rule({ lastCompletedMetres: null, lastCompletedDate: null }),
      5_500_000,
      '2026-09-01',
    );
    expect(s.kind).toBe('unknown');
    expect(s.neverCompleted).toBe(true);
  });
});

describe('time-based rules', () => {
  const timeRule = rule({
    intervalMetres: null,
    intervalDays: 30,
    warnAheadDays: 7,
    lastCompletedDate: '2026-08-01',
    lastCompletedMetres: null,
  });

  it('counts down in days', () => {
    const s = calculateMaintenanceStatus(timeRule, 5_500_000, '2026-08-10');
    expect(s.dueOnDate).toBe('2026-08-31');
    expect(s.remainingDays).toBe(21);
    expect(s.kind).toBe('good');
  });

  it('is due soon inside the warn-ahead days', () => {
    expect(calculateMaintenanceStatus(timeRule, null, '2026-08-28').kind).toBe('due_soon');
  });

  it('is overdue after the due date', () => {
    const s = calculateMaintenanceStatus(timeRule, null, '2026-09-05');
    expect(s.kind).toBe('overdue');
    expect(s.remainingDays).toBe(-5);
  });
});

describe('rules with both a distance and a time interval', () => {
  const both = rule({
    intervalMetres: 3_000_000,
    intervalDays: 30,
    warnAheadMetres: 300_000,
    warnAheadDays: 7,
    lastCompletedMetres: 5_000_000,
    lastCompletedDate: '2026-08-01',
  });

  it('reports whichever side is more urgent', () => {
    // Distance is fine (2,500 km to run) but the date has passed.
    const s = calculateMaintenanceStatus(both, 5_500_000, '2026-09-05');
    expect(s.kind).toBe('overdue');
    expect(s.remainingMetres).toBe(2_500_000);
    expect(s.remainingDays).toBe(-5);
  });

  it('reports distance urgency when the date is comfortable', () => {
    const s = calculateMaintenanceStatus(both, 7_900_000, '2026-08-05');
    expect(s.kind).toBe('due_soon');
  });
});

describe('aggregation', () => {
  it('counts by status', () => {
    const statuses = [
      calculateMaintenanceStatus(rule(), 9_000_000, '2026-09-01'), // overdue
      calculateMaintenanceStatus(rule(), 7_900_000, '2026-09-01'), // due soon
      calculateMaintenanceStatus(rule(), 5_500_000, '2026-09-01'), // good
    ];
    expect(countByStatus(statuses)).toEqual({
      overdue: 1,
      due_soon: 1,
      upcoming: 0,
      good: 1,
      unknown: 0,
    });
  });

  it('sorts the most urgent rule first', () => {
    const good = { rule: rule({ name: 'A' }), status: calculateMaintenanceStatus(rule(), 5_500_000, '2026-09-01') };
    const overdue = { rule: rule({ name: 'B' }), status: calculateMaintenanceStatus(rule(), 9_000_000, '2026-09-01') };
    expect([good, overdue].sort(compareByUrgency)[0]!.rule.name).toBe('B');
  });
});

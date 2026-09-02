import type { Part } from '@/types';
import { calculatePartLife, isPartActive, partHealth } from './parts';

const part = (over: Partial<Part> = {}): Part => ({
  id: 'p1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Yongli front brake pads',
  installedOdometerMetres: 5_050_000,
  installedDate: '2026-08-24',
  expectedLifeMetres: 8_000_000,
  costMinor: 190_000,
  currency: 'BDT',
  fittedBy: null,
  linkedServiceId: null,
  removedDate: null,
  removedOdometerMetres: null,
  notes: null,
  clientRef: 'r1',
  ...over,
});

describe('part life', () => {
  it('measures distance used from the fitting odometer', () => {
    const life = calculatePartLife(part(), 5_180_000);
    expect(life.usedMetres).toBe(130_000);
    expect(life.remainingMetres).toBe(7_870_000);
    expect(life.remainingPercent).toBe(98);
    expect(life.isOverdue).toBe(false);
  });

  it('reports an exceeded part as overdue by a positive distance, never as negative remaining', () => {
    const life = calculatePartLife(part(), 14_300_000);
    expect(life.isOverdue).toBe(true);
    expect(life.overdueMetres).toBe(1_250_000); // OVERDUE BY 1,250 km
    expect(life.remainingMetres).toBe(0); // and never -1,250 km
    expect(life.remainingPercent).toBe(0);
  });

  it('handles a part with no expected life', () => {
    const life = calculatePartLife(part({ expectedLifeMetres: null }), 5_180_000);
    expect(life.remainingMetres).toBeNull();
    expect(life.remainingPercent).toBeNull();
    expect(life.isOverdue).toBe(false);
    expect(partHealth(life)).toBe('unknown');
  });

  it('freezes usage at the removal reading once a part comes off', () => {
    const removed = part({ removedOdometerMetres: 5_500_000, removedDate: '2026-09-01' });
    const life = calculatePartLife(removed, 9_000_000);
    expect(life.usedMetres).toBe(450_000);
    expect(life.actualLifeMetres).toBe(450_000);
    expect(life.isRemoved).toBe(true);
    expect(isPartActive(removed)).toBe(false);
  });

  it('never reports negative usage when the odometer is unknown', () => {
    const life = calculatePartLife(part(), null);
    expect(life.usedMetres).toBe(0);
  });

  it('never reports negative usage from a lower odometer reading', () => {
    expect(calculatePartLife(part(), 4_000_000).usedMetres).toBe(0);
  });

  it('warns when a part is nearly worn out', () => {
    expect(partHealth(calculatePartLife(part(), 12_500_000))).toBe('warn');
    expect(partHealth(calculatePartLife(part(), 5_180_000))).toBe('good');
    expect(partHealth(calculatePartLife(part(), 20_000_000))).toBe('bad');
  });
});

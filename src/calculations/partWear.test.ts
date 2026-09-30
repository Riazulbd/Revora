import type { Part } from '@/types';
import { calculatePartLife } from './parts';
import { partUsedFraction, partUsedPercent } from './partWear';

const part = (over: Partial<Part> = {}): Part => ({
  id: 'p1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Chain & sprocket set',
  installedOdometerMetres: 33_010_000,
  installedDate: '2026-07-02',
  expectedLifeMetres: 2_000_000,
  costMinor: 385_000,
  currency: 'BDT',
  fittedBy: null,
  linkedServiceId: null,
  removedDate: null,
  removedOdometerMetres: null,
  notes: null,
  clientRef: 'r1',
  ...over,
});

describe('part wear', () => {
  it('reports the board figure: 1,702 km of a 2,000 km life is 85% used', () => {
    const life = calculatePartLife(part(), 34_712_000);
    expect(partUsedPercent(life)).toBe(85);
    expect(partUsedFraction(life)).toBeCloseTo(0.85);
  });

  it('is the complement of the remaining percentage, so bar and figure agree', () => {
    const life = calculatePartLife(
      part({ installedOdometerMetres: 34_650_000, expectedLifeMetres: 8_000_000 }),
      34_712_000,
    );
    expect(life.remainingPercent).toBe(99);
    expect(partUsedPercent(life)).toBe(1); // "1% used" on the board
  });

  it('is null — not zero — when no expected life was recorded', () => {
    const life = calculatePartLife(part({ expectedLifeMetres: null }), 34_712_000);
    expect(partUsedPercent(life)).toBeNull();
    expect(partUsedFraction(life)).toBeNull();
  });

  it('stops at 100 for an overdue part rather than running past the bar', () => {
    const life = calculatePartLife(part(), 40_000_000);
    expect(life.isOverdue).toBe(true);
    expect(partUsedPercent(life)).toBe(100);
    expect(partUsedFraction(life)).toBe(1);
  });

  it('is 0 the moment a part is fitted', () => {
    const life = calculatePartLife(part(), 33_010_000);
    expect(partUsedPercent(life)).toBe(0);
  });
});

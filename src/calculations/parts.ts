import type { IsoDate, Part } from '@/types';

/**
 * Part lifespan.
 *
 * A part past its expected life is reported as OVERDUE BY n, never as a negative
 * remaining distance (requirement 26).
 */

export type PartLife = {
  /** Distance the part has run, in metres. */
  usedMetres: number;
  /** Metres left before the expected life is reached; null when no life is set. */
  remainingMetres: number | null;
  /** Metres past the expected life. Zero unless overdue. */
  overdueMetres: number;
  /** 0–100, clamped. Null when no expected life is set. */
  remainingPercent: number | null;
  isOverdue: boolean;
  /** True once the part has been taken off the bike. */
  isRemoved: boolean;
  /** For removed parts: how long the part actually lasted, in metres. */
  actualLifeMetres: number | null;
  removedDate: IsoDate | null;
};

export function calculatePartLife(part: Part, currentOdometerMetres: number | null): PartLife {
  const isRemoved = part.removedOdometerMetres !== null;

  const endMetres = isRemoved
    ? part.removedOdometerMetres!
    : (currentOdometerMetres ?? part.installedOdometerMetres);

  const usedMetres = Math.max(0, endMetres - part.installedOdometerMetres);
  const expected = part.expectedLifeMetres;

  if (expected === null || expected <= 0) {
    return {
      usedMetres,
      remainingMetres: null,
      overdueMetres: 0,
      remainingPercent: null,
      isOverdue: false,
      isRemoved,
      actualLifeMetres: isRemoved ? usedMetres : null,
      removedDate: part.removedDate,
    };
  }

  const rawRemaining = expected - usedMetres;
  const isOverdue = rawRemaining < 0;

  return {
    usedMetres,
    remainingMetres: Math.max(0, rawRemaining),
    overdueMetres: isOverdue ? -rawRemaining : 0,
    remainingPercent: Math.max(0, Math.min(100, Math.round((rawRemaining / expected) * 100))),
    isOverdue,
    isRemoved,
    actualLifeMetres: isRemoved ? usedMetres : null,
    removedDate: part.removedDate,
  };
}

/** Health colour band a part sits in, used to pick the design's status colour. */
export type PartHealth = 'good' | 'warn' | 'bad' | 'unknown';

export function partHealth(life: PartLife): PartHealth {
  if (life.isOverdue) return 'bad';
  if (life.remainingPercent === null) return 'unknown';
  if (life.remainingPercent <= 15) return 'warn';
  return 'good';
}

export function isPartActive(part: Part): boolean {
  return part.removedOdometerMetres === null && part.removedDate === null;
}

/** The odometer a part is expected to reach the end of its life at; null without an expected life. */
export function partExpectedEndMetres(part: Pick<Part, 'installedOdometerMetres' | 'expectedLifeMetres'>): number | null {
  if (part.expectedLifeMetres === null || part.expectedLifeMetres <= 0) return null;
  return part.installedOdometerMetres + part.expectedLifeMetres;
}

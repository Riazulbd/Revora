import type { Bike } from '@/types';
import { dateToIso, monthKey } from '@/utils/date';

/**
 * The garage list, as the Garage tab draws it.
 *
 * The board shows every motorcycle a rider owns on one screen — the one in use,
 * the ones a tap away, and the ones they have sold but kept the records for —
 * with an odometer and a tank beside each. Working that ordering and those
 * figures out in the screen would put business logic in a component, so it
 * lives here.
 *
 * The odometer needs a word. A bike's current reading is *derived* from its
 * reading history, and `analyseBike()` only ever runs for the active
 * motorcycle: loading nine collections for every bike in the garage to print
 * one line would be absurd. For the others the best figure available without
 * that history is the larger of the opening reading and the figure the shared
 * schema stores — which is exactly what `analyseBike` itself folds in as two
 * more candidate readings, so the two can never contradict each other. It can
 * only ever be an under-estimate, never an invention, and when neither figure
 * exists the caller gets `null` and the screen prints `—` rather than `0`.
 */

export type GarageBikeStatus = 'active' | 'other' | 'archived';

export type GarageBikeSummary = {
  id: string;
  nickname: string;
  status: GarageBikeStatus;
  /** `"Bajaj Pulsar NS200 · 2022"`, or `''` when neither is recorded. */
  descriptor: string;
  /** Integer metres, or `null` when nothing is known. */
  odometerMetres: number | null;
  tankCapacityMl: number | null;
  photoPath: string | null;
  /** `'YYYY-MM'` of the day the bike was archived — the board's "sold Mar 2026". */
  archivedMonth: string | null;
};

/** `"Bajaj Pulsar NS200 · 2022"` — the line under a bike's name on every board. */
export function bikeDescriptor(bike: Pick<Bike, 'manufacturer' | 'model' | 'year'>): string {
  const machine = [bike.manufacturer.trim(), bike.model.trim()].filter((part) => part !== '').join(' ');
  return [machine, bike.year === null ? '' : String(bike.year)].filter((part) => part !== '').join(' · ');
}

/**
 * The highest reading known from the bike document alone, or `null`.
 *
 * Used only for motorcycles that are not the active one. For the active bike
 * the screen reads `analyseBike().odometer.currentMetres`, which is built from
 * the whole history and is always at least this figure.
 */
export function knownOdometerMetres(
  bike: Pick<Bike, 'initialOdometerMetres' | 'storedOdometerMetres'>,
): number | null {
  const best = Math.max(bike.initialOdometerMetres, bike.storedOdometerMetres);
  return Number.isFinite(best) && best > 0 ? Math.round(best) : null;
}

/**
 * Orders the garage the way the board draws it — the motorcycle in use first,
 * then the ones a tap away, then the archived ones — and attaches the figures
 * each card prints.
 *
 * `activeOdometerMetres` is `analyseBike().odometer.currentMetres` for the
 * active bike; pass `null` while the analysis is still loading and the card
 * falls back to the bike document's own figure.
 */
export function summariseGarage(input: {
  bikes: readonly Bike[];
  activeBikeId: string | null;
  activeOdometerMetres?: number | null;
}): GarageBikeSummary[] {
  const rank: Record<GarageBikeStatus, number> = { active: 0, other: 1, archived: 2 };

  const rows = input.bikes.map((bike): GarageBikeSummary => {
    const archived = bike.archivedAt !== null;
    const active = !archived && bike.id === input.activeBikeId;
    const derived = active ? (input.activeOdometerMetres ?? null) : null;

    return {
      id: bike.id,
      nickname: bike.nickname,
      status: archived ? 'archived' : active ? 'active' : 'other',
      descriptor: bikeDescriptor(bike),
      odometerMetres: derived ?? knownOdometerMetres(bike),
      tankCapacityMl: bike.tankCapacityMl,
      photoPath: bike.photoPath,
      archivedMonth: bike.archivedAt === null ? null : monthKey(dateToIso(new Date(bike.archivedAt))),
    };
  });

  return rows.sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status];
    if (byStatus !== 0) return byStatus;
    return a.nickname.localeCompare(b.nickname);
  });
}

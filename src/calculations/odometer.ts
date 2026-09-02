import type {
  FuelEntry,
  IsoDate,
  OdometerReading,
  OdometerSource,
  Part,
  ServiceRecord,
} from '@/types';
import { compareIso, dateToIso, daysBetween } from '@/utils/date';

/**
 * The odometer is an append-only history with exactly one source of truth.
 *
 * Manual and onboarding readings are stored rows. Readings that are implied by a
 * fuel log, service or part fitting are *derived* from those records rather than
 * copied into a second table — so editing or deleting a fuel log corrects the
 * odometer history automatically and the two can never disagree (requirement 63).
 */

export type OdometerPoint = {
  id: string;
  metres: number;
  date: IsoDate;
  source: OdometerSource;
  sourceId: string | null;
  note: string | null;
};

const SOURCE_LABEL: Record<OdometerSource, string> = {
  manual: 'manual update',
  fuel: 'fuel log',
  service: 'service',
  expense: 'expense',
};

export function odometerSourceLabel(source: OdometerSource): string {
  return SOURCE_LABEL[source];
}

export function buildOdometerHistory(input: {
  readings: readonly OdometerReading[];
  fuelEntries: readonly FuelEntry[];
  services: readonly ServiceRecord[];
  parts: readonly Part[];
  /** The bike's opening reading, and the figure the web product stores. */
  bike?: { initialOdometerMetres: number; storedOdometerMetres: number; createdAt: number };
}): OdometerPoint[] {
  const points: OdometerPoint[] = [];

  if (input.bike) {
    const opened = dateToIso(new Date(input.bike.createdAt));
    if (input.bike.initialOdometerMetres > 0) {
      points.push({
        id: 'bike:initial',
        metres: input.bike.initialOdometerMetres,
        date: opened,
        source: 'manual',
        sourceId: null,
        note: 'Starting reading',
      });
    }
    // The web product may have moved the odometer on without writing a reading
    // row. Folding its figure in keeps the two views of the same bike in step.
    if (input.bike.storedOdometerMetres > input.bike.initialOdometerMetres) {
      points.push({
        id: 'bike:current',
        metres: input.bike.storedOdometerMetres,
        date: opened,
        source: 'manual',
        sourceId: null,
        note: null,
      });
    }
  }

  for (const r of input.readings) {
    points.push({
      id: r.id,
      metres: r.metres,
      date: r.date,
      source: r.source,
      sourceId: r.sourceId,
      note: r.note,
    });
  }

  for (const f of input.fuelEntries) {
    points.push({
      id: `fuel:${f.id}`,
      metres: f.odometerMetres,
      date: f.date,
      source: 'fuel',
      sourceId: f.id,
      note: null,
    });
  }

  for (const s of input.services) {
    if (s.odometerMetres === null) continue;
    points.push({
      id: `service:${s.id}`,
      metres: s.odometerMetres,
      date: s.date,
      source: 'service',
      sourceId: s.id,
      note: null,
    });
  }

  for (const p of input.parts) {
    // A part fitted during a service would duplicate that service's reading.
    if (p.linkedServiceId !== null) continue;
    if (p.installedOdometerMetres <= 0) continue;
    points.push({
      id: `part:${p.id}`,
      metres: p.installedOdometerMetres,
      date: p.installedDate,
      source: 'service',
      sourceId: p.id,
      note: 'Part fitted',
    });
  }

  // Newest first, which is how the history screen reads.
  return points.sort((a, b) => {
    const byDate = compareIso(b.date, a.date);
    if (byDate !== 0) return byDate;
    return b.metres - a.metres;
  });
}

/**
 * The bike's current odometer: the highest reading ever recorded.
 *
 * Taking the maximum rather than "the most recent" means a mistyped low reading
 * can never make the bike appear to travel backwards, and deleting the newest
 * record falls back correctly.
 */
export function currentOdometerMetres(points: readonly OdometerPoint[]): number | null {
  let max: number | null = null;
  for (const p of points) {
    if (max === null || p.metres > max) max = p.metres;
  }
  return max;
}

/** The reading the current odometer came from, for "Updated 30 Aug" lines. */
export function currentOdometerPoint(points: readonly OdometerPoint[]): OdometerPoint | null {
  let best: OdometerPoint | null = null;
  for (const p of points) {
    if (best === null || p.metres > best.metres) best = p;
  }
  return best;
}

/** Total distance covered, i.e. highest reading minus lowest known reading. */
export function totalDistanceMetres(points: readonly OdometerPoint[]): number {
  if (points.length === 0) return 0;
  let min = points[0]!.metres;
  let max = points[0]!.metres;
  for (const p of points) {
    if (p.metres < min) min = p.metres;
    if (p.metres > max) max = p.metres;
  }
  return Math.max(0, max - min);
}

export type OdometerValidation =
  | { ok: true }
  | { ok: false; reason: 'below_current'; currentMetres: number }
  | { ok: false; reason: 'implausible_jump'; currentMetres: number };

/** A single implausible-jump ceiling: 5,000 km between consecutive readings. */
export const MAX_PLAUSIBLE_JUMP_METRES = 5_000_000;

/**
 * The odometer only moves forward. A lower reading is flagged for the rider to
 * confirm, never silently accepted (as the Garage screen promises).
 */
export function validateOdometer(nextMetres: number, currentMetres: number | null): OdometerValidation {
  if (currentMetres === null) return { ok: true };
  if (nextMetres < currentMetres) return { ok: false, reason: 'below_current', currentMetres };
  if (nextMetres - currentMetres > MAX_PLAUSIBLE_JUMP_METRES) {
    return { ok: false, reason: 'implausible_jump', currentMetres };
  }
  return { ok: true };
}

/** Average distance ridden per calendar month, used by the assistant and analytics. */
export function averageMonthlyDistanceMetres(points: readonly OdometerPoint[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => compareIso(a.date, b.date));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const metres = last.metres - first.metres;
  if (metres <= 0) return null;

  const days = Math.max(1, daysBetween(first.date, last.date));
  return (metres / days) * 30.44;
}

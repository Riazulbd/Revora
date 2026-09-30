import type { FuelAdjustment, FuelEntry, IsoDate } from '@/types';
import { compareIso } from '@/utils/date';
import { ADJUSTMENT_REASON_LABEL } from './fuel';
import type { MileageInterval } from './mileage';

/**
 * The fuel log as the redesign draws it: one timeline that carries fills *and*
 * adjustments, newest first.
 *
 * An adjustment is an event on the motorcycle's timeline, not a field on a fill
 * (see `FuelAdjustment`), so the log that lists fills has to list them too —
 * otherwise a rider who logged a spillage sees the litres vanish from every
 * mileage figure with nothing on screen to explain where they went.
 *
 * Merging, ordering and filtering live here rather than in the screen so the
 * Fuel tab and anything else that lists the log agree on what "Partial" means.
 */

export type FuelLogItem =
  | {
      kind: 'fill';
      /** Unique within the merged list (a fill and an adjustment can share a date). */
      id: string;
      date: IsoDate;
      entry: FuelEntry;
      /** The full-to-full interval this fill closed, if any. */
      interval: MileageInterval | null;
    }
  | { kind: 'adjustment'; id: string; date: IsoDate; adjustment: FuelAdjustment };

/** The board's four chips: `All fills · Full · Partial · Adjustments`. */
export type FuelLogFilter = 'all' | 'full' | 'partial' | 'adjusted';

/**
 * Newest first. A fill and an adjustment on the same day put the fill first —
 * the adjustment describes fuel that left the tank between fills, so it reads
 * below the fill it followed.
 */
export function buildFuelLog(
  entries: readonly FuelEntry[],
  adjustments: readonly FuelAdjustment[],
  intervals: readonly MileageInterval[] = [],
): FuelLogItem[] {
  const intervalByEntryId = new Map<string, MileageInterval>();
  for (const interval of intervals) intervalByEntryId.set(interval.toEntryId, interval);

  const items: FuelLogItem[] = [
    ...entries.map<FuelLogItem>((entry) => ({
      kind: 'fill',
      id: `fill:${entry.id}`,
      date: entry.date,
      entry,
      interval: intervalByEntryId.get(entry.id) ?? null,
    })),
    ...adjustments.map<FuelLogItem>((adjustment) => ({
      kind: 'adjustment',
      id: `adjustment:${adjustment.id}`,
      date: adjustment.date,
      adjustment,
    })),
  ];

  return items.sort((a, b) => {
    const byDate = compareIso(b.date, a.date);
    if (byDate !== 0) return byDate;
    if (a.kind !== b.kind) return a.kind === 'fill' ? -1 : 1;
    return createdAt(b) - createdAt(a);
  });
}

function createdAt(item: FuelLogItem): number {
  return item.kind === 'fill' ? item.entry.createdAt : item.adjustment.createdAt;
}

/**
 * The chip filters.
 *
 * `partial` deliberately keeps `unknown` fills: neither one closes a mileage
 * interval, and splitting them would leave an `unknown` fill in no filter at all.
 */
export function filterFuelLog(items: readonly FuelLogItem[], filter: FuelLogFilter): FuelLogItem[] {
  switch (filter) {
    case 'full':
      return items.filter((item) => item.kind === 'fill' && item.entry.fillType === 'full');
    case 'partial':
      return items.filter((item) => item.kind === 'fill' && item.entry.fillType !== 'full');
    case 'adjusted':
      return items.filter((item) => item.kind === 'adjustment');
    default:
      return [...items];
  }
}

/**
 * What the adjustment was, in the middle of a sentence: the board's row reads
 * "Adjustment · spillage −0.3 L", so the rider's own note (or the reason) is
 * lowercased to sit inside it.
 */
export function adjustmentReasonPhrase(adjustment: FuelAdjustment): string {
  return adjustmentReasonLabel(adjustment).toLowerCase();
}

/** The same label as a heading — "Spillage" above "Logged 6 Sep". */
export function adjustmentReasonLabel(adjustment: FuelAdjustment): string {
  const note = adjustment.note?.trim();
  return note !== undefined && note !== '' ? note : ADJUSTMENT_REASON_LABEL[adjustment.reason];
}

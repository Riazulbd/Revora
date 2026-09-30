import { compareIso } from '@/utils/date';
import type { OdometerPoint } from './odometer';

/**
 * The odometer history as the board lists it: every reading, newest first, with
 * the two facts each row needs — whether the rider can correct it here, and
 * whether it contradicts the readings around it.
 *
 * A reading is **out of sequence** when a later-dated reading is lower than it:
 * the odometer only ever moves forward, so 60,000 km on 8 Sep sitting above
 * 34,626 km on 10 Sep is a typo, not a ride. Only the high reading is flagged —
 * flagging everything underneath it would point the rider at four correct rows
 * and hide the one that is wrong.
 *
 * Nothing here is stored. The flag is recomputed from the history on every read,
 * so correcting the reading clears it without a second write.
 */
export type OdometerHistoryRow = {
  point: OdometerPoint;
  /** Stored readings are corrected here; derived ones by editing their record. */
  correctable: boolean;
  /** A later reading is lower than this one. */
  outOfSequence: boolean;
};

export function buildOdometerRows(points: readonly OdometerPoint[]): OdometerHistoryRow[] {
  const newestFirst = [...points].sort((a, b) => {
    const byDate = compareIso(b.date, a.date);
    return byDate !== 0 ? byDate : b.metres - a.metres;
  });

  // Walking newest → oldest, the smallest reading seen so far is the lowest
  // figure recorded *after* the row being judged. Readings that share a date are
  // held back until the date changes: two readings on one day are not evidence
  // against each other, only a reading from a later day is.
  let lowestAfter: number | null = null;
  let pendingDate: string | null = null;
  let pendingLowest: number | null = null;
  const rows: OdometerHistoryRow[] = [];

  const flush = () => {
    if (pendingLowest !== null && (lowestAfter === null || pendingLowest < lowestAfter)) {
      lowestAfter = pendingLowest;
    }
    pendingDate = null;
    pendingLowest = null;
  };

  for (const point of newestFirst) {
    if (pendingDate !== null && pendingDate !== point.date) flush();
    pendingDate = point.date;
    if (pendingLowest === null || point.metres < pendingLowest) pendingLowest = point.metres;

    rows.push({
      point,
      correctable: point.readingId !== null,
      outOfSequence: lowestAfter !== null && point.metres > lowestAfter,
    });
  }

  return rows;
}

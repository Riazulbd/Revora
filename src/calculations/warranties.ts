import type { IsoDate, Warranty } from '@/types';
import { daysBetween, formatLongDate, todayIso } from '@/utils/date';

/**
 * A warranty as the redesign draws it in the list.
 *
 * An open claim outranks the dates. A rider whose battery is with the dealer
 * wants to see that first; whether the cover has four months or forty left is
 * the next question, not the first one.
 *
 * An expired warranty is never dropped and never hidden. It is evidence that
 * the part was covered and when, which is exactly what a buyer asks about at
 * resale — the board dims the row and says so rather than deleting it.
 */

/** How long before a warranty lapses the list starts warning, in days. */
export const WARRANTY_WARNING_DAYS = 30;

export type WarrantyTone = 'good' | 'warn' | 'bad' | 'neutral';

export type WarrantyState = {
  /** `'CLAIM OPEN'`, `'ACTIVE'`, `'EXPIRING'`, `'EXPIRED'`, `'NO EXPIRY'`. */
  label: string;
  tone: WarrantyTone;
  /**
   * The board outlines a live pill and fills a spent one, so an expired
   * warranty reads as settled furniture rather than as a status to act on.
   */
  outlined: boolean;
  expired: boolean;
  claimOpen: boolean;
};

export function warrantyState(warranty: Warranty, today: IsoDate = todayIso()): WarrantyState {
  const expired =
    warranty.validUntil !== null && daysBetween(today, warranty.validUntil) < 0;

  if (warranty.claimStatus === 'open') {
    return { label: 'CLAIM OPEN', tone: 'warn', outlined: true, expired, claimOpen: true };
  }

  const base = { outlined: !expired, expired, claimOpen: false };

  if (expired) return { label: 'EXPIRED', tone: 'neutral', ...base };
  if (warranty.validUntil === null) return { label: 'NO EXPIRY', tone: 'neutral', ...base };

  const days = daysBetween(today, warranty.validUntil);
  if (days <= WARRANTY_WARNING_DAYS) return { label: 'EXPIRING', tone: 'warn', ...base };
  return { label: 'ACTIVE', tone: 'good', ...base };
}

/** `'Battery · Hamko'` — what is covered, and by whom when that is recorded. */
export function warrantyTitle(warranty: Warranty): string {
  const provider = warranty.provider?.trim() ?? '';
  return provider === '' ? warranty.title : `${warranty.title} · ${provider}`;
}

/**
 * `'Bought at Motor House Dhanmondi · valid until 28 Apr 2027'`.
 *
 * Only what is recorded: a warranty with neither a seller nor an end date gets
 * `null` and the row falls back to its pill, rather than a line asserting a
 * term nobody entered.
 */
export function warrantySourceLine(warranty: Warranty, today: IsoDate = todayIso()): string | null {
  const parts: string[] = [];

  const from = warranty.purchasedFrom?.trim() ?? '';
  if (from !== '') parts.push(`Bought at ${from}`);

  if (warranty.validUntil !== null) {
    const expired = daysBetween(today, warranty.validUntil) < 0;
    parts.push(`${expired ? 'expired' : 'valid until'} ${formatLongDate(warranty.validUntil)}`);
  }

  return parts.length === 0 ? null : parts.join(' · ');
}

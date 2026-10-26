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

/** `'1 yr 4 mo'`, `'4 mo'`, `'10 days'` — how much cover is left, in the largest honest unit. */
export function warrantyRemainingLabel(warranty: Warranty, today: IsoDate = todayIso()): string | null {
  if (warranty.validUntil === null) return null;
  const days = daysBetween(today, warranty.validUntil);
  if (days < 0) return null;
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30.44);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months} mo`;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}

/**
 * The chip on a warranty card: `Claim open` outranks the dates, then the
 * countdown inside the warning window (`10 days`), `Valid`, or `Expired`.
 */
export function warrantyChip(warranty: Warranty, today: IsoDate = todayIso()): { label: string; tone: WarrantyTone } {
  const state = warrantyState(warranty, today);
  if (state.claimOpen) return { label: 'Claim open', tone: 'warn' };
  if (state.expired) return { label: 'Expired', tone: 'neutral' };
  if (warranty.validUntil === null) return { label: 'No expiry', tone: 'neutral' };
  const days = daysBetween(today, warranty.validUntil);
  if (days <= WARRANTY_WARNING_DAYS) return { label: `${days} day${days === 1 ? '' : 's'}`, tone: 'warn' };
  return { label: 'Valid', tone: 'good' };
}

/**
 * How far through its term a warranty is, 0–1, measured from the day it was
 * recorded to the day it ends. A warranty record carries no purchase date, so
 * the day it entered the log is the only start the app can honestly draw;
 * null without an end date.
 */
export function warrantyProgress(warranty: Warranty, today: IsoDate = todayIso()): number | null {
  if (warranty.validUntil === null) return null;
  const start = new Date(warranty.createdAt);
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` as IsoDate;
  const term = daysBetween(startIso, warranty.validUntil);
  if (term <= 0) return 1;
  const gone = daysBetween(startIso, today);
  return Math.max(0, Math.min(1, gone / term));
}

/** Warranties that still cover something today. */
export function activeWarranties(warranties: readonly Warranty[], today: IsoDate = todayIso()): Warranty[] {
  return warranties.filter((w) => !warrantyState(w, today).expired);
}

/** The active warranty ending soonest — the hero's "Tyres end in 10 days"; null when none has an end date. */
export function nextWarrantyToEnd(
  warranties: readonly Warranty[],
  today: IsoDate = todayIso(),
): { warranty: Warranty; days: number } | null {
  let best: { warranty: Warranty; days: number } | null = null;
  for (const warranty of activeWarranties(warranties, today)) {
    if (warranty.validUntil === null) continue;
    const days = daysBetween(today, warranty.validUntil);
    if (best === null || days < best.days) best = { warranty, days };
  }
  return best;
}

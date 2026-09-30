import type { IsoDate, VaultDocument } from '@/types';
import { daysBetween, formatLongDate, todayIso } from '@/utils/date';
import { documentStatus, isTimeLimited, type DocumentStatus } from './documents';

/**
 * The document vault as the redesign draws a row.
 *
 * `documents.ts` already decides whether a document is valid, expiring, expired
 * or undated. The board asks two further things of every row — a pill that says
 * how long is left in days, and a validity line that gives the term and nothing
 * else — and both are derived from the same two dates, so they belong beside
 * `documentStatus` rather than inside the screen.
 *
 * The day count and the line deliberately do not repeat each other: the pill
 * counts down, the line states the term. A rider at a traffic stop reads the
 * pill; one renewing a policy reads the line.
 */

export type DocumentBadgeTone = 'good' | 'warn' | 'bad' | 'neutral';

const STATUS_TONE: Record<DocumentStatus, DocumentBadgeTone> = {
  valid: 'good',
  expiring: 'warn',
  expired: 'bad',
  no_expiry: 'neutral',
};

/**
 * A document that exists because it runs out, saved without the date it runs
 * out on. Not an error state in the data — the record may predate the rule —
 * but the one thing the vault cannot do anything with, so the row says so.
 */
export function documentNeedsExpiry(document: VaultDocument): boolean {
  return document.expiresOn === null && isTimeLimited(document.kind);
}

export function documentBadgeTone(
  document: VaultDocument,
  today: IsoDate = todayIso(),
): DocumentBadgeTone {
  if (documentNeedsExpiry(document)) return 'warn';
  return STATUS_TONE[documentStatus(document, today)];
}

/**
 * `'VALID · 179 DAYS'`, `'EXPIRING · 12 DAYS'`, `'EXPIRED · 4 DAYS AGO'`,
 * `'NO EXPIRY RECORDED'`, `'NEVER EXPIRES'`.
 *
 * A document with no expiry splits in two, because "we were never told" and
 * "it genuinely never runs out" are different facts about the record and must
 * not read the same.
 */
export function documentBadgeLabel(document: VaultDocument, today: IsoDate = todayIso()): string {
  if (document.expiresOn === null) {
    return documentNeedsExpiry(document) ? 'NO EXPIRY RECORDED' : 'NEVER EXPIRES';
  }

  const days = daysBetween(today, document.expiresOn);
  if (days < 0) {
    const ago = Math.abs(days);
    return `EXPIRED · ${ago} ${ago === 1 ? 'DAY' : 'DAYS'} AGO`;
  }
  if (days === 0) return 'EXPIRES TODAY';

  const status = documentStatus(document, today);
  return `${status === 'expiring' ? 'EXPIRING' : 'VALID'} · ${days} ${days === 1 ? 'DAY' : 'DAYS'}`;
}

/**
 * The term under a document's name: `'12 Mar 2026 — valid until 28 Sep 2026'`.
 *
 * `null` where there is no term to state — the row's pill has already said
 * "NEVER EXPIRES" or "NO EXPIRY RECORDED", and repeating it in grey under the
 * name would be the same sentence twice.
 */
export function vaultValidityLine(
  document: VaultDocument,
  today: IsoDate = todayIso(),
): string | null {
  const { issuedOn, expiresOn } = document;

  if (expiresOn === null) {
    return issuedOn === null ? null : `Issued ${formatLongDate(issuedOn)}`;
  }

  const term = issuedOn === null ? '' : `${formatLongDate(issuedOn)} — `;
  const expired = daysBetween(today, expiresOn) < 0;

  return `${term}${expired ? 'expired' : 'valid until'} ${formatLongDate(expiresOn)}`;
}

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

/**
 * The hero's three figures on the Figma vault (`Valid · Due soon · Offline`),
 * counted from the same `documentStatus` every row uses.
 */
export type VaultCounts = {
  total: number;
  valid: number;
  /** Expiring inside the warning window. */
  dueSoon: number;
  expired: number;
  /** Documents the rider keeps an offline copy of. */
  offline: number;
};

export function vaultCounts(documents: readonly VaultDocument[], today: IsoDate = todayIso()): VaultCounts {
  const counts: VaultCounts = { total: documents.length, valid: 0, dueSoon: 0, expired: 0, offline: 0 };
  for (const document of documents) {
    const status = documentStatus(document, today);
    if (status === 'valid') counts.valid += 1;
    if (status === 'expiring') counts.dueSoon += 1;
    if (status === 'expired') counts.expired += 1;
    if (document.keepOfflineCopy) counts.offline += 1;
  }
  return counts;
}

/**
 * The Figma row's second line: `Valid until 28 Sep`, `TP-4432871 · until
 * 14 Jan 2027`, `DHAKA METRO-HA 12-3456 · No expiry`, `Custom document · No
 * expiry`. The reference leads when there is one; a custom document with no
 * number names its kind instead so the line is never empty.
 */
export function vaultRowLine(document: VaultDocument, today: IsoDate = todayIso()): string {
  const reference = document.reference?.trim() ?? '';
  const lead = reference !== '' ? reference : document.kind === 'custom' ? 'Custom document' : null;

  if (document.expiresOn === null) {
    const tail = documentNeedsExpiry(document) ? 'No expiry recorded' : 'No expiry';
    return lead === null ? tail : `${lead} · ${tail}`;
  }

  const expired = daysBetween(today, document.expiresOn) < 0;
  const date = formatLongDate(document.expiresOn);
  if (lead === null) return `${expired ? 'Expired' : 'Valid until'} ${date}`;
  return `${lead} · ${expired ? 'expired' : 'until'} ${date}`;
}

/**
 * The Figma row's chip: a countdown while the document is due soon (`12
 * days`), `Valid` while it is not, `Expired` once it has, and nothing at all
 * for a document with no term — the row then ends in a chevron instead.
 */
export function vaultRowChip(
  document: VaultDocument,
  today: IsoDate = todayIso(),
): { label: string; tone: DocumentBadgeTone } | null {
  if (document.expiresOn === null) {
    return documentNeedsExpiry(document) ? { label: 'No date', tone: 'warn' } : null;
  }
  const days = daysBetween(today, document.expiresOn);
  if (days < 0) return { label: 'Expired', tone: 'bad' };
  if (days === 0) return { label: 'Today', tone: 'warn' };
  if (documentStatus(document, today) === 'expiring') {
    return { label: `${days} day${days === 1 ? '' : 's'}`, tone: 'warn' };
  }
  return { label: 'Valid', tone: 'good' };
}

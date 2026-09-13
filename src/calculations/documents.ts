import type { DocumentKind, IsoDate, VaultDocument } from '@/types';
import { daysBetween, formatLongDate, todayIso } from '@/utils/date';

/**
 * Whether a document in the vault is still good.
 *
 * Lives here rather than beside the queries that fetch documents because it is
 * a derived value, and because the Proof Pack needs it without needing
 * Firebase: the PDF builder is pure string work, and importing it used to drag
 * `@react-native-firebase/auth` in behind it, which made the whole report
 * impossible to test off-device.
 */
export type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'no_expiry';

/** How long before expiry a document starts warning. */
export const DOCUMENT_WARNING_DAYS = 30;

export function documentStatus(document: VaultDocument, today: IsoDate = todayIso()): DocumentStatus {
  if (document.expiresOn === null) return 'no_expiry';
  const days = daysBetween(today, document.expiresOn);
  if (days < 0) return 'expired';
  if (days <= DOCUMENT_WARNING_DAYS) return 'expiring';
  return 'valid';
}

/**
 * What each kind of document is called, and what its number is called.
 *
 * A rider filling in an insurance claim is looking for "policy no."; one at a
 * registration office is looking for "registration no.". One generic
 * "Reference" label makes them read the value to work out which field they are
 * looking at, every time.
 */
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  registration: 'Registration',
  insurance: 'Insurance',
  tax_token: 'Tax token',
  fitness: 'Fitness',
  licence: 'Driving licence',
  custom: 'Custom',
};

export const DOCUMENT_REFERENCE_LABEL: Record<DocumentKind, string> = {
  registration: 'Registration no.',
  insurance: 'Policy no.',
  tax_token: 'Tax token no.',
  fitness: 'Certificate no.',
  licence: 'Licence no.',
  custom: 'Document no.',
};

/**
 * Documents that exist *because* they run out.
 *
 * A tax token, a fitness certificate, an insurance policy and a licence are all
 * issued for a term; storing one without its expiry keeps a photograph and
 * throws away the only thing the app could have warned about. These kinds ask
 * for the date rather than offering it, and the form refuses to save without
 * one — see `documentSchema`.
 *
 * `custom` is deliberately not on the list. A rider filing a purchase invoice
 * or a spare-key receipt has nothing to put in the field, and demanding a date
 * would teach them to invent one.
 */
const TIME_LIMITED: readonly DocumentKind[] = ['registration', 'insurance', 'tax_token', 'fitness', 'licence'];

export function isTimeLimited(kind: DocumentKind): boolean {
  return TIME_LIMITED.includes(kind);
}

/** `'Valid until'` on a document with a term, `'Expires'` on one without. */
export function expiryLabel(kind: DocumentKind): string {
  return isTimeLimited(kind) ? 'Valid until' : 'Expires (optional)';
}

/**
 * The validity of a document in one line, saying only what is known.
 *
 * Both dates gives the term. An end date alone gives the deadline, which is
 * what the reminders run on. Neither gives "No expiry recorded" rather than a
 * guess, because a registration with an unknown renewal date and one that
 * genuinely never expires are different facts and must not read the same.
 */
export function validityLine(document: VaultDocument, today: IsoDate = todayIso()): string {
  const { issuedOn, expiresOn } = document;

  if (expiresOn === null) {
    return issuedOn === null
      ? 'No expiry recorded'
      : `Issued ${formatLongDate(issuedOn)} · no expiry recorded`;
  }

  const days = daysBetween(today, expiresOn);
  const term = issuedOn === null ? '' : `${formatLongDate(issuedOn)} — `;

  if (days < 0) return `${term}expired ${formatLongDate(expiresOn)}`;
  if (days === 0) return `${term}expires today`;
  return `${term}valid until ${formatLongDate(expiresOn)} · ${days} day${days === 1 ? '' : 's'}`;
}

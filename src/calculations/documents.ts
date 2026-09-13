import type { IsoDate, VaultDocument } from '@/types';
import { daysBetween, todayIso } from '@/utils/date';

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

import type { DocumentData } from '@react-native-firebase/firestore';
import { Timestamp } from '@react-native-firebase/firestore';

import { divideRound , currencyDecimals } from '@/calculations/money';
import type { CurrencyCode, IsoDate } from '@/types';
import { dateToIso, isIsoDate } from '@/utils/date';

/**
 * The unit boundary between Revora's domain model and the shared database.
 *
 * Revora computes in integers — metres, millilitres, minor currency units — so
 * that `9 L × BDT 145` is exactly `BDT 1,305` and never `1304.9999999`. The
 * shared schema, which the web product also writes, stores plain kilometres,
 * litres and major-unit amounts.
 *
 * Both are right for their job, and this file is the only place they meet.
 * Everything above it is exact; everything below it is what the web expects.
 */

const KM_TO_M = 1000;
const L_TO_ML = 1000;

// --- distance: stored kilometres  ↔  domain metres ---------------------------

export function kmToMetres(km: number): number {
  return Math.round(km * KM_TO_M);
}

export function metresToKm(metres: number): number {
  // Two decimals is finer than any odometer reports and keeps the stored number
  // short enough to compare cleanly on the web.
  return Math.round((metres / KM_TO_M) * 100) / 100;
}

// --- volume: stored litres  ↔  domain millilitres ----------------------------

export function litresToMl(litres: number): number {
  return Math.round(litres * L_TO_ML);
}

export function mlToLitres(ml: number): number {
  return Math.round((ml / L_TO_ML) * 1000) / 1000;
}

// --- money: stored major units  ↔  domain minor units ------------------------

export function majorToMinor(amount: number, currency: CurrencyCode): number {
  return Math.round(amount * 10 ** currencyDecimals(currency));
}

export function minorToMajor(minor: number, currency: CurrencyCode): number {
  const scale = 10 ** currencyDecimals(currency);
  return divideRound(minor * 100, scale) / 100;
}

// --- dates -------------------------------------------------------------------

/**
 * A stored date reaches us as a `'YYYY-MM-DD'` string, a full ISO string, or a
 * Firestore `Timestamp`. All three become a local calendar date.
 *
 * A `Timestamp` is converted through the device's local calendar, which is the
 * only reading that makes "the day I filled up" mean what the rider meant.
 */
export function readIsoDate(data: DocumentData, key: string, fallback: IsoDate): IsoDate {
  const v = data[key];

  if (typeof v === 'string') {
    // `isIsoDate` narrows to IsoDate, so read the head before the guard.
    const head = v.slice(0, 10);
    if (isIsoDate(head)) return head;
    return fallback;
  }

  if (v && typeof v === 'object' && typeof (v as Timestamp).toDate === 'function') {
    return dateToIso((v as Timestamp).toDate());
  }

  return fallback;
}

export function readNullableIsoDate(data: DocumentData, key: string): IsoDate | null {
  if (data[key] === undefined || data[key] === null) return null;
  const parsed = readIsoDate(data, key, '');
  return parsed === '' ? null : parsed;
}

/** Calendar dates are written as plain strings — never a timestamp. */
export function writeIsoDate(date: IsoDate): string {
  return date;
}

// --- optional fields ---------------------------------------------------------

/**
 * An optional value that the rider has cleared must be written as an explicit
 * `null`: a merging write ignores a missing key, so omitting it would leave the
 * old value in place.
 */
export function orNull<T>(value: T | null | undefined): T | null {
  return value === undefined ? null : value;
}

/** Drops keys the shared schema rejects rather than sending `undefined`. */
export function compact(data: DocumentData): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

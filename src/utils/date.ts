import type { IsoDate } from '@/types';

/**
 * Calendar dates in Revora are plain `'YYYY-MM-DD'` strings and are never routed
 * through UTC. A service completed on 1 September must read "1 Sep" for a rider
 * in Dhaka and a rider in Los Angeles alike (requirement 64).
 *
 * `Date` is used only as a calendar calculator, always via local-time
 * constructors, and never as a storage or transport format for a date-only value.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const [y, m, d] = splitIso(value as IsoDate);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

function splitIso(value: IsoDate): [number, number, number] {
  const match = ISO.exec(value);
  if (!match) return [1970, 1, 1];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Today in the device's local calendar. */
export function todayIso(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Converts a local `Date` (e.g. from a picker) to a calendar date. */
export function dateToIso(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Converts a calendar date to a local `Date` at midnight — never UTC. */
export function isoToDate(value: IsoDate): Date {
  const [y, m, d] = splitIso(value);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const [ay, am, ad] = splitIso(a);
  const [by, bm, bd] = splitIso(b);
  const MS = 86_400_000;
  // Date.UTC is used purely as a day counter here — both operands are built the
  // same way, so no timezone can shift the difference.
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const d = isoToDate(value);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

export function addMonths(value: IsoDate, months: number): IsoDate {
  const [y, m, d] = splitIso(value);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(d, daysInMonth(targetYear, targetMonth + 1));
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(clampedDay)}`;
}

export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `'2026-08'` — the calendar month a date belongs to. */
export function monthKey(value: IsoDate): string {
  return value.slice(0, 7);
}

export function monthKeyOfToday(now: Date = new Date()): string {
  return monthKey(todayIso(now));
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * `'September'` — the month on its own.
 *
 * Used where a heading already establishes which year is meant, and printing
 * it would add a figure the rider has to read past.
 */
export function monthName(value: IsoDate): string {
  return MONTH_LONG[Number(value.slice(5, 7)) - 1] ?? '';
}

/** `'30 Aug 2026'` — the long form the design uses in lists and detail screens. */
export function formatLongDate(value: IsoDate): string {
  const [y, m, d] = splitIso(value);
  return `${d} ${MONTH_SHORT[m - 1] ?? '?'} ${y}`;
}

/** `'30 Aug'` — the short form the design uses in ledgers and activity rows. */
export function formatShortDate(value: IsoDate): string {
  const [, m, d] = splitIso(value);
  return `${d} ${MONTH_SHORT[m - 1] ?? '?'}`;
}

/** `'Aug'` — month chart labels. */
export function formatMonthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  return MONTH_SHORT[month - 1] ?? '?';
}

/** `'Aug 2026'`. */
export function formatMonthLong(key: string): string {
  return `${formatMonthLabel(key)} ${key.slice(0, 4)}`;
}

/** Relative wording used by the notifications list. */
export function formatRelativeDay(value: IsoDate, today: IsoDate = todayIso()): string {
  const diff = daysBetween(value, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatShortDate(value);
}

/** `'30 Aug, 18:42'` — an instant, for "logged at" lines. */
export function formatInstant(millis: number): string {
  const d = new Date(millis);
  return `${formatShortDate(dateToIso(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The `n` most recent month keys ending at `endKey`, oldest first. */
export function recentMonthKeys(count: number, endKey: string = monthKeyOfToday()): string[] {
  const out: string[] = [];
  const year = Number(endKey.slice(0, 4));
  const month = Number(endKey.slice(5, 7));
  for (let i = count - 1; i >= 0; i--) {
    const idx = month - 1 - i;
    const y = year + Math.floor(idx / 12);
    const m = ((idx % 12) + 12) % 12;
    out.push(`${y}-${pad(m + 1)}`);
  }
  return out;
}

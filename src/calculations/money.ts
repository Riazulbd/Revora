import { currencyEntry } from './currencies';
import type { CurrencyCode } from '@/types';

/**
 * Money is always an integer count of minor units. Nothing in Revora ever holds
 * an amount in a float, so `0.1 + 0.2` style drift is structurally impossible.
 */

/** ISO 4217 exponent. Two is the safe default for an unknown code. */
export function currencyDecimals(currency: CurrencyCode): number {
  return currencyEntry(currency)?.minorUnits ?? 2;
}

export function currencySymbol(currency: CurrencyCode): string {
  return currencyEntry(currency)?.symbol ?? currency;
}

/** 10^n as an exact integer. */
function pow10(n: number): number {
  let out = 1;
  for (let i = 0; i < n; i++) out *= 10;
  return out;
}

/**
 * Parses a user-typed decimal string into an integer scaled by 10^`decimals`,
 * entirely with string arithmetic so no float ever touches the value.
 *
 * `parseDecimal('145.5', 2)  === 14550`
 * `parseDecimal('1,305', 2)  === 130500`
 * `parseDecimal('9.005', 2)  === 901`   (half-up on the dropped digits)
 *
 * Returns null for anything that is not a non-negative decimal number.
 */
export function parseDecimal(input: string, decimals: number): number | null {
  const cleaned = input.trim().replace(/[\s, ]/g, '');
  if (cleaned === '') return null;
  if (!/^\d*(\.\d*)?$/.test(cleaned)) return null;
  if (cleaned === '.' || cleaned === '') return null;

  const [rawWhole = '', rawFrac = ''] = cleaned.split('.');
  const whole = rawWhole === '' ? '0' : rawWhole;
  if (!/^\d+$/.test(whole)) return null;

  const keep = rawFrac.slice(0, decimals).padEnd(decimals, '0');
  const nextDigit = rawFrac.charAt(decimals);

  const scaled = Number(whole) * pow10(decimals) + Number(keep === '' ? '0' : keep);
  if (!Number.isSafeInteger(scaled)) return null;

  // Half-up rounding on the first dropped digit.
  const rounded = nextDigit !== '' && Number(nextDigit) >= 5 ? scaled + 1 : scaled;
  return rounded;
}

/** Parses a money string ('1,305.50') into minor units for the given currency. */
export function parseMoney(input: string, currency: CurrencyCode): number | null {
  return parseDecimal(input, currencyDecimals(currency));
}

/**
 * Divides two integers and rounds **half away from zero**, staying in integer
 * space. Used everywhere a derived integer (total, price/L, cost/km) is produced.
 *
 * The rounding policy, stated once because every derived money figure in the app
 * inherits it:
 *
 *  · A quotient landing exactly on .5 goes UP in magnitude — `5/2 → 3`,
 *    `-5/2 → -3`, `1/2 → 1`, `-1/2 → -1`. It is never rounded to even
 *    (banker's rounding), and it is never truncated toward zero.
 *  · The rule is symmetric about zero, so negating an input negates the result.
 *    A refund and a charge of the same size round by the same amount.
 *  · Half-up-on-magnitude is what a rider reading a fuel receipt expects: a
 *    derived total of 1,000.015 is charged as 1,000.02, not 1,000.01.
 *
 * The consequence to know about is that derivation is not always reversible.
 * `total = round(litres × price)` then `price' = round(total ÷ litres)` returns
 * the original price for any fill of a litre or more, but for a fraction of a
 * litre the half that was rounded away is spread over too little volume to
 * recover. `normaliseFuelAmounts` (src/calculations/fuel.ts) is built around
 * that: the money the rider typed is what is stored, and the per-litre rate is
 * the figure allowed to move.
 */
export function divideRound(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  const sign = numerator < 0 !== denominator < 0 ? -1 : 1;
  const a = Math.abs(numerator);
  const b = Math.abs(denominator);
  return sign * Math.floor((a * 2 + b) / (b * 2));
}

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

/**
 * Formats minor units for display.
 *
 * The approved design writes money as `BDT 1,305` — the ISO code, a space, then
 * a grouped figure with no decimals unless asked for.
 */
export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  options: { decimals?: number; symbol?: boolean; sign?: boolean } = {},
): string {
  const scale = currencyDecimals(currency);
  const decimals = options.decimals ?? 0;
  const negative = minor < 0;
  const abs = Math.abs(minor);

  // Asking for more decimals than the currency has must PAD, not shift the
  // point: JPY has exponent 0, so 1,305 minor units are ¥1,305 and rendering
  // them at 2 dp is '1,305.00'. Leaving the figure unscaled and then dividing by
  // 10^decimals moved every 0-exponent price a hundredfold down the line.
  const shown =
    decimals >= scale ? abs * pow10(decimals - scale) : divideRound(abs, pow10(scale - decimals));
  const divisor = pow10(decimals);
  const whole = Math.floor(shown / divisor);
  const frac = shown - whole * divisor;

  const wholeText = String(whole).replace(GROUP, ',');
  const body = decimals > 0 ? `${wholeText}.${String(frac).padStart(decimals, '0')}` : wholeText;
  const prefix = options.symbol ? currencySymbol(currency) : `${currency} `;
  const signText = negative ? '-' : options.sign ? '+' : '';

  return `${signText}${prefix}${body}`;
}

/**
 * Compact form used by the Garage tile (`BDT 285k`). Falls back to the full
 * figure below 100,000 major units so nothing important is abbreviated away.
 */
export function formatMoneyCompact(
  minor: number,
  currency: CurrencyCode,
  options: { symbol?: boolean } = {},
): string {
  const major = Math.abs(minor) / pow10(currencyDecimals(currency));
  if (major < 100_000) return formatMoney(minor, currency, { symbol: options.symbol ?? false });
  const negative = minor < 0;
  // The Garage hero writes `৳285K`; the code form keeps its lower-case `k`.
  const prefix = options.symbol ? currencySymbol(currency) : `${currency} `;
  const thousands = options.symbol ? 'K' : 'k';
  if (major >= 10_000_000) {
    return `${negative ? '-' : ''}${prefix}${Math.round(major / 100_000) / 10}${options.symbol ? 'M' : 'm'}`;
  }
  return `${negative ? '-' : ''}${prefix}${Math.round(major / 1000)}${thousands}`;
}

/** Multiplies a per-unit rate by a quantity, staying exact. */
export function multiplyRate(rateMinorPerUnit: number, quantity: number, quantityScale: number): number {
  return divideRound(rateMinorPerUnit * quantity, quantityScale);
}

export function sumMinor(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

import type { CurrencyCode, DistanceUnit, MileageUnit, UnitPreferences, VolumeUnit } from '@/types';
import {
  distanceUnitLabel,
  efficiencyToDisplay,
  metresToDisplay,
  mileageUnitLabel,
  mlToDisplay,
  RATE_SCALE,
  volumeUnitLabel,
  type Efficiency,
} from '@/calculations/units';
import { currencyDecimals, currencySymbol, formatMoney, formatMoneyCompact } from '@/calculations/money';

/**
 * Every user-facing number passes through here.
 *
 * Two rules this module guarantees:
 *   1. `NaN`, `Infinity`, `undefined` and `null` never reach the screen —
 *      an unavailable figure renders as the em dash the design uses (requirement 12).
 *   2. Nothing is shown with more precision than it was measured with.
 */

/** The placeholder the design uses for a value that does not exist yet. */
export const NO_VALUE = '—';

function safe(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  const v = safe(value);
  if (v === null) return NO_VALUE;
  const fixed = v.toFixed(decimals);
  const [whole = '0', frac] = fixed.split('.');
  const grouped = whole.replace('-', '').replace(GROUP, ',');
  const sign = v < 0 ? '-' : '';
  return frac ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}

// --- distance ---------------------------------------------------------------

/** `'5,180'` — the bare figure, for when the unit is rendered separately. */
export function formatDistanceValue(metres: number | null | undefined, unit: DistanceUnit): string {
  const v = safe(metres);
  if (v === null) return NO_VALUE;
  return formatNumber(metresToDisplay(v, unit), 0);
}

/** `'5,180 km'`. */
export function formatDistance(metres: number | null | undefined, unit: DistanceUnit): string {
  const v = safe(metres);
  if (v === null) return NO_VALUE;
  return `${formatDistanceValue(v, unit)} ${distanceUnitLabel(unit)}`;
}

// --- volume -----------------------------------------------------------------

/** `'9.0'`. */
export function formatVolumeValue(ml: number | null | undefined, unit: VolumeUnit): string {
  const v = safe(ml);
  if (v === null) return NO_VALUE;
  return formatNumber(mlToDisplay(v, unit), 1);
}

/** `'9.0 L'`. */
export function formatVolume(ml: number | null | undefined, unit: VolumeUnit): string {
  const v = safe(ml);
  if (v === null) return NO_VALUE;
  return `${formatVolumeValue(v, unit)} ${volumeUnitLabel(unit)}`;
}

// --- efficiency -------------------------------------------------------------

/**
 * `'41.9'` — one decimal place, which is all a full-to-full measurement supports.
 * 335 km ÷ 8 L = 41.875 renders as 41.9 (requirement 17 / 75).
 */
export function formatMileageValue(e: Efficiency | null | undefined, unit: MileageUnit): string {
  if (!e) return NO_VALUE;
  const v = safe(efficiencyToDisplay(e, unit));
  if (v === null) return NO_VALUE;
  return formatNumber(v, 1);
}

/** `'41.9 km/L'`. */
export function formatMileage(e: Efficiency | null | undefined, unit: MileageUnit): string {
  if (!e) return NO_VALUE;
  return `${formatMileageValue(e, unit)} ${mileageUnitLabel(unit)}`;
}

// --- money ------------------------------------------------------------------

/** `'BDT 1,305'`. */
export function formatCurrency(
  minor: number | null | undefined,
  currency: CurrencyCode,
  decimals = 0,
): string {
  const v = safe(minor);
  if (v === null) return NO_VALUE;
  return formatMoney(v, currency, { decimals });
}

/** `'৳1,305'` — used where the design shows the symbol. */
export function formatCurrencySymbol(minor: number | null | undefined, currency: CurrencyCode): string {
  const v = safe(minor);
  if (v === null) return NO_VALUE;
  return formatMoney(v, currency, { symbol: true });
}

/** `'BDT 285k'`. */
export function formatCurrencyCompact(minor: number | null | undefined, currency: CurrencyCode): string {
  const v = safe(minor);
  if (v === null) return NO_VALUE;
  return formatMoneyCompact(v, currency);
}

/**
 * `'BDT 4.8'` — a rate stored scaled by `RATE_SCALE`, shown to one decimal.
 *
 * The divisor is the rate scale times the currency's own minor-unit scale, so a
 * zero-decimal currency would not be shown a hundred times too small.
 */
export function formatRate(scaledMinor: number | null | undefined, currency: CurrencyCode): string {
  const v = safe(scaledMinor);
  if (v === null) return NO_VALUE;
  const major = v / (RATE_SCALE * 10 ** currencyDecimals(currency));
  return `${currency} ${formatNumber(major, major >= 100 ? 0 : 1)}`;
}

/** `'BDT 145'` for a per-litre price. */
export function formatPricePerVolume(
  minorPerLitre: number | null | undefined,
  currency: CurrencyCode,
): string {
  const v = safe(minorPerLitre);
  if (v === null) return NO_VALUE;
  return formatMoney(v, currency, { decimals: v % 100 === 0 ? 0 : 2 });
}

// --- percentages ------------------------------------------------------------

export function formatPercent(value: number | null | undefined): string {
  const v = safe(value);
  if (v === null) return NO_VALUE;
  return `${Math.round(v)}%`;
}

// --- bundles ----------------------------------------------------------------

/** Convenience bundle so screens pass one object instead of four units. */
export function formatters(units: UnitPreferences, currency: CurrencyCode) {
  return {
    distance: (m: number | null | undefined) => formatDistance(m, units.distance),
    distanceValue: (m: number | null | undefined) => formatDistanceValue(m, units.distance),
    distanceUnit: distanceUnitLabel(units.distance),
    volume: (ml: number | null | undefined) => formatVolume(ml, units.volume),
    volumeValue: (ml: number | null | undefined) => formatVolumeValue(ml, units.volume),
    volumeUnit: volumeUnitLabel(units.volume),
    mileage: (e: Efficiency | null | undefined) => formatMileage(e, units.mileage),
    mileageValue: (e: Efficiency | null | undefined) => formatMileageValue(e, units.mileage),
    mileageUnit: mileageUnitLabel(units.mileage),
    money: (minor: number | null | undefined, decimals = 0) => formatCurrency(minor, currency, decimals),
    moneyCompact: (minor: number | null | undefined) => formatCurrencyCompact(minor, currency),
    rate: (scaled: number | null | undefined) => formatRate(scaled, currency),
    price: (minor: number | null | undefined) => formatPricePerVolume(minor, currency),
    symbol: currencySymbol(currency),
    currency,
  };
}

export type Formatters = ReturnType<typeof formatters>;

/**
 * The caveat that belongs beside an early cost-per-distance figure.
 *
 * The figure is always shown now — it is the rider's own arithmetic on their
 * own spending, and withholding it read as a broken app. What it needs is
 * context: over a short log one purchase moves it enormously, and saying so
 * turns a number that would mislead into one that teaches.
 */
export function costPerDistanceHint(
  trackedMetres: number,
  settledMetres: number,
  unit: DistanceUnit,
): string | null {
  if (trackedMetres >= settledMetres) return null;
  return (
    `Based on ${formatDistance(trackedMetres, unit)} so far, so one large purchase still moves it a lot. ` +
    `It settles around ${formatDistance(settledMetres, unit)}.`
  );
}

import { parseMoney } from '@/calculations/money';
import { parseDistanceToMetres, parseVolumeToMl , metresToDisplay, mlToDisplay } from '@/calculations/units';
import type { CurrencyCode, DistanceUnit, VolumeUnit } from '@/types';

/**
 * Form fields hold raw strings — that is what the rider typed, and rewriting it
 * under their cursor is hostile. Conversion to the canonical integer domain
 * happens here, once, on submit.
 *
 * Every parser returns `null` for "not a usable number", which the schema then
 * turns into the field's message.
 */

export function toMetres(value: string, unit: DistanceUnit): number | null {
  return value.trim() === '' ? null : parseDistanceToMetres(value, unit);
}

export function toMl(value: string, unit: VolumeUnit): number | null {
  return value.trim() === '' ? null : parseVolumeToMl(value, unit);
}

export function toMinor(value: string, currency: CurrencyCode): number | null {
  return value.trim() === '' ? null : parseMoney(value, currency);
}

export function toInteger(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed.replace(/,/g, ''))) return null;
  const parsed = Number(trimmed.replace(/,/g, ''));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function toTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Renders a stored value back into an editable field, without unit suffixes. */
export function fromMetres(metres: number | null, unit: DistanceUnit): string {
  if (metres === null) return '';
  const value = metresToDisplay(metres, unit);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function fromMl(ml: number | null, unit: VolumeUnit): string {
  if (ml === null) return '';
  const value = mlToDisplay(ml, unit);
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function fromMinor(minor: number | null, decimals: number): string {
  if (minor === null) return '';
  const divisor = 10 ** decimals;
  const whole = Math.floor(minor / divisor);
  const frac = minor - whole * divisor;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(decimals, '0').replace(/0+$/, '')}`;
}

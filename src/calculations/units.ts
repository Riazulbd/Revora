import type { DistanceUnit, MileageUnit, VolumeUnit } from '@/types';
import { divideRound, parseDecimal } from './money';

/**
 * All unit conversion lives here. Screens never contain a conversion formula
 * (requirement 65).
 *
 * Canonical storage: distance in integer metres, volume in integer millilitres.
 */

export const METRES_PER_KM = 1000;
export const METRES_PER_MILE = 1609.344;
export const ML_PER_LITRE = 1000;
export const ML_PER_US_GALLON = 3785.411784;
export const ML_PER_UK_GALLON = 4546.09;

// --- distance ---------------------------------------------------------------

export function metresToKm(metres: number): number {
  return metres / METRES_PER_KM;
}

export function metresToDisplay(metres: number, unit: DistanceUnit): number {
  return unit === 'mi' ? metres / METRES_PER_MILE : metres / METRES_PER_KM;
}

export function displayToMetres(value: number, unit: DistanceUnit): number {
  return Math.round(unit === 'mi' ? value * METRES_PER_MILE : value * METRES_PER_KM);
}

/** Parses an odometer field ("5,180" or "5180.4") into integer metres. */
export function parseDistanceToMetres(input: string, unit: DistanceUnit): number | null {
  const thousandths = parseDecimal(input, 3);
  if (thousandths === null) return null;
  return unit === 'mi'
    ? Math.round((thousandths / 1000) * METRES_PER_MILE)
    : thousandths; // 1 km = 1000 m, and the value is already in thousandths of a km
}

export function distanceUnitLabel(unit: DistanceUnit): string {
  return unit === 'mi' ? 'mi' : 'km';
}

// --- volume -----------------------------------------------------------------

export function mlToLitres(ml: number): number {
  return ml / ML_PER_LITRE;
}

export function mlToDisplay(ml: number, unit: VolumeUnit): number {
  if (unit === 'gal_us') return ml / ML_PER_US_GALLON;
  if (unit === 'gal_uk') return ml / ML_PER_UK_GALLON;
  return ml / ML_PER_LITRE;
}

export function displayToMl(value: number, unit: VolumeUnit): number {
  if (unit === 'gal_us') return Math.round(value * ML_PER_US_GALLON);
  if (unit === 'gal_uk') return Math.round(value * ML_PER_UK_GALLON);
  return Math.round(value * ML_PER_LITRE);
}

/** Parses a volume field ("9" or "9.35") into integer millilitres. */
export function parseVolumeToMl(input: string, unit: VolumeUnit): number | null {
  const thousandths = parseDecimal(input, 3);
  if (thousandths === null) return null;
  if (unit === 'gal_us') return Math.round((thousandths / 1000) * ML_PER_US_GALLON);
  if (unit === 'gal_uk') return Math.round((thousandths / 1000) * ML_PER_UK_GALLON);
  return thousandths;
}

export function volumeUnitLabel(unit: VolumeUnit): string {
  if (unit === 'gal_us') return 'gal';
  if (unit === 'gal_uk') return 'gal';
  return 'L';
}

// --- efficiency -------------------------------------------------------------

export type Efficiency = {
  /** Metres travelled per millilitre — the canonical, unit-free form. */
  metresPerMl: number;
};

export function efficiencyFrom(metres: number, millilitres: number): Efficiency | null {
  if (millilitres <= 0 || metres <= 0) return null;
  return { metresPerMl: metres / millilitres };
}

/** Converts canonical efficiency into the user's chosen presentation unit. */
export function efficiencyToDisplay(e: Efficiency, unit: MileageUnit): number {
  const kmPerLitre = (e.metresPerMl * ML_PER_LITRE) / METRES_PER_KM;
  switch (unit) {
    case 'l_per_100km':
      return kmPerLitre === 0 ? 0 : 100 / kmPerLitre;
    case 'mpg_us':
      return (e.metresPerMl * ML_PER_US_GALLON) / METRES_PER_MILE;
    case 'mpg_uk':
      return (e.metresPerMl * ML_PER_UK_GALLON) / METRES_PER_MILE;
    case 'km_per_l':
    default:
      return kmPerLitre;
  }
}

export function mileageUnitLabel(unit: MileageUnit): string {
  switch (unit) {
    case 'l_per_100km':
      return 'L/100km';
    case 'mpg_us':
      return 'MPG';
    case 'mpg_uk':
      return 'MPG';
    case 'km_per_l':
    default:
      return 'km/L';
  }
}

/**
 * `l_per_100km` is the one unit where a smaller number is better. Charts and
 * "best/worst" labels need to know.
 */
export function lowerIsBetter(unit: MileageUnit): boolean {
  return unit === 'l_per_100km';
}

/** The upper bound of the dashboard gauge, in the user's mileage unit. */
export function mileageGaugeMax(unit: MileageUnit): number {
  switch (unit) {
    case 'l_per_100km':
      return 12;
    case 'mpg_us':
    case 'mpg_uk':
      return 140;
    case 'km_per_l':
    default:
      return 60;
  }
}

// --- cost rates -------------------------------------------------------------

/**
 * Cost per unit distance, in minor units scaled by 100 so a fractional rate
 * such as `BDT 4.83/km` survives as an integer (483).
 */
export const RATE_SCALE = 100;

export function costPerDistance(totalMinor: number, metres: number, unit: DistanceUnit): number | null {
  if (metres <= 0) return null;
  const perMetreScaled = divideRound(totalMinor * RATE_SCALE * METRES_PER_KM, metres);
  return unit === 'mi' ? divideRound(perMetreScaled * Math.round(METRES_PER_MILE), METRES_PER_KM) : perMetreScaled;
}

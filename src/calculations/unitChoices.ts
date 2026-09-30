import type { MileageUnit, VolumeUnit } from '@/types';

/**
 * The Settings board draws Mileage as a three-way control — `km/L`,
 * `L/100km`, `mpg` — while the app carries four mileage units, because MPG
 * means a different gallon on either side of the Atlantic.
 *
 * Collapsing four units onto three segments, and expanding the chosen segment
 * back into a real unit, is a derivation: it belongs here rather than in the
 * screen (requirement 65 / CLAUDE.md rule 1).
 */

export type MileageChoice = 'km_per_l' | 'l_per_100km' | 'mpg';

/** The three segments the board draws, in board order. */
export const MILEAGE_CHOICES: readonly MileageChoice[] = ['km_per_l', 'l_per_100km', 'mpg'];

/** Which segment is lit for the unit the rider is actually on. */
export function mileageChoiceOf(unit: MileageUnit): MileageChoice {
  return unit === 'mpg_us' || unit === 'mpg_uk' ? 'mpg' : unit;
}

/** The segment's label, verbatim from the board. */
export function mileageChoiceLabel(choice: MileageChoice): string {
  switch (choice) {
    case 'l_per_100km':
      return 'L/100km';
    case 'mpg':
      return 'mpg';
    case 'km_per_l':
    default:
      return 'km/L';
  }
}

/**
 * The unit a segment stands for.
 *
 * `mpg` follows the gallon the rider already fills in: someone measuring in UK
 * gallons means imperial MPG, and switching them to the US figure would quietly
 * change every mileage on the screen by a fifth.
 */
export function mileageUnitForChoice(choice: MileageChoice, volume: VolumeUnit): MileageUnit {
  if (choice !== 'mpg') return choice;
  return volume === 'gal_uk' ? 'mpg_uk' : 'mpg_us';
}

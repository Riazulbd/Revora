import type { Accessory, Part } from '@/types';

/**
 * Moving a record between `parts` and `accessories`.
 *
 * They are separate collections with genuinely different shapes, because they
 * answer different questions. A part is fitted at an odometer reading and wears
 * out, so it carries installed odometer, expected life and a removal record. An
 * accessory is bought once and stays, so it carries a purchase and installation
 * cost and a photo.
 *
 * That means a conversion is lossy in one direction and incomplete in the
 * other, and the rider has to be told which before they agree to it. These
 * functions do the mapping and nothing else; the write that replaces one record
 * with the other belongs in the mutation, where it can be made atomic.
 */

/** What a conversion will discard, in the rider's words. Empty when nothing. */
export function conversionLosses(
  direction: 'partToAccessory' | 'accessoryToPart',
  record: Part | Accessory,
): string[] {
  if (direction === 'accessoryToPart') {
    const accessory = record as Accessory;
    return accessory.photoPath === null ? [] : ['the photo'];
  }

  const part = record as Part;
  const losses: string[] = [];
  if (part.expectedLifeMetres !== null) losses.push('its expected life');
  if (part.removedDate !== null || part.removedOdometerMetres !== null) losses.push('when it was removed');
  if (part.fittedBy !== null) losses.push('who fitted it');
  losses.push('the odometer reading it was fitted at');
  return losses;
}

/**
 * A part as an accessory. Purchase and installation are not split on a part, so
 * the whole cost becomes the purchase and installation is zero — inventing a
 * split would put figures in the ledger the rider never entered.
 */
export function partAsAccessory(part: Part, id: string, now: number): Accessory {
  return {
    id,
    userId: part.userId,
    bikeId: part.bikeId,
    createdAt: part.createdAt,
    updatedAt: now,
    name: part.name,
    purchaseCostMinor: part.costMinor,
    installationCostMinor: 0,
    currency: part.currency,
    date: part.installedDate,
    notes: part.notes,
    photoPath: null,
    linkedServiceId: part.linkedServiceId,
    clientRef: part.clientRef,
  };
}

/**
 * An accessory as a part, fitted at `odometerMetres`.
 *
 * The odometer is required from the caller rather than guessed: a part's whole
 * purpose is measuring wear from the reading it went on at, and a fabricated
 * one would produce a life projection built on nothing.
 */
export function accessoryAsPart(
  accessory: Accessory,
  id: string,
  odometerMetres: number,
  now: number,
): Part {
  return {
    id,
    userId: accessory.userId,
    bikeId: accessory.bikeId,
    createdAt: accessory.createdAt,
    updatedAt: now,
    name: accessory.name,
    installedOdometerMetres: odometerMetres,
    installedDate: accessory.date,
    expectedLifeMetres: null,
    costMinor: accessory.purchaseCostMinor + accessory.installationCostMinor,
    currency: accessory.currency,
    fittedBy: null,
    linkedServiceId: accessory.linkedServiceId,
    removedDate: null,
    removedOdometerMetres: null,
    notes: accessory.notes,
    clientRef: accessory.clientRef,
  };
}

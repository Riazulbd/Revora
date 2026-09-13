import type { CurrencyCode, FuelAdjustment, FuelEntry, IsoDate } from '@/types';
import { compareIso } from '@/utils/date';
import { divideRound } from './money';
import { ML_PER_LITRE } from './units';

/**
 * Fuel arithmetic. All of it is integer-exact: millilitres in, minor units out.
 */

/**
 * The net effect of the adjustments falling inside a date range.
 *
 * Signed: negative is fuel that left the tank without covering distance,
 * positive is fuel that went in without being logged as a fill. Adding this to
 * the fuel logged over an interval gives the fuel that actually did the work.
 *
 * The range is half-open on the left — an adjustment dated on the day the
 * interval opened belongs to the interval that just closed, not this one.
 */
export function adjustmentMlInRange(
  adjustments: readonly FuelAdjustment[],
  after: IsoDate,
  through: IsoDate,
): number {
  let total = 0;
  for (const a of adjustments) {
    if (compareIso(a.date, after) <= 0) continue;
    if (compareIso(a.date, through) > 0) continue;
    total += a.millilitres;
  }
  return total;
}

/** Total signed adjustment across every record, for headline figures. */
export function totalAdjustmentMl(adjustments: readonly FuelAdjustment[]): number {
  let total = 0;
  for (const a of adjustments) total += a.millilitres;
  return total;
}

/** `total = litres × price/L`, exact. */
export function totalFromLitresAndPrice(litresMl: number, pricePerLitreMinor: number): number {
  return divideRound(litresMl * pricePerLitreMinor, ML_PER_LITRE);
}

/** `price/L = total ÷ litres`, exact. */
export function priceFromLitresAndTotal(litresMl: number, totalCostMinor: number): number | null {
  if (litresMl <= 0) return null;
  return divideRound(totalCostMinor * ML_PER_LITRE, litresMl);
}

/** `litres = total ÷ price/L`, exact. */
export function litresFromPriceAndTotal(pricePerLitreMinor: number, totalCostMinor: number): number | null {
  if (pricePerLitreMinor <= 0) return null;
  return divideRound(totalCostMinor * ML_PER_LITRE, pricePerLitreMinor);
}

export type FuelFormFields = {
  litresMl: number | null;
  pricePerLitreMinor: number | null;
  totalCostMinor: number | null;
};

/**
 * Fills in whichever of litres / price / total is missing, given the other two.
 *
 * `lastEdited` decides which field is treated as derived when all three are
 * present, so typing in one box never silently rewrites the box you just left.
 */
export function deriveFuelAmounts(
  fields: FuelFormFields,
  lastEdited: 'litres' | 'price' | 'total' | null,
): FuelFormFields {
  const { litresMl, pricePerLitreMinor, totalCostMinor } = fields;

  const haveLitres = litresMl !== null && litresMl > 0;
  const havePrice = pricePerLitreMinor !== null && pricePerLitreMinor > 0;
  const haveTotal = totalCostMinor !== null && totalCostMinor > 0;

  if (haveLitres && havePrice && (!haveTotal || lastEdited === 'litres' || lastEdited === 'price')) {
    return { ...fields, totalCostMinor: totalFromLitresAndPrice(litresMl, pricePerLitreMinor) };
  }
  if (haveLitres && haveTotal && (!havePrice || lastEdited === 'total')) {
    return { ...fields, pricePerLitreMinor: priceFromLitresAndTotal(litresMl, totalCostMinor) };
  }
  if (havePrice && haveTotal && !haveLitres) {
    return { ...fields, litresMl: litresFromPriceAndTotal(pricePerLitreMinor, totalCostMinor) };
  }
  return fields;
}

/**
 * The single place a fuel entry's three money/volume fields are reconciled
 * before saving, so a stored record is always internally consistent.
 */
export function normaliseFuelAmounts(input: {
  litresMl: number;
  pricePerLitreMinor: number | null;
  totalCostMinor: number | null;
}): { litresMl: number; pricePerLitreMinor: number; totalCostMinor: number } | null {
  const { litresMl } = input;
  if (litresMl <= 0) return null;

  if (input.pricePerLitreMinor !== null && input.pricePerLitreMinor > 0) {
    return {
      litresMl,
      pricePerLitreMinor: input.pricePerLitreMinor,
      totalCostMinor: totalFromLitresAndPrice(litresMl, input.pricePerLitreMinor),
    };
  }
  if (input.totalCostMinor !== null && input.totalCostMinor > 0) {
    const price = priceFromLitresAndTotal(litresMl, input.totalCostMinor);
    if (price === null) return null;
    return { litresMl, pricePerLitreMinor: price, totalCostMinor: input.totalCostMinor };
  }
  return null;
}

/**
 * How many fills, how much fuel and how much money — over whatever set of
 * entries is handed in.
 *
 * One function for both the calendar month and the whole log, so the two can
 * never drift apart: a screen that shows "2 fills this month" beside "2 fills
 * all time" is showing the same arithmetic over different slices, not two
 * separate sums that happen to agree today.
 */
export type FuelTotals = { fills: number; litresMl: number; spendMinor: number };

export function fuelTotals(entries: readonly FuelEntry[]): FuelTotals {
  let litresMl = 0;
  let spendMinor = 0;
  for (const e of entries) {
    litresMl += e.litresMl;
    spendMinor += e.totalCostMinor;
  }
  return { fills: entries.length, litresMl, spendMinor };
}

/** Average price paid per litre across a set of fills, weighted by volume. */
export function averagePricePerLitre(entries: readonly FuelEntry[]): number | null {
  let ml = 0;
  let cost = 0;
  for (const e of entries) {
    ml += e.litresMl;
    cost += e.totalCostMinor;
  }
  if (ml <= 0) return null;
  return divideRound(cost * ML_PER_LITRE, ml);
}

/** Currency stamped on a fuel entry, falling back to the bike's currency. */
export function entryCurrency(entry: FuelEntry, fallback: CurrencyCode): CurrencyCode {
  return entry.currency ?? fallback;
}

export const ADJUSTMENT_REASON_LABEL: Record<FuelAdjustment['reason'], string> = {
  maintenance_loss: 'Service / idle use (not ridden)',
  leak: 'Suspected leak',
  drained: 'Drained',
  theft: 'Stolen',
  transferred: 'Transferred out',
  added_unlogged: 'Fuel added but not logged',
  other: 'Other',
};

/** Reasons that normally remove fuel, in the order the design lists them. */
export const REMOVING_REASONS: readonly FuelAdjustment['reason'][] = [
  'maintenance_loss',
  'leak',
  'drained',
  'transferred',
  'theft',
  'other',
];

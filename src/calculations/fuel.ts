import type { CurrencyCode, FuelAdjustment, FuelEntry, IsoDate } from '@/types';
import { compareIso } from '@/utils/date';
import { divideRound } from './money';
import { ML_PER_LITRE } from './units';

/**
 * Fuel arithmetic. All of it is integer-exact: millilitres in, minor units out.
 *
 * ## Rounding
 *
 * Every derived figure here goes through `divideRound`, which breaks an exact
 * half AWAY FROM ZERO (2.5 → 3, −2.5 → −3), never to even. See the policy note
 * on `divideRound` in `./money.ts`.
 *
 * ## Which adjustment reasons take fuel away, and which add it
 *
 * `FuelAdjustment.millilitres` is signed, and the sign — not the reason — is
 * what the engine arithmetic uses. The reason exists so the rider can see why,
 * and so the form can pick the sign for them. The agreed meaning of each:
 *
 * | reason             | sign | what it means for the fuel that did work      |
 * | ------------------ | ---- | --------------------------------------------- |
 * | `maintenance_loss` |  −   | burned idling or drained during a service      |
 * | `leak`             |  −   | escaped the tank or the line                   |
 * | `drained`          |  −   | deliberately emptied out of the tank           |
 * | `theft`            |  −   | siphoned off by someone else                   |
 * | `transferred`      |  −   | moved into another tank, can or machine        |
 * | `added_unlogged`   |  +   | went in without a fill being logged            |
 * | `other`            |  −   | spillage, waste, anything else that left       |
 *
 * `drained`, `theft` and `transferred` are three different stories about the
 * same arithmetic: fuel the rider bought that never propelled the bike. They
 * are kept apart so the rider's log reads truthfully, and `REMOVING_REASONS`
 * lists all three. Nothing downstream branches on which one it was.
 *
 * `added_unlogged` is the only reason that normally carries a positive volume.
 * It is fuel in the tank that no fill accounts for, so it INCREASES the fuel
 * charged to the interval — mileage measured over that stretch would otherwise
 * be flattered by distance covered on fuel nobody counted.
 *
 * The Android form (`src/app/fuel/add.tsx`) offers five of the seven rows:
 * `other`, `leak`, `maintenance_loss`, `transferred` and `added_unlogged`. Its
 * "Drained or transferred out" row writes `transferred`. `drained` and `theft`
 * therefore only ever arrive from the shared backend's web product; the engine
 * nets them exactly like the rest, and `ADJUSTMENT_REASON_LABEL` names them so
 * a record written there still reads properly here.
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

/**
 * Which adjustments fall inside the **closed** range `[from, through]`, by index.
 *
 * The half-open form above silently drops an adjustment whenever `after` and
 * `through` are the same day — a rider who fills up twice on one day and logs a
 * spill against the second fill had it counted nowhere at all, and the mileage
 * over that stretch came out flattered.
 *
 * The closed form cannot drop one, but on its own it would count a boundary day
 * twice, because consecutive intervals share the fill that ends one and opens
 * the next. So the caller claims: it walks its intervals oldest first and takes
 * only the adjustments no earlier interval has already taken. The rule that
 * falls out is *the earliest interval containing an adjustment's date owns it*,
 * which is the same attribution the half-open range made everywhere it worked,
 * and a real one everywhere it did not.
 */
export function adjustmentIndicesInRange(
  adjustments: readonly FuelAdjustment[],
  from: IsoDate,
  through: IsoDate,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < adjustments.length; i++) {
    const a = adjustments[i];
    if (a === undefined) continue;
    if (compareIso(a.date, from) < 0) continue;
    if (compareIso(a.date, through) > 0) continue;
    out.push(i);
  }
  return out;
}

/** Nets the adjustments at the given indices. */
export function adjustmentMlAt(adjustments: readonly FuelAdjustment[], indices: readonly number[]): number {
  let total = 0;
  for (const i of indices) total += adjustments[i]?.millilitres ?? 0;
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
 *
 * **The total wins.** When both a total and a price per litre arrive, the total
 * is the money that left the rider's pocket and the price is a rate derived
 * from it, so the total is stored untouched and the price is whatever divides
 * into it. Preferring the price instead re-multiplied it back out and stored a
 * different number from the receipt: 7 L at a derived BDT 142.86/L re-derives to
 * BDT 1,000.02 against the BDT 1,000.00 the rider actually paid, and every
 * litre count that does not divide its total evenly did the same.
 *
 * A trio that already agrees to the minor unit is stored exactly as entered, so
 * the ordinary "9 L × BDT 145 = BDT 1,305" case never has its rate rewritten by
 * a rounding trip it did not need.
 *
 * Only when no total was entered is one derived from the price.
 */
export function normaliseFuelAmounts(input: {
  litresMl: number;
  pricePerLitreMinor: number | null;
  totalCostMinor: number | null;
}): { litresMl: number; pricePerLitreMinor: number; totalCostMinor: number } | null {
  const { litresMl } = input;
  if (litresMl <= 0) return null;

  const price = input.pricePerLitreMinor !== null && input.pricePerLitreMinor > 0
    ? input.pricePerLitreMinor
    : null;
  const total = input.totalCostMinor !== null && input.totalCostMinor > 0 ? input.totalCostMinor : null;

  if (total !== null) {
    // An entered rate that already produces exactly this total is kept, so the
    // rate the rider read off the pump survives the save unchanged.
    if (price !== null && totalFromLitresAndPrice(litresMl, price) === total) {
      return { litresMl, pricePerLitreMinor: price, totalCostMinor: total };
    }
    const derived = priceFromLitresAndTotal(litresMl, total);
    if (derived === null) return null;
    return { litresMl, pricePerLitreMinor: derived, totalCostMinor: total };
  }

  if (price !== null) {
    return { litresMl, pricePerLitreMinor: price, totalCostMinor: totalFromLitresAndPrice(litresMl, price) };
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

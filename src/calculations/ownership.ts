import type { Bike, CostBasis, DistanceUnit, LedgerEntry } from '@/types';
import { breakdown, totalMinor, type SpendBreakdown } from './expenses';
import { costPerDistance } from './units';

/**
 * Ownership cost.
 *
 * Purchase price and running cost are kept strictly apart (requirement 32). The
 * purchase price is capital; it never inflates cost/km or monthly spending.
 */

export type OwnershipCost = {
  /** What the bike cost to buy. Null when the rider never entered it. */
  purchasePriceMinor: number | null;
  /** Everything spent keeping it on the road. */
  runningCostMinor: number;
  /** Purchase + running. Null when there is no purchase price to add. */
  totalOwnershipMinor: number | null;
  /** Which of the two the rider chose in Settings. */
  costBasis: CostBasis;
  /** Running cost excluding one-off accessories — what cost/distance divides. */
  consumptionCostMinor: number;
  /**
   * The figure every screen headlines, and the one `costPerDistanceScaled`
   * divides. Equals `runningCostMinor` on the `running` basis, and
   * `totalOwnershipMinor` on `total` when a purchase price exists.
   */
  headlineCostMinor: number;
  breakdown: SpendBreakdown;
  /**
   * Running cost per unit distance, scaled by 100 (so `483` means 4.83/km).
   * Null only when there is no distance to divide by at all.
   */
  costPerDistanceScaled: number | null;
  /**
   * Whether enough distance has accumulated that one purchase no longer sets
   * the answer. False does not withhold the figure — it earns it a caveat.
   */
  costPerDistanceSettled: boolean;
  distanceMetres: number;
};

/**
 * Distance below which cost-per-distance is still worth showing, but is worth
 * a caveat beside it.
 *
 * The figure is spending divided by kilometres, so over a short log whatever
 * the rider happened to buy dominates it: on a bike with 665 km tracked a
 * single suspension replacement puts running cost at BDT 24/km against a true
 * fuel cost near BDT 3/km.
 *
 * This used to withhold the figure entirely below a thousand kilometres. That
 * was the wrong call. A rider who has spent money and ridden 400 km is owed the
 * arithmetic on what they logged — it is their data, and it is not wrong, it is
 * just early. Withholding it reads as a broken app and teaches nothing, where a
 * figure with a sentence beside it teaches exactly the right lesson. The
 * constant now drives that sentence rather than a null.
 */
export const SETTLED_DISTANCE_FOR_COST_PER_UNIT = 1_000_000;

export function calculateOwnershipCost(input: {
  bike: Pick<Bike, 'purchasePriceMinor'>;
  ledger: readonly LedgerEntry[];
  distanceMetres: number;
  distanceUnit: DistanceUnit;
  /** Which figure the screens headline, and what cost-per-distance divides. */
  costBasis?: CostBasis;
}): OwnershipCost {
  const runningCostMinor = totalMinor(input.ledger);
  const purchasePriceMinor = input.bike.purchasePriceMinor;
  const totalOwnershipMinor = purchasePriceMinor === null ? null : purchasePriceMinor + runningCostMinor;

  /**
   * Cost per distance measures *consumption*, so accessories are left out.
   *
   * A tail box or a seat cushion is bought once and keeps its value; charging it
   * against the kilometres ridden since makes the figure swing wildly with how
   * long the rider has been tracking. On a bike with 665 km logged, one BDT
   * 6,000 accessory turned BDT ~3/km of real running cost into BDT 26.5/km.
   * They stay in the totals above, which is where a one-off belongs.
   */
  const consumptionMinor = totalMinor(input.ledger.filter((e) => e.source !== 'accessory'));

  // `total` only differs once a purchase price exists; without one there is
  // nothing to add, and silently showing running cost under a "total" label
  // would be a figure that does not mean what it says.
  const basis = input.costBasis ?? 'running';
  const headlineMinor = basis === 'total' && totalOwnershipMinor !== null
    ? totalOwnershipMinor
    : runningCostMinor;
  // On the total basis the purchase price is deliberately in the per-distance
  // figure — that is what "what has this bike cost me per km" means there.
  const perDistanceMinor = basis === 'total' && purchasePriceMinor !== null
    ? consumptionMinor + purchasePriceMinor
    : consumptionMinor;

  return {
    purchasePriceMinor,
    runningCostMinor,
    totalOwnershipMinor,
    costBasis: basis,
    consumptionCostMinor: consumptionMinor,
    headlineCostMinor: headlineMinor,
    breakdown: breakdown(input.ledger),
    costPerDistanceScaled: costPerDistance(perDistanceMinor, input.distanceMetres, input.distanceUnit),
    costPerDistanceSettled: input.distanceMetres >= SETTLED_DISTANCE_FOR_COST_PER_UNIT,
    distanceMetres: input.distanceMetres,
  };
}

/**
 * Company allowance accounting.
 *
 * The allowance offsets what the *rider* pays. It never reduces the true
 * operating cost, which is what cost/km and ownership cost are built from — the
 * Company bike screen states this contract explicitly.
 */
export type AllowanceSummary = {
  enabled: boolean;
  allowanceMinor: number;
  /** Fuel spend for the month the allowance applies to. */
  fuelSpendMinor: number;
  /** How much of the allowance the fuel spend consumed. */
  usedMinor: number;
  /** Fraction 0–1 of the allowance consumed. */
  usedFraction: number;
  /** What the rider actually paid out of pocket for fuel. */
  riderFuelCostMinor: number;
  /** Full operating cost for the month, unchanged by the allowance. */
  trueOperatingCostMinor: number;
};

export function calculateAllowance(input: {
  enabled: boolean;
  monthlyAllowanceMinor: number;
  monthFuelSpendMinor: number;
  monthTotalSpendMinor: number;
}): AllowanceSummary {
  const used = Math.min(input.monthFuelSpendMinor, input.monthlyAllowanceMinor);
  return {
    enabled: input.enabled,
    allowanceMinor: input.monthlyAllowanceMinor,
    fuelSpendMinor: input.monthFuelSpendMinor,
    usedMinor: used,
    usedFraction:
      input.monthlyAllowanceMinor > 0 ? Math.min(1, used / input.monthlyAllowanceMinor) : 0,
    riderFuelCostMinor: Math.max(0, input.monthFuelSpendMinor - input.monthlyAllowanceMinor),
    trueOperatingCostMinor: input.monthTotalSpendMinor,
  };
}

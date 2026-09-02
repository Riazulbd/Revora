import type { Bike, DistanceUnit, LedgerEntry } from '@/types';
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
  breakdown: SpendBreakdown;
  /**
   * Running cost per unit distance, scaled by 100 (so `483` means 4.83/km).
   * Null when there is not enough distance to divide by.
   */
  costPerDistanceScaled: number | null;
  distanceMetres: number;
};

export function calculateOwnershipCost(input: {
  bike: Pick<Bike, 'purchasePriceMinor'>;
  ledger: readonly LedgerEntry[];
  distanceMetres: number;
  distanceUnit: DistanceUnit;
}): OwnershipCost {
  const runningCostMinor = totalMinor(input.ledger);
  const purchasePriceMinor = input.bike.purchasePriceMinor;

  return {
    purchasePriceMinor,
    runningCostMinor,
    totalOwnershipMinor: purchasePriceMinor === null ? null : purchasePriceMinor + runningCostMinor,
    breakdown: breakdown(input.ledger),
    costPerDistanceScaled:
      input.distanceMetres > 0
        ? costPerDistance(runningCostMinor, input.distanceMetres, input.distanceUnit)
        : null,
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

import type { LedgerSource } from '@/types';
import type { AllowanceSummary } from './ownership';

/**
 * The two derived figures the redesigned Costs and Company allowance boards ask
 * for that no other calculation exposed.
 *
 * They live here rather than in a screen for the usual reason: the Costs tab
 * and the allowance screen must never disagree about what a line is called or
 * about how much of the month's allowance is left.
 */

/**
 * The Costs board's per-row category tag — `FUEL`, `SERVICE`, `EXPENSE`.
 *
 * `ledgerTag()` in `expenses.ts` still prints the older, longer `LINKED · FUEL`
 * form; the redesign draws the short word alone inside a 9.5px tag pill, and a
 * pill that wide would truncate. Both read the same `LedgerSource`, so a row
 * can never be tagged one thing here and another thing there.
 */
export function ledgerRowTag(source: LedgerSource): string {
  switch (source) {
    case 'fuel':
      return 'FUEL';
    case 'service':
      return 'SERVICE';
    case 'part':
      return 'PART';
    case 'accessory':
      return 'ACCESSORY';
    case 'maintenance':
      return 'MAINTENANCE';
    case 'manual':
      return 'EXPENSE';
  }
}

/**
 * How much of this month's allowance the fuel spend did not consume —
 * the board's "৳160 of allowance unused this month."
 *
 * Never negative: once the spend passes the allowance, nothing is unused and
 * the overspend is `riderFuelCostMinor`, which is a different sentence.
 * Integer minor units in, integer minor units out.
 */
export function allowanceUnusedMinor(summary: AllowanceSummary): number {
  return Math.max(0, summary.allowanceMinor - summary.usedMinor);
}

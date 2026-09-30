import type { PartLife } from './parts';

/**
 * How much of a part's life has been used.
 *
 * `calculatePartLife` reports what is *left*; the Parts board reports what is
 * *gone* — "85% used" beside the name, and a bar filled to the same fraction.
 * Both readings have to come from one place, or the number above the bar and
 * the bar itself can disagree after a rounding change.
 *
 * A part with no expected life has no used fraction at all. It is not 0% used
 * and it is not 100% used — nothing was ever recorded to measure it against,
 * which is why the board draws no bar and no percentage on that row.
 */

/** 0–100, or null when no expected life was recorded. An overdue part is 100. */
export function partUsedPercent(life: PartLife): number | null {
  if (life.remainingPercent === null) return null;
  if (life.isOverdue) return 100;
  return Math.max(0, Math.min(100, 100 - life.remainingPercent));
}

/** The same figure as a 0–1 fraction for the wear bar. Null when unmeasurable. */
export function partUsedFraction(life: PartLife): number | null {
  const percent = partUsedPercent(life);
  return percent === null ? null : percent / 100;
}

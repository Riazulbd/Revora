/**
 * What an accessory costs, while it is still being typed.
 *
 * `accessoryTotalMinor` in `expenses.ts` answers the same question for a saved
 * record; the Add accessory board asks it of two half-filled fields, so that it
 * can say "Added together once in Costs — ৳1,836, never counted twice" as the
 * rider types. The two must agree, which is why neither screen adds the numbers
 * itself.
 *
 * Both arguments are integer minor units. A purchase that has not been entered
 * yet gives null, not zero: the board's sentence then drops the figure rather
 * than promising a total of nothing.
 */
export function accessorySpendMinor(
  purchaseMinor: number | null,
  fittingMinor: number | null,
): number | null {
  if (purchaseMinor === null && fittingMinor === null) return null;
  return (purchaseMinor ?? 0) + (fittingMinor ?? 0);
}

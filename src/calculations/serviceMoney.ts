/**
 * What a service cost, and which box the rider is being asked to fill in.
 *
 * The Services boards draw two different money rows for the same form, and the
 * difference is not decoration:
 *
 *  · Nothing itemised — one box, "Total cost". The rider paid ৳1,800 and has no
 *    interest in splitting it.
 *  · Itemised — the box becomes "Labour", because the parts already carry their
 *    own prices under the maintenance items and asking for the total again
 *    would invite a figure that disagrees with its own breakdown.
 *
 * A workshop invoice beats both. If the rider recorded what the bill actually
 * said, that is the amount that left their pocket, whatever the parts add up to.
 * Everything is integer minor units, and nothing derived is stored — the total
 * is recomputed every time the form renders and every time it is saved.
 */

export type ServiceMoneyInput = {
  /** Labour, in minor units. Only meaningful once the parts are itemised. */
  labourMinor: number;
  /** One entry per maintenance item the rider ticked; null where unpriced. */
  itemCostsMinor: readonly (number | null)[];
  /** What the workshop's invoice said, when the estimate guard recorded one. */
  invoiceMinor: number | null;
  /** The figure typed into the single "Total cost" box. */
  typedTotalMinor: number | null;
};

export type ServiceMoney = {
  /** The parts side: the priced items, added up. */
  partsMinor: number;
  /**
   * True when the form should ask for labour rather than a total — the parts
   * are priced, or the invoice already answers the question.
   */
  itemised: boolean;
  totalMinor: number;
  /** Null when no figure has been given at all, so the button can stay bare. */
  knownTotalMinor: number | null;
};

export function serviceMoney(input: ServiceMoneyInput): ServiceMoney {
  const partsMinor = input.itemCostsMinor.reduce<number>((sum, cost) => sum + (cost ?? 0), 0);
  const itemised = partsMinor > 0 || input.invoiceMinor !== null;

  const known =
    input.invoiceMinor !== null
      ? input.invoiceMinor
      : itemised
        ? input.labourMinor + partsMinor
        : input.typedTotalMinor;

  return {
    partsMinor,
    itemised,
    totalMinor: known ?? 0,
    knownTotalMinor: known,
  };
}

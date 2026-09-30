import type { IsoDate, KnownProduct } from '@/types';
import { daysBetween, monthName, todayIso } from '@/utils/date';
import { productsFor } from './products';

/**
 * What the completion sheet offers under "Engine oil brand".
 *
 * The board is explicit about the promise: *"Brands you've logged before sort
 * first — nothing is suggested that you haven't used."* So the list is built
 * only from `knownProducts()`, which is itself derived from the rider's own
 * service items. There is no catalogue of oils in Revora, and adding one would
 * mean recommending a product nobody here has any basis to recommend.
 *
 * The note beside each row is the memory jog the board draws — "used last time",
 * "used in May". It is a fact about the rider's history, not a rating.
 */

export type BrandChoice = {
  /** Stable list key, from the product's own identity. */
  key: string;
  /** The brand as the rider would say it — "Shell Advance AX7 10W-40". */
  label: string;
  /** "used last time", "used in May", or null when a note would add nothing. */
  note: string | null;
  product: KnownProduct;
};

/**
 * Past this, naming the month stops helping: "used in May" two years ago reads
 * as though it were five months ago.
 */
export const RECENT_NOTE_DAYS = 365;

/** Brand, product and grade run together, exactly as the board prints them. */
export function brandLabel(product: Pick<KnownProduct, 'brand' | 'product' | 'spec'>): string {
  return [product.brand, product.product, product.spec]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(' ');
}

export function brandChoices(
  products: readonly KnownProduct[],
  category: string,
  today: IsoDate = todayIso(),
): BrandChoice[] {
  // `productsFor` preserves `knownProducts()`'s most-recent-first order, which
  // is what makes index 0 "used last time".
  return productsFor(products, category)
    .map((product, index) => {
      const ago = daysBetween(product.lastUsedOn, today);
      const note =
        index === 0
          ? 'used last time'
          : ago >= 0 && ago <= RECENT_NOTE_DAYS
            ? `used in ${monthName(product.lastUsedOn)}`
            : null;

      return {
        key: [product.brand, product.product, product.spec].join('|'),
        label: brandLabel(product),
        note,
        product,
      };
    })
    .filter((choice) => choice.label !== '');
}

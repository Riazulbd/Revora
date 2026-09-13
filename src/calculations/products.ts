import type { KnownProduct, ServiceItem, ServiceRecord } from '@/types';

/**
 * Products the rider has fitted before, so the next service can pick rather
 * than retype.
 *
 * Derived from their own service items, the same way workshops are derived from
 * services: history is the one source that cannot disagree with itself. There
 * is no separate catalogue to migrate, to keep in step, or to leave orphaned
 * when the service that referenced it is deleted.
 *
 * The identity of a product is brand + product + spec within a category, so
 * "AMSOIL / Metric Motorcycle Oil / 10W-30" and the same oil in 10W-40 are
 * different products, which is the distinction a rider actually cares about.
 */
const norm = (value: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const keyOf = (item: Pick<ServiceItem, 'category' | 'brand' | 'product' | 'spec'>) =>
  [norm(item.category), norm(item.brand), norm(item.product), norm(item.spec)].join(' | ');

export function knownProducts(
  items: readonly ServiceItem[],
  services: readonly ServiceRecord[],
): KnownProduct[] {
  const dateOf = new Map(services.map((service) => [service.id, service.date]));
  const found = new Map<string, KnownProduct>();

  for (const item of items) {
    // A line with nothing but a category is a completed job, not a product.
    if (!item.brand && !item.product && !item.spec) continue;
    const date = dateOf.get(item.serviceId);
    if (date === undefined) continue;

    const key = keyOf(item);
    const seen = found.get(key);
    if (seen === undefined) {
      found.set(key, {
        category: item.category,
        brand: item.brand,
        product: item.product,
        spec: item.spec,
        lastUsedOn: date,
        lastCostMinor: item.costMinor,
        timesUsed: 1,
      });
      continue;
    }
    seen.timesUsed += 1;
    if (date > seen.lastUsedOn) {
      seen.lastUsedOn = date;
      seen.lastCostMinor = item.costMinor;
    }
  }

  return [...found.values()].sort((a, b) =>
    a.lastUsedOn === b.lastUsedOn ? b.timesUsed - a.timesUsed : a.lastUsedOn < b.lastUsedOn ? 1 : -1,
  );
}

/** Those used for a given maintenance category, most recent first. */
export function productsFor(products: readonly KnownProduct[], category: string): KnownProduct[] {
  const needle = norm(category);
  return products.filter((product) => norm(product.category) === needle);
}

/** The product as a rider would say it, from whichever parts they recorded. */
export function describeProduct(
  product: Pick<KnownProduct, 'brand' | 'product' | 'spec'>,
): string {
  const name = [product.brand, product.product].filter(Boolean).join(' ').trim();
  return [name === '' ? null : name, product.spec].filter(Boolean).join(' · ');
}

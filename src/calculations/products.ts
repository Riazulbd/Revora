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

/**
 * What the brand / spec / product boxes should suggest for a given item.
 *
 * Every item row used to prompt with AMSOIL, 10W-30 and "Metric Motorcycle
 * Oil", whatever the item was. On a tyre row that reads as the app asking for
 * an oil viscosity grade — a rider reasonably concluded the form was showing
 * them the wrong item. A placeholder is an instruction about what belongs in
 * the box, so a wrong one is a wrong instruction.
 *
 * Matching is on words, not exact names, because rules are named by the rider:
 * "Tyre pressure & tread", "Front tyre", "Tires" all mean the same box.
 */
export type ItemPlaceholders = { brand: string; spec: string; product: string };

const PLACEHOLDERS: readonly { match: RegExp; hints: ItemPlaceholders }[] = [
  { match: /tyre|tire/, hints: { brand: 'MRF', spec: '90/90-17', product: 'Zapper FY' } },
  { match: /oil|lubric/, hints: { brand: 'AMSOIL', spec: '10W-30', product: 'Metric Motorcycle Oil' } },
  { match: /air filter|filter/, hints: { brand: 'K&N', spec: 'BA-2002', product: 'Air filter' } },
  { match: /brake|pad/, hints: { brand: 'Bosch', spec: 'Front', product: 'Brake pads' } },
  { match: /chain|sprocket/, hints: { brand: 'DID', spec: '428H', product: 'Chain & sprocket set' } },
  { match: /spark|plug/, hints: { brand: 'NGK', spec: 'CPR8EA-9', product: 'Spark plug' } },
  { match: /batter/, hints: { brand: 'Hamko', spec: '12V 5Ah', product: 'Battery' } },
  { match: /coolant/, hints: { brand: 'Motul', spec: 'Ready-mix', product: 'Coolant' } },
];

const GENERIC: ItemPlaceholders = { brand: 'Brand', spec: 'Grade or part no.', product: 'What was fitted' };

export function placeholdersFor(itemName: string): ItemPlaceholders {
  const needle = norm(itemName);
  return PLACEHOLDERS.find((entry) => entry.match.test(needle))?.hints ?? GENERIC;
}

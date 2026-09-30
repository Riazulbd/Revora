import type { ServiceItemUnit, ServiceRecord } from '@/types';

/**
 * What a service was about — Oil, Brakes, Chain, Tyres — derived from what the
 * rider wrote, never stored.
 *
 * The Services board filters the history with these chips and gives each row a
 * glyph of its own. Both are derived facts about a record, so they belong here
 * rather than in the screen: a rider who renames a service sees the chip and the
 * glyph follow, and there is no second copy to go stale (requirement 3).
 *
 * A service is matched on the words it already carries — its title and the
 * summary of the maintenance items it completed. "Brake pads + oil change"
 * genuinely covers two categories, and both filters must find it.
 */

export type ServiceCategory = 'oil' | 'brakes' | 'chain' | 'tyres' | 'other';

/** `all` is the board's first chip: no filter at all. */
export type ServiceFilter = ServiceCategory | 'all';

export const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, string> = {
  oil: 'Oil',
  brakes: 'Brakes',
  chain: 'Chain',
  tyres: 'Tyres',
  other: 'Other',
};

/** Chip order on the board: Oil · Brakes · Chain · Tyres, then the remainder. */
export const SERVICE_CATEGORY_ORDER: readonly ServiceCategory[] = [
  'oil',
  'brakes',
  'chain',
  'tyres',
  'other',
];

const MATCHERS: readonly { category: ServiceCategory; match: RegExp }[] = [
  { category: 'oil', match: /oil|lubric/ },
  { category: 'brakes', match: /brake|pad|rotor|caliper/ },
  { category: 'chain', match: /chain|sprocket/ },
  { category: 'tyres', match: /tyre|tire|tube|puncture|wheel/ },
];

type Describable = Pick<ServiceRecord, 'title' | 'itemsSummary'>;

const words = (service: Describable) =>
  `${service.title} ${service.itemsSummary ?? ''}`.toLowerCase();

/** Every category the service covers, in board order. Empty when none match. */
export function serviceCategories(service: Describable): ServiceCategory[] {
  const text = words(service);
  return MATCHERS.filter((entry) => entry.match.test(text)).map((entry) => entry.category);
}

/**
 * The one category the row's glyph stands for.
 *
 * A service that covers two — "Brake pads + oil change" — is not an oil change
 * and not a brake job, so it takes the general wrench rather than claiming to be
 * one of them. That is exactly what the board draws.
 */
export function primaryServiceCategory(service: Describable): ServiceCategory {
  const found = serviceCategories(service);
  return found.length === 1 ? (found[0] as ServiceCategory) : 'other';
}

/** True when this service belongs under that chip. `all` matches everything. */
export function serviceMatchesFilter(service: Describable, filter: ServiceFilter): boolean {
  if (filter === 'all') return true;
  const found = serviceCategories(service);
  if (filter === 'other') return found.length === 0;
  return found.includes(filter);
}

/** The chips worth drawing: only categories the rider's own history contains. */
export function serviceFilters(services: readonly Describable[]): ServiceFilter[] {
  const present = new Set<ServiceCategory>();
  for (const service of services) {
    const found = serviceCategories(service);
    if (found.length === 0) present.add('other');
    for (const category of found) present.add(category);
  }
  return ['all', ...SERVICE_CATEGORY_ORDER.filter((category) => present.has(category))];
}

export function filterServices<T extends Describable>(
  services: readonly T[],
  filter: ServiceFilter,
): T[] {
  return services.filter((service) => serviceMatchesFilter(service, filter));
}

/**
 * What a set of services cost, in minor units.
 *
 * The total under the filter chips is the sum of exactly the rows shown, so
 * filtering to Oil answers "what has oil cost me" rather than leaving the
 * all-time figure above three rows that do not add up to it.
 */
export function serviceSpendMinor(services: readonly Pick<ServiceRecord, 'totalCostMinor'>[]): number {
  return services.reduce((sum, service) => sum + service.totalCostMinor, 0);
}

/**
 * How a fitted item is counted.
 *
 * Fluids are bought and recorded by the litre — the board asks an oil row for
 * `Qty 1.2 L`. Everything else is a thing, and asking how many litres of air
 * filter went in would be nonsense. Rules are named by the rider, so this
 * matches on words rather than on an exact name.
 */
export function serviceItemUnit(itemName: string): ServiceItemUnit {
  return /oil|lubric|coolant|fluid/.test(itemName.toLowerCase()) ? 'litre' : 'piece';
}

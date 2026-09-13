import type { ServiceRecord } from '@/types';

/**
 * Workshops the rider has actually used, most recent first.
 *
 * Derived from the service history rather than kept in a collection of its own.
 * A workshop here is only a name, and history is the one source that can never
 * disagree with it: rename a service's workshop and this list follows, delete
 * the last service at a shop and it stops being offered.
 *
 * Matching is case- and space-insensitive so "Rahim Moto Care" and
 * "rahim moto  care" are one workshop, but the spelling the rider last used is
 * the one offered back.
 */
const normalise = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function recentWorkshops(services: readonly ServiceRecord[], limit = 12): string[] {
  const seen = new Map<string, string>();
  const ordered = [...services].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

  for (const service of ordered) {
    const name = service.workshop?.trim();
    if (!name) continue;
    const key = normalise(name);
    if (!seen.has(key)) seen.set(key, name.replace(/\s+/g, ' '));
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
}

/** Those matching what the rider has typed so far. Empty query returns all. */
export function matchingWorkshops(workshops: readonly string[], query: string): string[] {
  const needle = normalise(query);
  if (needle === '') return [...workshops];
  return workshops.filter((w) => normalise(w).includes(needle) && normalise(w) !== needle);
}

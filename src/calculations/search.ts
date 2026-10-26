import type {
  Accessory,
  DistanceUnit,
  FuelEntry,
  Part,
  ServiceItem,
  ServiceRecord,
  VaultDocument,
  VolumeUnit,
} from '@/types';
import { formatDistance, formatVolume } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import { describeProduct } from './products';

/**
 * Finding a record by typing what you remember about it.
 *
 * Search is what pays for the deeper screens. Cutting the fifth tab put the
 * document vault, the service history and the workshop records three and four
 * taps down, and that is only reasonable if a rider who remembers "Rahim" or
 * "10W-40" can get there directly instead of navigating.
 *
 * So this searches what riders actually remember, which is rarely a title: a
 * workshop's name, the oil they used last time, a station, a policy number,
 * something they wrote in a note. Matching is deliberately forgiving — case and
 * punctuation are stripped, and a query matches anywhere in the text — because
 * a rider hunting a receipt should not also have to spell it the way they did
 * eighteen months ago.
 *
 * What it does not do: search the web, other people's bikes, or invent
 * suggestions. Every result is one of the rider's own records.
 */
export type SearchResultKind = 'service' | 'fuel' | 'part' | 'accessory' | 'document' | 'product';

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  /** What the row leads with. */
  title: string;
  /** Date, odometer, workshop — enough to tell two similar records apart. */
  detail: string;
  /** Money in minor units, where the record carries one. */
  amountMinor: number | null;
  route: string;
  params?: Record<string, string>;
  /** Which word matched, so the row can show why it is here. */
  matched: string;
};

export type SearchGroup = { kind: SearchResultKind; label: string; results: SearchResult[] };

export const GROUP_LABEL: Record<SearchResultKind, string> = {
  service: 'Services',
  fuel: 'Fuel logs',
  part: 'Parts',
  accessory: 'Accessories',
  document: 'Documents',
  product: 'Products fitted',
};

/** Groups appear in the order a rider is most likely to be hunting. */
const GROUP_ORDER: SearchResultKind[] = ['service', 'document', 'product', 'part', 'fuel', 'accessory'];

/**
 * Case, accents and punctuation are noise in a search box. A rider looking for
 * "Rahim's Moto-Care" should not lose it to an apostrophe they typed
 * differently.
 */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Every term must appear somewhere, so "rahim brake" narrows rather than widens.
 *
 * Each term is tried against the normalised text and again against that text
 * with its separators removed. Part numbers and oil grades are the reason: a
 * rider who types `10w40` is looking for `10W-40`, and `cpr8ea9` for
 * `CPR8EA-9`. Nobody reproduces the hyphen, and losing the record over one
 * would make search useless for exactly the queries it is most needed for.
 */
function matches(haystacks: readonly (string | null | undefined)[], terms: readonly string[]): string | null {
  const fields = haystacks.filter((h): h is string => typeof h === 'string' && h.trim() !== '');
  const hay = normalise(fields.join(' '));
  if (hay === '') return null;
  const squashed = hay.replace(/ /g, '');
  if (!terms.every((term) => hay.includes(term) || squashed.includes(term.replace(/ /g, '')))) return null;

  // Report the field that carried the first term, so the row can say why.
  const first = terms[0] ?? '';
  return (
    fields.find((f) => normalise(f).includes(first) || normalise(f).replace(/ /g, '').includes(first)) ??
    fields[0] ??
    null
  );
}

export function searchRecords(
  query: string,
  data: {
    services: readonly ServiceRecord[];
    serviceItems: readonly ServiceItem[];
    fuelEntries: readonly FuelEntry[];
    parts: readonly Part[];
    accessories: readonly Accessory[];
    documents: readonly VaultDocument[];
  },
  limitPerGroup = 6,
  units: { distance: DistanceUnit; volume: VolumeUnit } = { distance: 'km', volume: 'L' },
): SearchGroup[] {
  const terms = normalise(query).split(' ').filter((t) => t !== '');
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  for (const service of data.services) {
    const hit = matches([service.title, service.workshop, service.notes, service.itemsSummary], terms);
    if (hit === null) continue;
    results.push({
      id: `service:${service.id}`,
      kind: 'service',
      title: service.title,
      // Figma: `Rahim Motors · 9 Sep · 34,520 km`.
      detail: [
        service.selfService ? 'Self-service' : (service.workshop ?? 'Workshop'),
        formatShortDate(service.date),
        service.odometerMetres === null ? null : formatDistance(service.odometerMetres, units.distance),
      ]
        .filter((piece): piece is string => piece !== null)
        .join(' · '),
      amountMinor: service.totalCostMinor,
      route: '/services',
      matched: hit,
    });
  }

  for (const item of data.serviceItems) {
    const label = describeProduct(item);
    const hit = matches([label, item.brand, item.product, item.spec, item.category], terms);
    if (hit === null || label === '') continue;
    results.push({
      id: `product:${item.id}`,
      kind: 'product',
      title: label,
      detail: item.category,
      amountMinor: item.costMinor,
      route: '/services',
      matched: hit,
    });
  }

  for (const document of data.documents) {
    const hit = matches([document.title, document.reference, document.notes, document.customKindLabel], terms);
    if (hit === null) continue;
    results.push({
      id: `document:${document.id}`,
      kind: 'document',
      title: document.title,
      detail: document.reference ?? 'No number recorded',
      amountMinor: null,
      route: '/records/document',
      params: { id: document.id },
      matched: hit,
    });
  }

  for (const part of data.parts) {
    const hit = matches([part.name, part.fittedBy, part.notes], terms);
    if (hit === null) continue;
    results.push({
      id: `part:${part.id}`,
      kind: 'part',
      title: part.name,
      // Figma: `Fitted 9 Sep · inside that service's total`.
      detail: `Fitted ${formatShortDate(part.installedDate)}${part.linkedServiceId === null ? '' : ' · inside that service’s total'}`,
      amountMinor: part.linkedServiceId === null ? part.costMinor : null,
      route: '/parts/[id]',
      params: { id: part.id },
      matched: hit,
    });
  }

  for (const entry of data.fuelEntries) {
    const hit = matches([entry.station, entry.notes], terms);
    if (hit === null) continue;
    results.push({
      id: `fuel:${entry.id}`,
      kind: 'fuel',
      title: entry.station ?? 'Fuel log',
      // Figma: `13 Sep · 8.2 L · Full tank`.
      detail: `${formatShortDate(entry.date)} · ${formatVolume(entry.litresMl, units.volume)} · ${
        entry.fillType === 'full' ? 'Full tank' : entry.fillType === 'partial' ? 'Partial fill' : 'Fill'
      }`,
      amountMinor: entry.totalCostMinor,
      route: '/fuel/[id]',
      params: { id: entry.id },
      matched: hit,
    });
  }

  for (const accessory of data.accessories) {
    const hit = matches([accessory.name, accessory.notes], terms);
    if (hit === null) continue;
    results.push({
      id: `accessory:${accessory.id}`,
      kind: 'accessory',
      title: accessory.name,
      detail: `Fitted ${formatShortDate(accessory.date)}`,
      amountMinor: accessory.purchaseCostMinor + accessory.installationCostMinor,
      route: '/accessories',
      matched: hit,
    });
  }

  return GROUP_ORDER.map((kind) => ({
    kind,
    label: GROUP_LABEL[kind],
    results: results.filter((r) => r.kind === kind).slice(0, limitPerGroup),
  })).filter((group) => group.results.length > 0);
}

/** Total across every group, for the "N results" line. */
export function countResults(groups: readonly SearchGroup[]): number {
  return groups.reduce((sum, g) => sum + g.results.length, 0);
}

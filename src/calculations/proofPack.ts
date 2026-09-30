import type { IsoDate, VaultDocument } from '@/types';
import { formatMonthLong, monthKey } from '@/utils/date';
import type { BikeAnalytics } from './analytics';
import { proofCertificate, type AttestedRecord, type ProofCertificate } from './certificate';

/**
 * What a Proof Pack will contain, worked out before it is built.
 *
 * The screen has to tell the rider what is going into the PDF — how many
 * services, how many fills, how many documents, which months it covers — and
 * then, once it exists, has to repeat the certificate's own figures back. Both
 * are derived, so neither may be counted in a component.
 *
 * `proofPackRecords` is the same set the PDF attests to, in the same order:
 * every record the document prints and nothing else. Counting a record the
 * page never shows would make the stamp claim more than a reader can check,
 * and the reference is a fingerprint of exactly this list.
 */

/** Fuel rows are capped in the PDF so a long log does not run to fifty pages. */
export const PROOF_PACK_FUEL_ROW_LIMIT = 40;

/**
 * Under this many months of history the pack says so on its face.
 *
 * A thin log is not a defect and is not hidden: the coverage dates are printed
 * either way, and a buyer can read them. The warning exists so the seller is
 * not surprised by what the buyer notices.
 */
export const PROOF_PACK_THIN_MONTHS = 6;

export function proofPackRecords(input: {
  analytics: BikeAnalytics;
  documents: readonly VaultDocument[];
}): AttestedRecord[] {
  const { analytics, documents } = input;
  return [
    ...analytics.services.all.map((s) => ({
      kind: 'service',
      id: s.id,
      date: s.date,
      figure: s.totalCostMinor,
    })),
    ...analytics.fuel.entries.slice(0, PROOF_PACK_FUEL_ROW_LIMIT).map((f) => ({
      kind: 'fuel',
      id: f.id,
      date: f.date,
      figure: f.odometerMetres,
    })),
    ...[...analytics.parts.active, ...analytics.parts.removed].map(({ part }) => ({
      kind: 'part',
      id: part.id,
      date: part.installedDate,
      figure: part.installedOdometerMetres,
    })),
    ...documents.map((d) => ({
      kind: 'document',
      id: d.id,
      date: d.expiresOn,
      figure: null,
    })),
  ];
}

/** Whole months between two dates — Jun to Sep is 3, which is what "3 months of records" means. */
export function monthsBetween(first: IsoDate, last: IsoDate): number {
  const y = Number(last.slice(0, 4)) - Number(first.slice(0, 4));
  const m = Number(last.slice(5, 7)) - Number(first.slice(5, 7));
  return Math.max(0, y * 12 + m);
}

export type ProofPackSummary = {
  certificate: ProofCertificate;
  services: number;
  fuelLogs: number;
  parts: number;
  documents: number;
  /** The INCLUDED list, in the order the board prints it. */
  included: string[];
  /** `'Feb 2022 – Sep 2026'`, or `null` where nothing carries a date. */
  coverage: string | null;
  /** `null` where the span cannot be worked out — never `0`. */
  monthsCovered: number | null;
  isThin: boolean;
  /** Nothing to attest to: the pack would prove nothing and must not be offered. */
  isEmpty: boolean;
};

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function proofPackSummary(input: {
  analytics: BikeAnalytics;
  documents: readonly VaultDocument[];
}): ProofPackSummary {
  const { analytics, documents } = input;

  const records = proofPackRecords(input);
  const certificate = proofCertificate(records);

  const services = analytics.services.all.length;
  const fuelLogs = Math.min(analytics.fuel.entries.length, PROOF_PACK_FUEL_ROW_LIMIT);
  const parts = analytics.parts.active.length + analytics.parts.removed.length;
  const documentCount = documents.length;

  const included = ['Motorcycle details'];
  if (services > 0) included.push(plural(services, 'service'));
  if (fuelLogs > 0) included.push(`${plural(fuelLogs, 'fuel log')} with mileage`);
  if (parts > 0) included.push('parts history');
  if (documentCount > 0) included.push(plural(documentCount, 'document'));

  const { firstDate, lastDate } = certificate;
  const coverage =
    firstDate === null || lastDate === null
      ? null
      : firstDate === lastDate
        ? formatMonthLong(monthKey(firstDate))
        : `${formatMonthLong(monthKey(firstDate))} – ${formatMonthLong(monthKey(lastDate))}`;

  const monthsCovered = firstDate === null || lastDate === null ? null : monthsBetween(firstDate, lastDate);

  return {
    certificate,
    services,
    fuelLogs,
    parts,
    documents: documentCount,
    included,
    coverage,
    monthsCovered,
    isThin: monthsCovered !== null && monthsCovered < PROOF_PACK_THIN_MONTHS,
    isEmpty: certificate.recordCount === 0,
  };
}

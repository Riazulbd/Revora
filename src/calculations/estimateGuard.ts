import type { ServiceRecord } from '@/types';

/**
 * The estimate guard: what a workshop quoted against what it actually invoiced.
 *
 * A job that grew in the workshop is invisible inside a single total, so Revora
 * keeps the quote the rider was given and compares it with the bill. Everything
 * here is recomputed from the service records on read — nothing about a
 * comparison is stored, so correcting an old invoice corrects every figure that
 * mentions it (requirement 3).
 *
 * A visit only enters the comparison when a quote was recorded. Visits without
 * one are counted separately and said out loud on the board, because a
 * comparison over 6 of 14 visits that presents itself as "your workshops" would
 * be a lie of omission.
 */

/** How the difference should read: red is over, amber is barely over, green is under. */
export type EstimateSeverity = 'good' | 'neutral' | 'warn' | 'bad';

/**
 * Over by a tenth or more of the quote is news; over by less is rounding,
 * a shop supply charge, a fuel top-up. The board draws exactly this split —
 * +৳1,700 on a ৳6,400 quote in red, +৳150 on ৳2,800 in amber.
 */
const SERIOUS_OVERRUN = 0.1;

export function estimateSeverity(quotedMinor: number, invoicedMinor: number): EstimateSeverity {
  const delta = invoicedMinor - quotedMinor;
  if (delta < 0) return 'good';
  if (delta === 0) return 'neutral';
  if (quotedMinor <= 0) return 'bad';
  return delta / quotedMinor >= SERIOUS_OVERRUN ? 'bad' : 'warn';
}

export type WorkshopComparison = {
  workshop: string;
  /** Visits at this workshop that recorded a quote. */
  comparedVisits: number;
  quotedMinor: number;
  invoicedMinor: number;
  /** Positive means the invoice came in over the quote. */
  deltaMinor: number;
  severity: EstimateSeverity;
};

export type EstimateGuardSummary = {
  comparedVisits: number;
  /**
   * Visits with no quote to compare — every other service, self-service
   * included, since the board's own arithmetic is compared + other = all.
   */
  uncomparedVisits: number;
  /** Null rather than zero when nothing can be compared (requirement 12). */
  quotedMinor: number | null;
  invoicedMinor: number | null;
  deltaMinor: number | null;
  severity: EstimateSeverity;
  byWorkshop: WorkshopComparison[];
};

const UNNAMED = 'Workshop';

/** One workshop however it was spaced or capitalised, keeping the latest spelling. */
const normalise = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function summariseEstimates(services: readonly ServiceRecord[]): EstimateGuardSummary {
  const compared = services.filter(
    (service) => !service.selfService && service.estimate?.quoteMinor != null,
  );

  const groups = new Map<string, WorkshopComparison>();
  let quotedMinor = 0;
  let invoicedMinor = 0;

  // Newest first, so the spelling a rider used most recently is the one shown.
  const ordered = [...compared].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt,
  );

  for (const service of ordered) {
    const quote = service.estimate?.quoteMinor ?? 0;
    quotedMinor += quote;
    invoicedMinor += service.totalCostMinor;

    const name = service.workshop?.trim().replace(/\s+/g, ' ') || UNNAMED;
    const key = normalise(name);
    const seen = groups.get(key);
    if (seen === undefined) {
      groups.set(key, {
        workshop: name,
        comparedVisits: 1,
        quotedMinor: quote,
        invoicedMinor: service.totalCostMinor,
        deltaMinor: service.totalCostMinor - quote,
        severity: estimateSeverity(quote, service.totalCostMinor),
      });
      continue;
    }
    seen.comparedVisits += 1;
    seen.quotedMinor += quote;
    seen.invoicedMinor += service.totalCostMinor;
    seen.deltaMinor = seen.invoicedMinor - seen.quotedMinor;
    seen.severity = estimateSeverity(seen.quotedMinor, seen.invoicedMinor);
  }

  // The worst overrun first: this screen exists to surface it.
  const byWorkshop = [...groups.values()].sort(
    (a, b) => b.deltaMinor - a.deltaMinor || b.comparedVisits - a.comparedVisits,
  );

  if (compared.length === 0) {
    return {
      comparedVisits: 0,
      uncomparedVisits: services.length,
      quotedMinor: null,
      invoicedMinor: null,
      deltaMinor: null,
      severity: 'neutral',
      byWorkshop,
    };
  }

  return {
    comparedVisits: compared.length,
    uncomparedVisits: services.length - compared.length,
    quotedMinor,
    invoicedMinor,
    deltaMinor: invoicedMinor - quotedMinor,
    severity: estimateSeverity(quotedMinor, invoicedMinor),
    byWorkshop,
  };
}

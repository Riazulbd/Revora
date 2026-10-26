import type { IsoDate, ServiceRecord } from '@/types';
import { monthKey, recentMonthKeys } from '@/utils/date';

/**
 * What the last year of workshop visits cost — the dark card at the top of the
 * Services history.
 *
 * Twelve calendar months ending with the current one, each month's total, the
 * number of visits in the window and the average per visit. All of it is
 * recomputed from the service records on read, so correcting one invoice
 * corrects the card (requirement 3). An average over no visits is null, never
 * zero (requirement 12).
 */

export type ServiceSpendSummary = {
  /** Visits inside the window. */
  visits: number;
  totalMinor: number;
  /** Mean cost per visit; null with no visits. */
  averageMinor: number | null;
  /** Oldest first, ending with the current month. */
  months: readonly { key: string; minor: number }[];
};

export const SERVICE_SPEND_MONTHS = 12;

export function serviceSpendSummary(
  services: readonly Pick<ServiceRecord, 'date' | 'totalCostMinor'>[],
  today: IsoDate,
  months: number = SERVICE_SPEND_MONTHS,
): ServiceSpendSummary {
  const keys = recentMonthKeys(months, monthKey(today));
  const byMonth = new Map<string, number>(keys.map((key) => [key, 0]));

  let visits = 0;
  let totalMinor = 0;
  for (const service of services) {
    const key = monthKey(service.date);
    if (!byMonth.has(key)) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + service.totalCostMinor);
    visits += 1;
    totalMinor += service.totalCostMinor;
  }

  return {
    visits,
    totalMinor,
    averageMinor: visits === 0 ? null : Math.round(totalMinor / visits),
    months: keys.map((key) => ({ key, minor: byMonth.get(key) ?? 0 })),
  };
}

import type { BikeAnalytics } from '@/calculations/analytics';
import { formatCurrency, formatDistance, formatMileage, formatVolume } from '@/utils/format';
import type { UnitPreferences } from '@/types';

/**
 * The rider's figures, as JSON, for the server-side assistant.
 *
 * Every value here is **already computed** by `src/calculations/` and formatted
 * by `src/utils/format.ts` — the model is given finished strings to quote, never
 * raw numbers to do arithmetic on. That is what keeps a language model from
 * inventing a mileage figure that disagrees with the Dashboard.
 *
 * It is also deliberately small. Sending the ledger itself would be tens of
 * thousands of tokens per question; this is a couple of thousand, and it is the
 * same summary the screens render.
 */

const RECENT_FILLS = 8;
const RECENT_SPEND = 8;

export type AssistantContext = ReturnType<typeof buildAssistantContext>;

export function buildAssistantContext(
  analytics: BikeAnalytics,
  units: UnitPreferences,
  bike: { nickname: string; manufacturer: string; model: string; year: number | null },
  documents: readonly { title: string; expiresOn: string | null; status: string }[],
) {
  const money = (minor: number | null | undefined) => formatCurrency(minor, analytics.currency);

  return {
    today: analytics.today,
    bike: {
      name: bike.nickname,
      make: `${bike.manufacturer} ${bike.model}`.trim(),
      year: bike.year,
      odometer: formatDistance(analytics.odometer.currentMetres, units.distance),
      odometerUpdated: analytics.odometer.latest?.date ?? null,
      distanceTracked: formatDistance(analytics.odometer.totalDistanceMetres, units.distance),
    },
    mileage: {
      average: formatMileage(analytics.mileage.average, units.mileage),
      lastFive: formatMileage(analytics.mileage.lastFive, units.mileage),
      best: formatMileage(analytics.mileage.best?.efficiency ?? null, units.mileage),
      worst: formatMileage(analytics.mileage.worst?.efficiency ?? null, units.mileage),
      intervals: analytics.mileage.count,
      reliable: analytics.hasReliableStats,
    },
    costs: {
      runningCost: money(analytics.ownership.runningCostMinor),
      thisMonth: money(analytics.thisMonthMinor),
      perDistance: analytics.ownership.costPerDistanceScaled === null ? null
        : `${money(Math.round(analytics.ownership.costPerDistanceScaled / 1000))} per ${units.distance}`,
      fuelThisMonth: money(analytics.fuel.thisMonthSpendMinor),
      averagePricePerLitre: money(analytics.fuel.averagePricePerLitreMinor),
    },
    maintenance: {
      overdue: analytics.maintenance.counts.overdue,
      dueSoon: analytics.maintenance.counts.due_soon,
      rules: analytics.maintenance.rules.slice(0, 10).map((r) => ({
        name: r.rule.name,
        status: r.status.kind,
        dueOn: r.status.dueOnDate,
        daysRemaining: r.status.remainingDays,
      })),
    },
    recentFills: analytics.fuel.entries.slice(0, RECENT_FILLS).map((f) => ({
      date: f.date,
      litres: formatVolume(f.litresMl, units.volume),
      cost: money(f.totalCostMinor),
      odometer: formatDistance(f.odometerMetres, units.distance),
      station: f.station,
    })),
    recentSpend: analytics.ledger.slice(0, RECENT_SPEND).map((e) => ({
      date: e.date,
      what: e.label,
      amount: money(e.amountMinor),
    })),
    documents: documents.slice(0, 8),
  };
}

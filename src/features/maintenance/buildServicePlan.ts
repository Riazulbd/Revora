import type { BikeAnalytics } from '@/calculations/analytics';
import type { IsoDate } from '@/types';

/**
 * The service plan.
 *
 * Revora has no manufacturer schedule database, so this is built from what the
 * rider actually has: their own maintenance rules, projected forward, and the
 * services they have already recorded. Nothing on this screen is invented — an
 * owner-manual schedule the app does not have would be exactly the kind of made-up
 * data this product refuses to show.
 */

export type PlanItem = { label: string; done: boolean };

export type PlanMilestone = {
  id: string;
  /** Odometer the milestone sits at, in metres. Null for a date-only entry. */
  metres: number | null;
  title: string;
  /** 'DONE · 12 Jul' or 'IN 2,820 km'. */
  statusLabel: string;
  status: 'done' | 'upcoming';
  date: IsoDate | null;
  items: PlanItem[];
};

/** Milestones within this distance of each other are shown as one service. */
const BUCKET_METRES = 500_000;

export function buildServicePlan(analytics: BikeAnalytics): {
  past: PlanMilestone[];
  upcoming: PlanMilestone[];
} {
  const current = analytics.odometer.currentMetres;

  // --- what is already done -------------------------------------------------
  const past: PlanMilestone[] = analytics.services.all.map((service) => ({
    id: `service:${service.id}`,
    metres: service.odometerMetres,
    title: service.title,
    statusLabel: 'DONE',
    status: 'done' as const,
    date: service.date,
    items: service.itemsSummary
      ? service.itemsSummary.split(',').map((label) => ({ label: label.trim(), done: true }))
      : [],
  }));

  // --- what is coming -------------------------------------------------------
  const dueRules = analytics.maintenance.rules
    .filter((r) => r.status.dueAtMetres !== null)
    .map((r) => ({ rule: r.rule, dueAt: r.status.dueAtMetres as number, remaining: r.status.remainingMetres }))
    .sort((a, b) => a.dueAt - b.dueAt);

  const buckets: { metres: number; rules: typeof dueRules }[] = [];
  for (const entry of dueRules) {
    const bucket = buckets[buckets.length - 1];
    if (bucket && entry.dueAt - bucket.metres <= BUCKET_METRES) {
      bucket.rules.push(entry);
    } else {
      buckets.push({ metres: entry.dueAt, rules: [entry] });
    }
  }

  const upcoming: PlanMilestone[] = buckets.map((bucket, index) => {
    const remaining = current === null ? null : bucket.metres - current;
    return {
      id: `milestone:${bucket.metres}:${index}`,
      metres: bucket.metres,
      title: bucket.rules.length === 1 ? (bucket.rules[0]?.rule.name ?? 'Service') : 'Service',
      statusLabel:
        remaining === null ? 'SCHEDULED' : remaining < 0 ? 'OVERDUE' : 'UPCOMING',
      status: 'upcoming' as const,
      date: null,
      items: bucket.rules.map((r) => ({ label: r.rule.name, done: false })),
    };
  });

  return { past, upcoming };
}

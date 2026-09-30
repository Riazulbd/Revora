import type { MaintenanceStatus } from '@/calculations/maintenance';
import type { BadgeTone } from '@/components';
import type { MaintenanceRule, UnitPreferences } from '@/types';
import { formatDistance } from '@/utils/format';
import { formatLongDate } from '@/utils/date';

/**
 * The supporting line under a rule name, e.g. "in 500 km · every 1,000 km".
 *
 * When a rule has both a distance and a time interval, the line leads with
 * whichever is closer, because that is the one about to fall due.
 */
export function describeRule(
  rule: MaintenanceRule,
  status: MaintenanceStatus,
  units: UnitPreferences,
): string {
  if (status.neverCompleted) {
    return rule.intervalMetres !== null
      ? `Every ${formatDistance(rule.intervalMetres, units.distance)} · never completed`
      : rule.intervalDays !== null
        ? `Every ${rule.intervalDays} days · never completed`
        : 'No interval set';
  }

  const parts: string[] = [];

  const distanceUrgency =
    status.remainingMetres !== null && rule.intervalMetres !== null
      ? status.remainingMetres / rule.intervalMetres
      : Number.POSITIVE_INFINITY;
  const timeUrgency =
    status.remainingDays !== null && rule.intervalDays !== null
      ? status.remainingDays / rule.intervalDays
      : Number.POSITIVE_INFINITY;

  const distanceFirst = distanceUrgency <= timeUrgency;

  const distanceLine =
    status.remainingMetres === null || rule.intervalMetres === null
      ? null
      : status.remainingMetres < 0
        ? `overdue by ${formatDistance(-status.remainingMetres, units.distance)}`
        : `in ${formatDistance(status.remainingMetres, units.distance)}`;

  const timeLine =
    status.remainingDays === null || rule.intervalDays === null
      ? null
      : status.remainingDays < 0
        ? `overdue by ${Math.abs(status.remainingDays)} days`
        : `in ${status.remainingDays} days`;

  const lead = distanceFirst ? distanceLine : timeLine;
  if (lead) parts.push(lead);

  if (rule.intervalMetres !== null) {
    parts.push(`every ${formatDistance(rule.intervalMetres, units.distance)}`);
  } else if (rule.intervalDays !== null) {
    parts.push(`every ${rule.intervalDays} days`);
  }

  if (rule.intervalMetres !== null && rule.intervalDays !== null) {
    parts.push(`or ${rule.intervalDays} days`);
  }

  return parts.join(' · ');
}

export function describeLastCompleted(rule: MaintenanceRule, units: UnitPreferences): string {
  if (rule.lastCompletedMetres === null && rule.lastCompletedDate === null) return 'Never completed';
  const bits: string[] = [];
  if (rule.lastCompletedMetres !== null) bits.push(formatDistance(rule.lastCompletedMetres, units.distance));
  if (rule.lastCompletedDate !== null) bits.push(formatLongDate(rule.lastCompletedDate));
  return bits.join(' · ');
}

/**
 * How often a rule comes round, and where it last stood — the supporting line
 * the Maintenance board draws under a rule name:
 *
 *   `Every 3,000 km or 3 months · last at 31,402 km`
 *
 * It deliberately says nothing about *how close* the rule is. On the board that
 * job belongs to the pill on the right ("310 KM OVER", "DUE IN 240 KM"), and
 * saying it twice in two different shapes is how a row ends up contradicting
 * itself at a glance.
 */
export function describeSchedule(rule: MaintenanceRule, units: UnitPreferences): string {
  const interval =
    rule.intervalMetres !== null
      ? rule.intervalDays !== null
        ? `Every ${formatDistance(rule.intervalMetres, units.distance)} or ${describePeriod(rule.intervalDays)}`
        : `Every ${formatDistance(rule.intervalMetres, units.distance)}`
      : rule.intervalDays !== null
        ? `Every ${describePeriod(rule.intervalDays)}`
        : 'No interval set';

  const last =
    rule.lastCompletedMetres !== null
      ? `last at ${formatDistance(rule.lastCompletedMetres, units.distance)}`
      : rule.lastCompletedDate !== null
        ? `last on ${formatLongDate(rule.lastCompletedDate)}`
        : 'never completed';

  return `${interval} · ${last}`;
}

/** `180` → `6 months`, `365` → `1 year`, `14` → `14 days`. */
export function describePeriod(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? '1 year' : `${years} years`;
  }
  if (days >= 60 && days % 30 === 0) return `${days / 30} months`;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * The pill on the right of a rule row: `310 KM OVER`, `DUE IN 240 KM`, `OK`.
 *
 * Every figure in it is a `MaintenanceStatus` field, computed once in
 * `analyseBike()`, so the pill can never disagree with the Dashboard's
 * attention list or with the count chips above it. Where both a distance and a
 * date are running, the pill names whichever is closer to falling due — that is
 * the one about to matter.
 *
 * The label carries the status in words as well as in colour, which is what
 * lets it stay readable to a rider who cannot tell the amber from the red.
 */
export function describeStatusPill(
  rule: MaintenanceRule,
  status: MaintenanceStatus,
  units: UnitPreferences,
): { label: string; tone: BadgeTone } {
  if (status.kind === 'unknown' || status.neverCompleted) return { label: 'Not set', tone: 'neutral' };
  if (status.kind === 'good') return { label: 'OK', tone: 'good' };

  const distanceUrgency =
    status.remainingMetres !== null && rule.intervalMetres !== null
      ? status.remainingMetres / rule.intervalMetres
      : Number.POSITIVE_INFINITY;
  const timeUrgency =
    status.remainingDays !== null && rule.intervalDays !== null
      ? status.remainingDays / rule.intervalDays
      : Number.POSITIVE_INFINITY;

  const byDistance = distanceUrgency <= timeUrgency && status.remainingMetres !== null;

  if (status.kind === 'overdue') {
    const label = byDistance
      ? `${formatDistance(Math.abs(status.remainingMetres ?? 0), units.distance)} over`
      : status.remainingDays !== null
        ? `${Math.abs(status.remainingDays)} ${Math.abs(status.remainingDays) === 1 ? 'day' : 'days'} over`
        : 'Overdue';
    return { label, tone: 'bad' };
  }

  const label = byDistance
    ? `Due in ${formatDistance(status.remainingMetres ?? 0, units.distance)}`
    : status.remainingDays !== null
      ? `Due in ${status.remainingDays} ${status.remainingDays === 1 ? 'day' : 'days'}`
      : 'Due';

  return { label, tone: status.kind === 'due_soon' ? 'warn' : 'neutral' };
}

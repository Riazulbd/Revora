import type { MaintenanceStatus } from '@/calculations/maintenance';
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

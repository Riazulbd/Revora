import type { MaintenanceStatus } from '@/calculations/maintenance';
import type { BadgeTone, IconName } from '@/components';
import type { MaintenanceRule, UnitPreferences } from '@/types';
import { formatDistance } from '@/utils/format';
import { formatLongDate, formatShortDate } from '@/utils/date';

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

/**
 * The pill beside a rule name on the Figma Maintenance list: one word for the
 * status, the tone it is drawn in and the glyph before it — `⊘ Overdue`,
 * `◷ Due soon`, `▦ Upcoming`, `✓ Good`. The count chips above the list use the
 * same three facts, so the two can never disagree.
 */
export function describeStatusBadge(status: MaintenanceStatus): { label: string; tone: BadgeTone; icon: IconName } {
  if (status.kind === 'unknown' || status.neverCompleted) return { label: 'Not set', tone: 'neutral', icon: 'circle' };
  if (status.kind === 'overdue') return { label: 'Overdue', tone: 'bad', icon: 'circleAlert' };
  if (status.kind === 'due_soon') return { label: 'Due soon', tone: 'warn', icon: 'clock' };
  if (status.kind === 'upcoming') return { label: 'Upcoming', tone: 'neutral', icon: 'calendar' };
  return { label: 'Good', tone: 'good', icon: 'check' };
}

/** `17 months`, `45 days`, `1 day` — the time side of a remaining figure. */
function describeDays(days: number): string {
  const abs = Math.abs(days);
  if (abs >= 60) {
    const months = Math.round(abs / 30.44);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  return `${abs} day${abs === 1 ? '' : 's'}`;
}

/**
 * How often a rule comes round, as the list's second line: `Every 3,000 km or
 * 180 days`, `Every 500 km`, `Every 12 months`.
 */
export function describeInterval(rule: MaintenanceRule, units: UnitPreferences): string {
  if (rule.intervalMetres !== null && rule.intervalDays !== null) {
    return `Every ${formatDistance(rule.intervalMetres, units.distance)} or ${describePeriod(rule.intervalDays)}`;
  }
  if (rule.intervalMetres !== null) return `Every ${formatDistance(rule.intervalMetres, units.distance)}`;
  if (rule.intervalDays !== null) return `Every ${describePeriod(rule.intervalDays)}`;
  return 'No interval set';
}

/**
 * The line under a rule's track, in the status colour: what is left, or how
 * far past due it is — `310 km overdue · last done 18 Mar`, `120 km left`,
 * `12 days left · due 7 Nov`, `8,400 km or 17 months left`.
 *
 * Every figure is a `MaintenanceStatus` field; nothing here is re-derived from
 * the rule, so the line cannot drift from the pill beside the name.
 */
export function describeRemaining(rule: MaintenanceRule, status: MaintenanceStatus, units: UnitPreferences): string {
  if (status.neverCompleted) return 'Never completed · mark it done to start the clock';

  const metres = status.remainingMetres;
  const days = status.remainingDays;

  if (status.kind === 'overdue') {
    const distanceUrgency = metres !== null && rule.intervalMetres !== null ? metres / rule.intervalMetres : Number.POSITIVE_INFINITY;
    const timeUrgency = days !== null && rule.intervalDays !== null ? days / rule.intervalDays : Number.POSITIVE_INFINITY;
    const lead =
      distanceUrgency <= timeUrgency && metres !== null
        ? `${formatDistance(Math.abs(metres), units.distance)} overdue`
        : `${describeDays(days ?? 0)} overdue`;
    const last =
      rule.lastCompletedDate !== null
        ? ` · last done ${formatShortDate(rule.lastCompletedDate)}`
        : rule.lastCompletedMetres !== null
          ? ` · last at ${formatDistance(rule.lastCompletedMetres, units.distance)}`
          : '';
    return `${lead}${last}`;
  }

  const distanceLeft = metres === null ? null : formatDistance(Math.max(0, metres), units.distance);
  const timeLeft = days === null ? null : describeDays(Math.max(0, days));

  if (distanceLeft !== null && timeLeft !== null) return `${distanceLeft} or ${timeLeft} left`;
  if (distanceLeft !== null) return `${distanceLeft} left`;
  if (timeLeft !== null) {
    return status.dueOnDate ? `${timeLeft} left · due ${formatShortDate(status.dueOnDate)}` : `${timeLeft} left`;
  }
  return 'Nothing to measure yet';
}

/**
 * The line under a maintenance item on the Log-a-service form. Unticked it
 * says where the rule stands (`Overdue by 310 km`, `Due soon · 12 days left`);
 * ticked it says what the tick does (`Resets the 3,000 km rule`).
 */
export function describeTickLine(
  rule: MaintenanceRule,
  status: MaintenanceStatus,
  units: UnitPreferences,
  ticked: boolean,
): { label: string; tone: 'mut' | 'warn' | 'bad' } {
  if (ticked) {
    const interval =
      rule.intervalMetres !== null
        ? formatDistance(rule.intervalMetres, units.distance)
        : rule.intervalDays !== null
          ? describePeriod(rule.intervalDays)
          : null;
    return { label: interval === null ? 'Marks the rule done today' : `Resets the ${interval} rule`, tone: 'mut' };
  }
  if (status.neverCompleted || status.kind === 'unknown') return { label: 'Never completed', tone: 'mut' };
  const remaining = describeRemaining(rule, status, units);
  if (status.kind === 'overdue') {
    const [lead] = remaining.split(' · ');
    return { label: `Overdue by ${(lead ?? remaining).replace(' overdue', '')}`, tone: 'bad' };
  }
  if (status.kind === 'due_soon') return { label: `Due soon · ${remaining}`, tone: 'warn' };
  if (status.kind === 'upcoming') return { label: `Upcoming · ${remaining}`, tone: 'mut' };
  return { label: `Good · ${remaining}`, tone: 'mut' };
}

/**
 * The tinted banner at the top of the rule editor (Figma `Status banner`):
 * `Overdue by 310 km` over `Was due at 34,402 km · now 34,712 km`. Null for a
 * rule with nothing to say yet — a new rule, or one never completed.
 */
export function describeStatusBanner(
  rule: MaintenanceRule,
  status: MaintenanceStatus,
  units: UnitPreferences,
  currentMetres: number | null,
): { title: string; body: string; tone: 'bad' | 'warn' | 'neutral' | 'good' } | null {
  if (status.neverCompleted || status.kind === 'unknown') return null;

  const metres = status.remainingMetres;
  const days = status.remainingDays;
  const distanceUrgency = metres !== null && rule.intervalMetres !== null ? metres / rule.intervalMetres : Number.POSITIVE_INFINITY;
  const timeUrgency = days !== null && rule.intervalDays !== null ? days / rule.intervalDays : Number.POSITIVE_INFINITY;
  const byDistance = distanceUrgency <= timeUrgency && metres !== null && status.dueAtMetres !== null;

  const body = byDistance
    ? `${status.kind === 'overdue' ? 'Was due' : 'Due'} at ${formatDistance(status.dueAtMetres, units.distance)}${
        currentMetres === null ? '' : ` · now ${formatDistance(currentMetres, units.distance)}`
      }`
    : status.dueOnDate !== null
      ? `${status.kind === 'overdue' ? 'Was due' : 'Due'} ${formatShortDate(status.dueOnDate)}`
      : '';

  const amount = byDistance ? formatDistance(Math.abs(metres ?? 0), units.distance) : describeDays(days ?? 0);

  if (status.kind === 'overdue') return { title: `Overdue by ${amount}`, body, tone: 'bad' };
  if (status.kind === 'due_soon') return { title: `Due in ${amount}`, body, tone: 'warn' };
  if (status.kind === 'upcoming') return { title: `Coming up in ${amount}`, body, tone: 'neutral' };
  return { title: `Good for another ${amount}`, body, tone: 'good' };
}

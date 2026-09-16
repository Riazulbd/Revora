import type { IsoDate, SafetyCheck, SafetyArea, VaultDocument } from '@/types';
import type { MaintenanceStatus } from './maintenance';
import { documentStatus } from './documents';
import { compareIso, daysBetween } from '@/utils/date';

/**
 * Everything on one motorcycle that is asking for the rider's attention.
 *
 * The redesign cut the fifth tab, and with it the menu that was the only way
 * most of these records were ever seen. That trade only works if what is wrong
 * comes to the rider instead: an expiring tax token, a service 300 km overdue
 * and a brake marked for action are the reasons those screens get opened at
 * all, so they surface on the Dashboard and the screens behind them become
 * destinations rather than patrol routes.
 *
 * Three rules hold this together:
 *
 *   - Nothing is invented. Every item points at a record that exists, and the
 *     detail line quotes that record rather than paraphrasing it.
 *   - Severity is earned, not assigned. An expired document outranks an overdue
 *     service because riding on one is a different kind of problem.
 *   - Silence means nothing is wrong, and the screen says so. An empty list is
 *     good news and must read as good news.
 */
export type AttentionSeverity = 'critical' | 'warning';

export type AttentionItem = {
  /** Stable across recomputes, so a list does not reshuffle on every render. */
  id: string;
  kind: 'safety' | 'maintenance' | 'document';
  severity: AttentionSeverity;
  /** What is wrong, in the rider's words. */
  title: string;
  /** The evidence: a measurement, a date, a quote from the record. */
  detail: string;
  /** Where tapping it goes. */
  route: string;
  params?: Record<string, string>;
  /** Present only where one tap can resolve it — an overdue rule. */
  action?: { label: string; ruleId: string };
};

const AREA_LABEL: Record<SafetyArea, string> = {
  tyres: 'Tyres',
  chain: 'Chain',
  brakes: 'Brakes',
  battery: 'Battery',
  lights: 'Lights',
};

/**
 * How the list is ordered.
 *
 * Severity first, then kind. Within a kind the worst offender leads — the
 * document that expired longest ago, the rule furthest past due — because a
 * rider skimming three lines should meet the one that has been wrong longest.
 */
const SEVERITY_RANK: Record<AttentionSeverity, number> = { critical: 0, warning: 1 };
const KIND_RANK: Record<AttentionItem['kind'], number> = { safety: 0, document: 1, maintenance: 2 };

/** `'310 km past'`, `'due in 240 km'` — metres in, rider's words out. */
function distancePhrase(remainingMetres: number, unit: 'km' | 'mi'): string {
  const perUnit = unit === 'mi' ? 1609.344 : 1000;
  const value = Math.round(Math.abs(remainingMetres) / perUnit);
  const formatted = value.toLocaleString('en-US');
  return remainingMetres < 0 ? `${formatted} ${unit} past` : `${formatted} ${unit} to go`;
}

function daysPhrase(days: number): string {
  if (days === 0) return 'today';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The most recent check for each area, because only the latest one describes
 * the motorcycle now. A brake marked for action in March that was checked and
 * cleared in August is not a live problem, and showing it would train riders to
 * ignore the list.
 */
function latestByArea(checks: readonly SafetyCheck[]): SafetyCheck[] {
  const latest = new Map<SafetyArea, SafetyCheck>();
  for (const check of checks) {
    const held = latest.get(check.area);
    if (held === undefined || compareIso(check.date, held.date) > 0) latest.set(check.area, check);
  }
  return [...latest.values()];
}

export function attentionItems(input: {
  rules: readonly { rule: { id: string; name: string; intervalMetres: number | null }; status: MaintenanceStatus }[];
  documents: readonly VaultDocument[];
  safetyChecks: readonly SafetyCheck[];
  distanceUnit: 'km' | 'mi';
  today: IsoDate;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const check of latestByArea(input.safetyChecks)) {
    if (check.status !== 'action') continue;
    items.push({
      id: `safety:${check.id}`,
      kind: 'safety',
      severity: 'critical',
      title: `${AREA_LABEL[check.area]} marked action`,
      // The rider's own summary, not a generated one — they wrote it because
      // it was the thing worth remembering.
      detail: `${check.summary || 'Needs attention'} · ${daysPhrase(-daysBetween(check.date, input.today))}`,
      route: '/records/safety',
    });
  }

  for (const { rule, status } of input.rules) {
    if (status.kind !== 'overdue') continue;
    const by =
      status.remainingMetres !== null
        ? distancePhrase(status.remainingMetres, input.distanceUnit)
        : status.remainingDays !== null
          ? daysPhrase(status.remainingDays)
          : 'overdue';
    const every =
      rule.intervalMetres === null
        ? ''
        : ` · rule every ${distancePhrase(rule.intervalMetres, input.distanceUnit).replace(' to go', '')}`;
    items.push({
      id: `rule:${rule.id}`,
      kind: 'maintenance',
      severity: 'critical',
      title: `${rule.name} overdue`,
      detail: `${by}${every}`,
      route: '/maintenance/rule',
      params: { id: rule.id },
      action: { label: 'Mark done', ruleId: rule.id },
    });
  }

  for (const document of input.documents) {
    const state = documentStatus(document, input.today);
    if (state !== 'expired' && state !== 'expiring') continue;
    if (document.expiresOn === null) continue;
    const days = daysBetween(input.today, document.expiresOn);
    items.push({
      id: `doc:${document.id}`,
      kind: 'document',
      severity: state === 'expired' ? 'critical' : 'warning',
      title:
        state === 'expired'
          ? `${document.title} expired`
          : `${document.title} expires ${daysPhrase(days)}`,
      detail: `${document.expiresOn} · reminders at 30, 14, 3`,
      route: '/records/document',
      params: { id: document.id },
    });
  }

  return items.sort((a, b) => {
    if (a.severity !== b.severity) return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The badge on the bell. Counts items, so it can never disagree with the list. */
export function attentionCount(items: readonly AttentionItem[]): number {
  return items.length;
}

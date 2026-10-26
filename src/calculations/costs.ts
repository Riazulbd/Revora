import type { CurrencyCode, IsoDate, LedgerEntry, LedgerSource } from '@/types';
import { monthKey } from '@/utils/date';
import { monthOverMonth } from './dashboard';
import { expenseCategoryLabel, filterByMonth } from './expenses';
import type { AllowanceSummary } from './ownership';

/**
 * The derived figures the Costs tab and the Company allowance screen ask for
 * that no other calculation exposed.
 *
 * They live here rather than in a screen for the usual reason: the Costs tab
 * and the allowance screen must never disagree about what a line is called,
 * what a month cost, or how much of the month's allowance is left.
 */

/** The Costs row's category tag — `FUEL`, `SERVICE`, `EXPENSE`. */
export function ledgerRowTag(source: LedgerSource): string {
  switch (source) {
    case 'fuel':
      return 'FUEL';
    case 'service':
      return 'SERVICE';
    case 'part':
      return 'PART';
    case 'accessory':
      return 'ACCESSORY';
    case 'maintenance':
      return 'MAINTENANCE';
    case 'manual':
      return 'EXPENSE';
  }
}

/**
 * How much of this month's allowance the fuel spend did not consume —
 * "৳160 of allowance unused this month."
 *
 * Never negative: once the spend passes the allowance, nothing is unused and
 * the overspend is `riderFuelCostMinor`, which is a different sentence.
 * Integer minor units in, integer minor units out.
 */
export function allowanceUnusedMinor(summary: AllowanceSummary): number {
  return Math.max(0, summary.allowanceMinor - summary.usedMinor);
}

const SOURCE_LABEL: Record<Exclude<LedgerSource, 'manual'>, string> = {
  fuel: 'Fuel',
  service: 'Service',
  part: 'Parts',
  accessory: 'Accessories',
  maintenance: 'Maintenance',
};

export type CostCategory = {
  /** `fuel`, `service`, … or `manual:parking`. */
  key: string;
  label: string;
  source: LedgerSource;
  amountMinor: number;
  /** This category's share of the lines' total, 0–1. */
  share: number;
};

/**
 * The lines grouped the way the Costs tab's "By category" card reads them:
 * fuel, service, parts and accessories by source, hand-entered expenses by
 * the rider's own category. Largest first; lines in another currency are left
 * out rather than added as if they were the same money.
 */
export function costCategories(lines: readonly LedgerEntry[], currency: CurrencyCode): CostCategory[] {
  const groups = new Map<string, CostCategory>();
  let total = 0;
  for (const line of lines) {
    if (line.currency !== currency || line.amountMinor <= 0) continue;
    const manual = line.source === 'manual';
    const key = manual ? `manual:${line.category ?? 'other'}` : line.source;
    const label = manual ? expenseCategoryLabel(line.category ?? 'other') : SOURCE_LABEL[line.source as Exclude<LedgerSource, 'manual'>];
    const group = groups.get(key) ?? { key, label, source: line.source, amountMinor: 0, share: 0 };
    group.amountMinor += line.amountMinor;
    groups.set(key, group);
    total += line.amountMinor;
  }
  return [...groups.values()]
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .map((group) => ({ ...group, share: total > 0 ? group.amountMinor / total : 0 }));
}

/** Days in the month a `'YYYY-MM'` key names. */
export function daysInMonth(key: string): number {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
}

/** `'2026-08'` for `'2026-09'`. */
export function previousMonthKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** `'2026-10'` for `'2026-09'`. */
export function nextMonthKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The month of the oldest line, or null for an empty ledger. */
export function earliestMonthKey(lines: readonly LedgerEntry[]): string | null {
  let earliest: string | null = null;
  for (const line of lines) {
    const key = monthKey(line.date);
    if (earliest === null || key < earliest) earliest = key;
  }
  return earliest;
}

export type MonthCosts = {
  key: string;
  /** The month's lines in the reporting currency, newest first. */
  lines: LedgerEntry[];
  totalMinor: number;
  categories: CostCategory[];
  /** Days of the month that have passed — all of them for a month gone by. */
  daysElapsed: number;
  /** The total spread over the days elapsed; null when nothing was spent. */
  perDayMinor: number | null;
  /** Against the month before, when it had spend to compare with. */
  versusPrevious: { percent: number; lower: boolean; previousKey: string } | null;
};

/** Everything the Costs tab shows for one month. */
export function monthCosts(ledger: readonly LedgerEntry[], currency: CurrencyCode, key: string, today: IsoDate): MonthCosts {
  const inCurrency = (line: LedgerEntry) => line.currency === currency;
  const lines = filterByMonth(ledger, key).filter(inCurrency);
  const sum = (items: readonly LedgerEntry[]) => items.reduce((acc, line) => acc + line.amountMinor, 0);
  const totalMinor = sum(lines);
  const daysElapsed = key === monthKey(today) ? Math.max(1, Number(today.slice(8, 10))) : daysInMonth(key);
  const previousKey = previousMonthKey(key);
  const previousTotal = sum(filterByMonth(ledger, previousKey).filter(inCurrency));
  return {
    key,
    lines,
    totalMinor,
    categories: costCategories(lines, currency),
    daysElapsed,
    perDayMinor: lines.length === 0 ? null : Math.round(totalMinor / daysElapsed),
    versusPrevious: monthOverMonth([
      { key: previousKey, totalMinor: previousTotal },
      { key, totalMinor },
    ]),
  };
}

/**
 * How the month's fuel bill divides between the employer and the rider —
 * the Company allowance screen's split bar. Shares are 0–1 of the fuel spend;
 * null when nothing was spent, so a bar is never drawn for nothing.
 */
export function allowanceSplit(summary: AllowanceSummary): { coveredShare: number; riderShare: number } | null {
  if (summary.fuelSpendMinor <= 0) return null;
  const covered = Math.min(summary.usedMinor, summary.fuelSpendMinor) / summary.fuelSpendMinor;
  return { coveredShare: covered, riderShare: 1 - covered };
}

import type {
  Accessory,
  CurrencyCode,
  Expense,
  ExpenseCategory,
  FuelEntry,
  IsoDate,
  LedgerEntry,
  LedgerSource,
  Part,
  ServiceRecord,
} from '@/types';
import { compareIso, monthKey } from '@/utils/date';
import { sumMinor } from './money';

/**
 * One unified financial ledger.
 *
 * The single rule this file exists to enforce: **every cost appears exactly
 * once**. A part fitted during a service is already inside that service's total,
 * so it contributes no line of its own; the same holds for an accessory fitted
 * during a service and for a maintenance completion recorded against one
 * (requirement 28 / 76).
 */

export type LedgerInput = {
  fuelEntries: readonly FuelEntry[];
  services: readonly ServiceRecord[];
  parts: readonly Part[];
  accessories: readonly Accessory[];
  expenses: readonly Expense[];
  currency: CurrencyCode;
};

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  registration: 'Registration',
  insurance: 'Insurance',
  parking: 'Parking',
  toll: 'Toll',
  wash: 'Bike wash',
  fine: 'Fine',
  gear: 'Gear',
  modification: 'Modification',
  other: 'Other',
};

export function expenseCategoryLabel(category: ExpenseCategory): string {
  return CATEGORY_LABEL[category];
}

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'parking',
  'wash',
  'gear',
  'toll',
  'fine',
  'insurance',
  'registration',
  'modification',
  'other',
];

/** Total paid for an accessory: the item plus fitting. */
export function accessoryTotalMinor(a: Accessory): number {
  return a.purchaseCostMinor + a.installationCostMinor;
}

/**
 * Builds the ledger, newest first.
 *
 * Note what is deliberately *not* here: any record whose cost is already carried
 * by another record it links to.
 */
export function buildLedger(input: LedgerInput): LedgerEntry[] {
  const lines: LedgerEntry[] = [];

  for (const f of input.fuelEntries) {
    lines.push({
      id: `fuel:${f.id}`,
      sourceId: f.id,
      source: 'fuel',
      label: `Fuel — ${(f.litresMl / 1000).toFixed(1)} L`,
      date: f.date,
      amountMinor: f.totalCostMinor,
      currency: f.currency ?? input.currency,
    });
  }

  for (const s of input.services) {
    lines.push({
      id: `service:${s.id}`,
      sourceId: s.id,
      source: 'service',
      label: s.title,
      date: s.date,
      amountMinor: s.totalCostMinor,
      currency: s.currency ?? input.currency,
    });
  }

  for (const p of input.parts) {
    // Cost already counted inside the linked service total.
    if (p.linkedServiceId !== null) continue;
    if (p.costMinor === 0) continue;
    lines.push({
      id: `part:${p.id}`,
      sourceId: p.id,
      source: 'part',
      label: p.name,
      date: p.installedDate,
      amountMinor: p.costMinor,
      currency: p.currency ?? input.currency,
    });
  }

  for (const a of input.accessories) {
    if (a.linkedServiceId !== null) continue;
    const total = accessoryTotalMinor(a);
    if (total === 0) continue;
    lines.push({
      id: `accessory:${a.id}`,
      sourceId: a.id,
      source: 'accessory',
      label: a.name,
      date: a.date,
      amountMinor: total,
      currency: a.currency ?? input.currency,
    });
  }

  for (const e of input.expenses) {
    // The shared `expenses` collection also carries fuel, part and accessory
    // costs written by the web product. Those already have a record of their own
    // in this app, so counting them here would be the double-count this whole
    // function exists to prevent (requirement 28).
    if (e.derived) continue;
    lines.push({
      id: `expense:${e.id}`,
      sourceId: e.id,
      source: e.linkedRuleId === null ? 'manual' : 'maintenance',
      label: e.note && e.note.trim() !== '' ? e.note : expenseCategoryLabel(e.category),
      date: e.date,
      amountMinor: e.amountMinor,
      currency: e.currency ?? input.currency,
    });
  }

  return lines.sort((a, b) => {
    const byDate = compareIso(b.date, a.date);
    if (byDate !== 0) return byDate;
    return a.label.localeCompare(b.label);
  });
}

/** Ledger badge text, matching the design's `LINKED · FUEL` / `MANUAL` tags. */
export function ledgerTag(source: LedgerSource): string {
  switch (source) {
    case 'manual':
      return 'MANUAL';
    case 'fuel':
      return 'LINKED · FUEL';
    case 'service':
      return 'LINKED · SERVICE';
    case 'part':
      return 'LINKED · PART';
    case 'accessory':
      return 'LINKED · ACCESSORY';
    case 'maintenance':
      return 'LINKED · MAINTENANCE';
    default:
      return 'LINKED';
  }
}

export type SpendBreakdown = {
  fuel: number;
  services: number;
  parts: number;
  accessories: number;
  other: number;
  total: number;
};

export function breakdown(lines: readonly LedgerEntry[]): SpendBreakdown {
  const out: SpendBreakdown = { fuel: 0, services: 0, parts: 0, accessories: 0, other: 0, total: 0 };
  for (const l of lines) {
    switch (l.source) {
      case 'fuel':
        out.fuel += l.amountMinor;
        break;
      case 'service':
        out.services += l.amountMinor;
        break;
      case 'part':
        out.parts += l.amountMinor;
        break;
      case 'accessory':
        out.accessories += l.amountMinor;
        break;
      default:
        out.other += l.amountMinor;
        break;
    }
    out.total += l.amountMinor;
  }
  return out;
}

export function totalMinor(lines: readonly LedgerEntry[]): number {
  return sumMinor(lines.map((l) => l.amountMinor));
}

export function filterByMonth(lines: readonly LedgerEntry[], key: string): LedgerEntry[] {
  return lines.filter((l) => monthKey(l.date) === key);
}

export function filterByRange(lines: readonly LedgerEntry[], from: IsoDate, to: IsoDate): LedgerEntry[] {
  return lines.filter((l) => compareIso(l.date, from) >= 0 && compareIso(l.date, to) <= 0);
}

export type MonthlyTotal = { key: string; totalMinor: number };

/** Totals per calendar month, oldest first. */
export function monthlyTotals(lines: readonly LedgerEntry[]): MonthlyTotal[] {
  const map = new Map<string, number>();
  for (const l of lines) {
    const key = monthKey(l.date);
    map.set(key, (map.get(key) ?? 0) + l.amountMinor);
  }
  return [...map.entries()]
    .map(([key, total]) => ({ key, totalMinor: total }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

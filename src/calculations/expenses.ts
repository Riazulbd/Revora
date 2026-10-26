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
 *
 * ## Currency
 *
 * Every line carries the currency of the record it came from, and **nothing in
 * this file ever adds two lines in different currencies**. Changing a bike's
 * currency in Settings relabels the bike and leaves historical records in the
 * currency they were paid in, so a mixed ledger is reachable, and adding BDT
 * 1,000.00 to USD 50.00 produces 105,000 — a figure in no currency at all, and
 * one a screen would confidently label with the wrong symbol.
 *
 * So the totals here are currency-scoped. `totalMinor` and `breakdown` take the
 * currency they are reporting in and count only the lines that match it;
 * `totalsByCurrency` gives every total side by side when a caller wants the
 * whole picture. When no currency is named the reporting currency is inferred —
 * the one carrying the most lines, ties broken by code order — which is exact
 * for the single-currency ledger every rider actually has and, for a mixed one,
 * is at least a real amount of a real currency rather than a sum of neither.
 * `analyseBike` always names the bike's own currency, so the app never relies on
 * the inference.
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
 *
 * Zero-cost records are treated differently by kind, on purpose. A fill and a
 * service are events in the bike's life and belong in the ledger whether or not
 * they cost anything — a warranty job or a tank someone else paid for really
 * happened, and its line carries the litres and the workshop. A part or an
 * accessory has no line of its own except as a cost, so one recorded at zero is
 * a blank the rider left, not a free part, and it is skipped rather than filling
 * the Ledger screen with noise.
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
      ...(e.linkedRuleId === null ? { category: e.category } : {}),
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

/**
 * Every currency present in a ledger, in ISO code order.
 *
 * More than one means the rider changed the bike's currency partway through, or
 * a record arrived from the web product in another one.
 */
export function ledgerCurrencies(lines: readonly LedgerEntry[]): CurrencyCode[] {
  const seen = new Set<CurrencyCode>();
  for (const l of lines) seen.add(l.currency);
  return [...seen].sort();
}

/**
 * The reporting currency for a set of lines when the caller did not name one:
 * the currency carrying the most lines, ties broken by ISO code order so the
 * answer never depends on the order records happened to load in.
 */
function inferredCurrency(lines: readonly LedgerEntry[]): CurrencyCode | null {
  const counts = new Map<CurrencyCode, number>();
  for (const l of lines) counts.set(l.currency, (counts.get(l.currency) ?? 0) + 1);
  let best: CurrencyCode | null = null;
  let bestCount = 0;
  for (const code of [...counts.keys()].sort()) {
    const count = counts.get(code) ?? 0;
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

export type CurrencyTotal = { currency: CurrencyCode; totalMinor: number };

/** One total per currency, in code order, so nothing is ever added across codes. */
export function totalsByCurrency(lines: readonly LedgerEntry[]): CurrencyTotal[] {
  const totals = new Map<CurrencyCode, number>();
  for (const l of lines) totals.set(l.currency, (totals.get(l.currency) ?? 0) + l.amountMinor);
  return [...totals.keys()]
    .sort()
    .map((currency) => ({ currency, totalMinor: totals.get(currency) ?? 0 }));
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

/**
 * Spending by source, in one currency.
 *
 * `currency` is the currency being reported in; lines in any other are left out
 * entirely rather than added in at face value. Omitting it infers one — see the
 * currency note at the top of this file.
 */
export function breakdown(lines: readonly LedgerEntry[], currency?: CurrencyCode): SpendBreakdown {
  const out: SpendBreakdown = { fuel: 0, services: 0, parts: 0, accessories: 0, other: 0, total: 0 };
  const reporting = currency ?? inferredCurrency(lines);
  for (const l of lines) {
    if (l.currency !== reporting) continue;
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

/**
 * The total of the lines in one currency. Lines in any other are not added in —
 * see the currency note at the top of this file.
 */
export function totalMinor(lines: readonly LedgerEntry[], currency?: CurrencyCode): number {
  const reporting = currency ?? inferredCurrency(lines);
  return sumMinor(lines.filter((l) => l.currency === reporting).map((l) => l.amountMinor));
}

export function filterByMonth(lines: readonly LedgerEntry[], key: string): LedgerEntry[] {
  return lines.filter((l) => monthKey(l.date) === key);
}

export function filterByRange(lines: readonly LedgerEntry[], from: IsoDate, to: IsoDate): LedgerEntry[] {
  return lines.filter((l) => compareIso(l.date, from) >= 0 && compareIso(l.date, to) <= 0);
}

export type MonthlyTotal = { key: string; totalMinor: number };

/**
 * Totals per calendar month, oldest first — in one currency, like every other
 * total here. Lines in any other currency are left out rather than added in.
 */
export function monthlyTotals(lines: readonly LedgerEntry[], currency?: CurrencyCode): MonthlyTotal[] {
  const reporting = currency ?? inferredCurrency(lines);
  const map = new Map<string, number>();
  for (const l of lines) {
    if (l.currency !== reporting) continue;
    const key = monthKey(l.date);
    map.set(key, (map.get(key) ?? 0) + l.amountMinor);
  }
  return [...map.entries()]
    .map(([key, total]) => ({ key, totalMinor: total }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

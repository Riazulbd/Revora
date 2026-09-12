import type {
  Accessory,
  Bike,
  CurrencyCode,
  Expense,
  FuelAdjustment,
  FuelEntry,
  IsoDate,
  LedgerEntry,
  MaintenanceRule,
  OdometerReading,
  Part,
  ServiceRecord,
  UnitPreferences,
} from '@/types';
import { monthKey, recentMonthKeys, todayIso } from '@/utils/date';
import { buildLedger, breakdown, filterByMonth, monthlyTotals, totalMinor } from './expenses';
import { averagePricePerLitre } from './fuel';
import { calculateMaintenanceStatus, countByStatus, type MaintenanceStatus } from './maintenance';
import { calculateMileageSummary, RELIABLE_INTERVALS_REQUIRED, type MileageSummary } from './mileage';
import {
  buildOdometerHistory,
  currentOdometerMetres,
  currentOdometerPoint,
  totalDistanceMetres,
  type OdometerPoint,
} from './odometer';
import { calculateAllowance, calculateOwnershipCost, type AllowanceSummary, type OwnershipCost } from './ownership';
import { calculatePartLife, isPartActive, type PartLife } from './parts';

/**
 * The one place every derived number in Revora is produced.
 *
 * Dashboard, Analytics, Expenses and the Assistant all read from this single
 * computation, so two screens can never disagree about a metric
 * (requirement 6 / mistake 4).
 *
 * Where a figure cannot be computed honestly the field is `null`. The UI renders
 * "Not enough data yet" — never a fabricated zero (requirement 31).
 */

export type GarageData = {
  bike: Bike;
  fuelEntries: readonly FuelEntry[];
  fuelAdjustments: readonly FuelAdjustment[];
  odometerReadings: readonly OdometerReading[];
  rules: readonly MaintenanceRule[];
  services: readonly ServiceRecord[];
  parts: readonly Part[];
  accessories: readonly Accessory[];
  expenses: readonly Expense[];
  units: UnitPreferences;
  /** Injected so tests are deterministic and midnight can never flip a result. */
  today?: IsoDate;
};

export type RuleWithStatus = { rule: MaintenanceRule; status: MaintenanceStatus };
export type PartWithLife = { part: Part; life: PartLife };

export type FuelPricePoint = { date: IsoDate; pricePerLitreMinor: number };

export type BikeAnalytics = {
  currency: CurrencyCode;
  units: UnitPreferences;
  today: IsoDate;

  odometer: {
    points: OdometerPoint[];
    currentMetres: number | null;
    latest: OdometerPoint | null;
    totalDistanceMetres: number;
  };

  mileage: MileageSummary;

  ledger: LedgerEntry[];
  spend: ReturnType<typeof breakdown>;
  monthly: ReturnType<typeof monthlyTotals>;
  thisMonthMinor: number;
  ownership: OwnershipCost;
  allowance: AllowanceSummary;

  fuel: {
    entries: FuelEntry[];
    adjustments: FuelAdjustment[];
    thisMonthSpendMinor: number;
    thisMonthFills: number;
    averagePricePerLitreMinor: number | null;
    latest: FuelEntry | null;
    priceTrend: FuelPricePoint[];
  };

  maintenance: {
    rules: RuleWithStatus[];
    counts: ReturnType<typeof countByStatus>;
    nextDue: RuleWithStatus | null;
  };

  parts: {
    active: PartWithLife[];
    removed: PartWithLife[];
  };

  services: {
    all: ServiceRecord[];
    totalSpendMinor: number;
  };

  accessories: {
    all: Accessory[];
    totalSpendMinor: number;
  };

  /** Manually entered expenses, kept raw so an edit screen can reload one. */
  expenses: Expense[];

  /** True when nothing at all has been logged for this bike yet. */
  isEmpty: boolean;
  /** True when at least one full-to-full interval exists. */
  hasMileage: boolean;
  /** True when best/worst/last-5 can be shown honestly. */
  hasReliableStats: boolean;
};

const byDateDesc = (a: { date: IsoDate }, b: { date: IsoDate }) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

export function analyseBike(data: GarageData): BikeAnalytics {
  const today = data.today ?? todayIso();
  const currency = data.bike.currency;
  const thisMonth = monthKey(today);

  const points = buildOdometerHistory({
    readings: data.odometerReadings,
    fuelEntries: data.fuelEntries,
    services: data.services,
    parts: data.parts,
    bike: {
      initialOdometerMetres: data.bike.initialOdometerMetres,
      storedOdometerMetres: data.bike.storedOdometerMetres,
      createdAt: data.bike.createdAt,
    },
  });
  const currentMetres = currentOdometerMetres(points);

  const mileage = calculateMileageSummary(data.fuelEntries, data.fuelAdjustments);

  const ledger = buildLedger({
    fuelEntries: data.fuelEntries,
    services: data.services,
    parts: data.parts,
    accessories: data.accessories,
    expenses: data.expenses,
    currency,
  });

  const spend = breakdown(ledger);
  const monthly = monthlyTotals(ledger);
  const thisMonthLines = filterByMonth(ledger, thisMonth);
  const thisMonthMinor = totalMinor(thisMonthLines);

  const ownership = calculateOwnershipCost({
    bike: data.bike,
    ledger,
    distanceMetres: totalDistanceMetres(points),
    distanceUnit: data.units.distance,
    costBasis: data.units.costBasis,
  });

  const fuelSorted = [...data.fuelEntries].sort(byDateDesc);
  const thisMonthFuel = fuelSorted.filter((f) => monthKey(f.date) === thisMonth);

  const allowance = calculateAllowance({
    enabled: data.bike.company.enabled,
    monthlyAllowanceMinor: data.bike.company.monthlyAllowanceMinor,
    monthFuelSpendMinor: thisMonthFuel.reduce((sum, f) => sum + f.totalCostMinor, 0),
    monthTotalSpendMinor: thisMonthMinor,
  });

  const rulesWithStatus: RuleWithStatus[] = data.rules
    .filter((r) => r.enabled)
    .map((rule) => ({ rule, status: calculateMaintenanceStatus(rule, currentMetres, today) }));

  const nextDue =
    [...rulesWithStatus]
      .filter((r) => r.status.remainingMetres !== null || r.status.remainingDays !== null)
      .sort((a, b) => {
        const ar = a.status.remainingMetres ?? Number.MAX_SAFE_INTEGER;
        const br = b.status.remainingMetres ?? Number.MAX_SAFE_INTEGER;
        return ar - br;
      })[0] ?? null;

  const partsWithLife: PartWithLife[] = data.parts.map((part) => ({
    part,
    life: calculatePartLife(part, currentMetres),
  }));

  const servicesSorted = [...data.services].sort(byDateDesc);
  const accessoriesSorted = [...data.accessories].sort(byDateDesc);

  const isEmpty =
    data.fuelEntries.length === 0 &&
    data.fuelAdjustments.length === 0 &&
    data.services.length === 0 &&
    data.parts.length === 0 &&
    data.accessories.length === 0 &&
    data.expenses.length === 0;

  return {
    currency,
    units: data.units,
    today,
    odometer: {
      points,
      currentMetres,
      latest: currentOdometerPoint(points),
      totalDistanceMetres: totalDistanceMetres(points),
    },
    mileage,
    ledger,
    spend,
    monthly,
    thisMonthMinor,
    ownership,
    allowance,
    fuel: {
      entries: fuelSorted,
      adjustments: [...data.fuelAdjustments].sort(byDateDesc),
      thisMonthSpendMinor: thisMonthFuel.reduce((sum, f) => sum + f.totalCostMinor, 0),
      thisMonthFills: thisMonthFuel.length,
      averagePricePerLitreMinor: averagePricePerLitre(data.fuelEntries),
      latest: fuelSorted[0] ?? null,
      priceTrend: [...data.fuelEntries]
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .map((f) => ({ date: f.date, pricePerLitreMinor: f.pricePerLitreMinor })),
    },
    maintenance: {
      rules: rulesWithStatus,
      counts: countByStatus(rulesWithStatus.map((r) => r.status)),
      nextDue,
    },
    parts: {
      active: partsWithLife.filter((p) => isPartActive(p.part)),
      removed: partsWithLife.filter((p) => !isPartActive(p.part)),
    },
    services: {
      all: servicesSorted,
      totalSpendMinor: servicesSorted.reduce((sum, s) => sum + s.totalCostMinor, 0),
    },
    accessories: {
      all: accessoriesSorted,
      totalSpendMinor: accessoriesSorted.reduce(
        (sum, a) => sum + a.purchaseCostMinor + a.installationCostMinor,
        0,
      ),
    },
    expenses: [...data.expenses].sort(byDateDesc),
    isEmpty,
    hasMileage: mileage.count > 0,
    hasReliableStats: mileage.count >= RELIABLE_INTERVALS_REQUIRED,
  };
}

/**
 * Monthly spending series for the bar chart, padded with the months in range so
 * a gap month renders as an empty column rather than being silently skipped.
 */
export function monthlySeries(analytics: BikeAnalytics, months = 6): ReturnType<typeof monthlyTotals> {
  const keys = recentMonthKeys(months, monthKey(analytics.today));
  const map = new Map(analytics.monthly.map((m) => [m.key, m.totalMinor]));
  return keys.map((key) => ({ key, totalMinor: map.get(key) ?? 0 }));
}

/** True when a chart has enough real points to be worth drawing. */
export function hasChartData(values: readonly number[], minimum = 2): boolean {
  return values.filter((v) => Number.isFinite(v) && v > 0).length >= minimum;
}

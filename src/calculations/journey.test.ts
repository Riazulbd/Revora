import type {
  Accessory,
  Bike,
  Expense,
  FuelEntry,
  MaintenanceRule,
  OdometerReading,
  Part,
  ServiceRecord,
  UnitPreferences,
} from '@/types';
import { analyseBike, type GarageData } from './analytics';
import { formatCurrency, formatDistance, formatMileageValue } from '@/utils/format';

/**
 * The complete rider journey from the specification, run end to end through the
 * calculation layer.
 *
 * This is the test that would have caught every "the screens look right but the
 * numbers are wrong" failure: it adds records in the order a real rider would,
 * then edits and deletes them, and asserts that every derived figure follows.
 */

const units: UnitPreferences = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l', costBasis: 'running' };

const bike: Bike = {
  id: 'bike-1',
  userId: 'rider-a',
  createdAt: 1,
  updatedAt: 1,
  manufacturer: 'Honda',
  model: 'Hornet 2.0',
  nickname: 'Honda Hornet',
  year: 2025,
  tankCapacityMl: 12_000,
  purchasePriceMinor: 28_500_000,
  purchaseDate: '2026-07-12',
  engineNumber: null,
  chassisNumber: null,
  photoPath: null,
  currency: 'BDT',
  initialOdometerMetres: 0,
  storedOdometerMetres: 0,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 },
  archivedAt: null,
};

const owned = { userId: 'rider-a', bikeId: 'bike-1', createdAt: 1, updatedAt: 1 };

const openingReading: OdometerReading = {
  ...owned,
  id: 'odo-1',
  metres: 3_900_000,
  date: '2026-07-12',
  source: 'manual',
  sourceId: null,
  note: null,
};

const fill = (id: string, km: number, litres: number, date: string, order: number): FuelEntry => ({
  ...owned,
  id,
  createdAt: order,
  date,
  odometerMetres: km * 1000,
  litresMl: litres * 1000,
  pricePerLitreMinor: 14_500,
  totalCostMinor: Math.round(litres * 14_500),
  currency: 'BDT',
  fillType: 'full',
  missedPreviousFill: false,
  station: null,
  notes: null,
  receiptPath: null,
  clientRef: id,
});

const oilRule: MaintenanceRule = {
  ...owned,
  id: 'rule-oil',
  name: 'Engine oil & filter',
  intervalMetres: 3_000_000,
  intervalDays: null,
  warnAheadMetres: 300_000,
  warnAheadDays: 14,
  enabled: true,
  lastCompletedMetres: 3_900_000,
  lastCompletedDate: '2026-07-12',
  notes: null,
};

const service: ServiceRecord = {
  ...owned,
  id: 'svc-1',
  title: 'Front brake job',
  workshop: 'Rahim Moto Care',
  selfService: false,
  date: '2026-08-24',
  odometerMetres: 5_050_000,
  labourCostMinor: 40_000,
  partsCostMinor: 200_000,
  totalCostMinor: 240_000, // BDT 2,400
  currency: 'BDT',
  notes: null,
  completedRuleIds: ['rule-oil'],
  itemsSummary: 'Engine oil & filter',
  receiptPaths: [],
  estimate: null,
  clientRef: 'svc-1',
};

const brakePads: Part = {
  ...owned,
  id: 'part-1',
  name: 'Yongli front brake pads',
  installedOdometerMetres: 5_050_000,
  installedDate: '2026-08-24',
  expectedLifeMetres: 8_000_000,
  costMinor: 190_000,
  currency: 'BDT',
  fittedBy: 'Rahim Moto Care',
  // Fitted during the service above.
  linkedServiceId: 'svc-1',
  removedDate: null,
  removedOdometerMetres: null,
  notes: null,
  clientRef: 'part-1',
};

const tailBox: Accessory = {
  ...owned,
  id: 'acc-1',
  name: 'Givi 27L tail box',
  purchaseCostMinor: 800_000,
  installationCostMinor: 90_000,
  currency: 'BDT',
  date: '2026-08-10',
  notes: null,
  photoPath: null,
  linkedServiceId: null,
  clientRef: 'acc-1',
};

const parking: Expense = {
  ...owned,
  id: 'exp-1',
  amountMinor: 6_000,
  currency: 'BDT',
  category: 'parking',
  derived: false,
  linkedRuleId: null,
  date: '2026-08-28',
  note: 'Parking — Bashundhara',
  clientRef: 'exp-1',
};

function garage(overrides: Partial<GarageData> = {}): GarageData {
  return {
    bike,
    fuelEntries: [],
    fuelAdjustments: [],
    odometerReadings: [openingReading],
    rules: [oilRule],
    services: [],
    parts: [],
    accessories: [],
    expenses: [],
    units,
    today: '2026-09-01',
    ...overrides,
  };
}

describe('correcting a mistyped odometer', () => {
  // The rider meant 5,588 km and typed 6,000, and the app synced that mistake
  // onto the bike. Every figure below is wrong until the reading is corrected.
  const typo: OdometerReading = { ...owned, id: 'odo-typo', metres: 6_000_000,
    date: '2026-09-01', source: 'manual', sourceId: null, note: null };
  const mistaken = garage({
    bike: { ...bike, initialOdometerMetres: 3_900_000, storedOdometerMetres: 6_000_000 },
    odometerReadings: [openingReading, typo],
    services: [service],
  });

  it('carries the mistake into every derived figure', () => {
    const a = analyseBike(mistaken);
    expect(a.odometer.currentMetres).toBe(6_000_000);
    expect(a.odometer.totalDistanceMetres).toBe(2_100_000);
  });

  it('follows the correction down, once the bike is resynced with it', () => {
    // What useCorrectOdometerReading writes: the reading itself, and the bike's
    // stored copy recomputed from the survivors.
    const corrected = analyseBike({
      ...mistaken,
      bike: { ...bike, initialOdometerMetres: 3_900_000, storedOdometerMetres: 5_588_000 },
      odometerReadings: [openingReading, { ...typo, metres: 5_588_000 }],
    });
    expect(corrected.odometer.currentMetres).toBe(5_588_000);
    expect(corrected.odometer.totalDistanceMetres).toBe(1_688_000);
    expect(corrected.odometer.latest?.metres).toBe(5_588_000);
  });

  it('leaves a stale stored copy able to hold the old figure up', () => {
    // The reason the correction has to rewrite the bike document too: without
    // that, the echo of the mistake keeps the odometer at 6,000 km.
    const halfDone = analyseBike({
      ...mistaken,
      odometerReadings: [openingReading, { ...typo, metres: 5_588_000 }],
    });
    expect(halfDone.odometer.currentMetres).toBe(6_000_000);
  });
});

describe('the rider journey', () => {
  it('step 5 — a new garage knows its opening odometer and nothing else', () => {
    const a = analyseBike(garage());
    expect(a.odometer.currentMetres).toBe(3_900_000);
    expect(a.isEmpty).toBe(true);
    expect(a.mileage.latest).toBeNull();
    expect(a.ownership.runningCostMinor).toBe(0);
  });

  it('step 6-7 — the first fill sets a baseline and produces no mileage', () => {
    const a = analyseBike(garage({ fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1)] }));
    expect(a.odometer.currentMetres).toBe(4_845_000);
    expect(a.mileage.count).toBe(0);
    expect(formatMileageValue(a.mileage.average, 'km_per_l')).toBe('—');
  });

  it('step 8 — the second full tank produces the first mileage figure', () => {
    const a = analyseBike({
      ...garage(),
      fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5180, 9, '2026-08-30', 2)],
    });
    expect(a.mileage.count).toBe(1);
    expect(a.mileage.latest!.distanceMetres).toBe(335_000);
    expect(formatMileageValue(a.mileage.latest!.efficiency, 'km_per_l')).toBe('37.2');
    expect(a.odometer.currentMetres).toBe(5_180_000);
  });

  it('step 9-10 — editing the first fill recalculates the interval', () => {
    const edited = { ...fill('f1', 4845, 11, '2026-08-20', 1), odometerMetres: 4_800_000 };
    const a = analyseBike({
      ...garage(),
      fuelEntries: [edited, fill('f2', 5180, 9, '2026-08-30', 2)],
    });
    expect(a.mileage.latest!.distanceMetres).toBe(380_000);
    expect(formatMileageValue(a.mileage.latest!.efficiency, 'km_per_l')).toBe('42.2');
  });

  it('step 11-12 — deleting the newer fill leaves no stale mileage behind', () => {
    const a = analyseBike({ ...garage(), fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1)] });
    expect(a.mileage.count).toBe(0);
    expect(a.mileage.latest).toBeNull();
    expect(a.mileage.average).toBeNull();
    // The odometer falls back to the highest remaining reading.
    expect(a.odometer.currentMetres).toBe(4_845_000);
  });

  it('step 13-15 — the odometer drives maintenance remaining', () => {
    const a = analyseBike({
      ...garage(),
      fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5180, 9, '2026-08-30', 2)],
    });
    const oil = a.maintenance.rules.find((r) => r.rule.id === 'rule-oil')!;
    // Completed at 3,900 km, 3,000 km interval → due at 6,900; now at 5,180.
    expect(oil.status.dueAtMetres).toBe(6_900_000);
    expect(oil.status.remainingMetres).toBe(1_720_000);
    expect(oil.status.kind).toBe('good');
  });

  it('step 16-18 — a completed service resets the rule it covered', () => {
    const resetRule: MaintenanceRule = {
      ...oilRule,
      lastCompletedMetres: 5_050_000,
      lastCompletedDate: '2026-08-24',
    };
    const a = analyseBike({
      ...garage(),
      rules: [resetRule],
      services: [service],
      fuelEntries: [fill('f2', 5180, 9, '2026-08-30', 2)],
    });
    const oil = a.maintenance.rules.find((r) => r.rule.id === 'rule-oil')!;
    expect(oil.status.dueAtMetres).toBe(8_050_000);
    expect(oil.status.remainingMetres).toBe(2_870_000);
  });

  it('step 19-21 — a part tracks its life against the current odometer', () => {
    const a = analyseBike({
      ...garage(),
      services: [service],
      parts: [brakePads],
      fuelEntries: [fill('f2', 5180, 9, '2026-08-30', 2)],
    });
    const pads = a.parts.active.find((p) => p.part.id === 'part-1')!;
    expect(pads.life.usedMetres).toBe(130_000);
    expect(pads.life.remainingPercent).toBe(98);
    expect(pads.life.isOverdue).toBe(false);
  });

  it('step 22 — a removed part freezes its usage and leaves the active list', () => {
    const removed: Part = { ...brakePads, removedOdometerMetres: 5_500_000, removedDate: '2026-09-01' };
    const a = analyseBike({
      ...garage(),
      services: [service],
      parts: [removed],
      fuelEntries: [fill('f2', 9000, 9, '2026-08-30', 2)],
    });
    expect(a.parts.active).toHaveLength(0);
    expect(a.parts.removed[0]!.life.actualLifeMetres).toBe(450_000);
  });

  it('step 23-26 — every cost is counted exactly once', () => {
    const a = analyseBike({
      ...garage(),
      fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5180, 9, '2026-08-30', 2)],
      services: [service],
      // Fitted during the service, so its BDT 1,900 is already inside BDT 2,400.
      parts: [brakePads],
      accessories: [tailBox],
      expenses: [parking],
    });

    const fuelSpend = Math.round(11 * 14_500) + Math.round(9 * 14_500);
    const expected = fuelSpend + 240_000 + 890_000 + 6_000;

    expect(a.ownership.runningCostMinor).toBe(expected);
    expect(a.spend.parts).toBe(0); // carried by the service
    expect(a.spend.services).toBe(240_000); // not 430,000
    expect(a.ledger.filter((l) => l.source === 'part')).toHaveLength(0);
    // A service's completions write no cost record at all now — the rule just moves.
    expect(a.ledger.filter((l) => l.source === 'maintenance')).toHaveLength(0);

    // The sum of the ledger must equal the sum of the breakdown, always.
    expect(a.spend.total).toBe(a.ledger.reduce((sum, l) => sum + l.amountMinor, 0));
  });

  it('step 27-30 — every dashboard and analytics figure is derived, and none is fabricated', () => {
    const a = analyseBike({
      ...garage(),
      fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5180, 9, '2026-08-30', 2)],
      services: [service],
      parts: [brakePads],
      accessories: [tailBox],
      expenses: [parking],
    });

    expect(formatDistance(a.odometer.currentMetres, 'km')).toBe('5,180 km');
    // BDT 2,900 fuel + 2,400 service + 8,900 accessory + 60 parking.
    expect(formatCurrency(a.ownership.runningCostMinor, 'BDT')).toBe('BDT 14,260');
    expect(a.ownership.purchasePriceMinor).toBe(28_500_000);
    expect(a.ownership.totalOwnershipMinor).toBe(28_500_000 + a.ownership.runningCostMinor);

    // Cost per km never borrows the purchase price.
    expect(a.ownership.costPerDistanceScaled).toBeGreaterThan(0);

    // Statistics that need five intervals stay withheld.
    expect(a.hasReliableStats).toBe(false);
    expect(a.mileage.best).toBeNull();
    expect(a.mileage.lastFive).toBeNull();
  });

  it('step 31-32 — analysing another motorcycle never sees this one’s records', () => {
    const otherBike: Bike = { ...bike, id: 'bike-2', nickname: 'Second bike' };
    const a = analyseBike({
      ...garage(),
      bike: otherBike,
      // The provider scopes every query by bikeId; here that means empty inputs.
      fuelEntries: [],
      services: [],
      parts: [],
      accessories: [],
      expenses: [],
      odometerReadings: [],
    });
    expect(a.isEmpty).toBe(true);
    expect(a.odometer.currentMetres).toBeNull();
    expect(a.ownership.runningCostMinor).toBe(0);
  });
});

describe('the numbers never break', () => {
  const cases: [string, GarageData][] = [
    ['an empty garage', garage()],
    [
      'one fill only',
      { ...garage(), fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1)] },
    ],
    [
      'two fills at the same odometer',
      {
        ...garage(),
        fuelEntries: [fill('f1', 5000, 10, '2026-08-20', 1), fill('f2', 5000, 10, '2026-08-21', 2)],
      },
    ],
    [
      'a zero-cost service',
      { ...garage(), services: [{ ...service, totalCostMinor: 0, labourCostMinor: 0, partsCostMinor: 0 }] },
    ],
    [
      'no odometer history at all',
      { ...garage(), odometerReadings: [] },
    ],
  ];

  it.each(cases)('renders finite figures for %s', (_label, data) => {
    const a = analyseBike(data);
    const numbers = [
      a.ownership.runningCostMinor,
      a.spend.total,
      a.thisMonthMinor,
      a.odometer.totalDistanceMetres,
      a.mileage.count,
    ];
    for (const value of numbers) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }
    // Anything that cannot be computed is null, never NaN or Infinity.
    for (const maybe of [a.mileage.average, a.mileage.lastFive, a.ownership.costPerDistanceScaled]) {
      if (maybe !== null && typeof maybe === 'number') {
        expect(Number.isFinite(maybe)).toBe(true);
      }
    }
  });
});

describe('cost basis', () => {
  const withPrice = { ...bike, purchasePriceMinor: 28_500_000 };
  const data = (basis: 'running' | 'total') => ({
    ...garage(),
    bike: withPrice,
    fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5180, 9, '2026-08-30', 2)],
    units: { ...units, costBasis: basis },
  });

  it('running counts what it costs to keep on the road, not what it cost to buy', () => {
    const a = analyseBike(data('running'));
    expect(a.ownership.headlineCostMinor).toBe(a.ownership.runningCostMinor);
    expect(a.ownership.headlineCostMinor).toBeLessThan(28_500_000);
  });

  it('total adds the purchase price, and cost per distance follows it', () => {
    const running = analyseBike(data('running'));
    const total = analyseBike(data('total'));
    expect(total.ownership.headlineCostMinor).toBe(running.ownership.runningCostMinor + 28_500_000);
    expect(total.ownership.totalOwnershipMinor).toBe(total.ownership.headlineCostMinor);
    // The headline is what cost/km divides, so the two must move together.
    expect(total.ownership.costPerDistanceScaled).toBeGreaterThan(
      running.ownership.costPerDistanceScaled ?? 0,
    );
  });

  it('falls back to running when there is no purchase price to add', () => {
    // A "total" that silently equals running would be a figure that does not
    // mean what its label says.
    const a = analyseBike({ ...data('total'), bike: { ...bike, purchasePriceMinor: null } });
    expect(a.ownership.totalOwnershipMinor).toBeNull();
    expect(a.ownership.headlineCostMinor).toBe(a.ownership.runningCostMinor);
  });
});

describe('cost per distance measures consumption', () => {
  const ridden = [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5118, 6, '2026-08-30', 2)];

  it('a one-off accessory does not inflate cost per kilometre', () => {
    // The case seen on a real bike: BDT 6,000 of accessories over 273 tracked km
    // turned a few taka per km into twenty-six.
    const withoutAccessory = analyseBike({ ...garage(), fuelEntries: ridden });
    const withAccessory = analyseBike({
      ...garage(), fuelEntries: ridden,
      accessories: [{ ...tailBox, purchaseCostMinor: 600_000, installationCostMinor: 0 }],
    });
    expect(withAccessory.ownership.costPerDistanceScaled)
      .toBe(withoutAccessory.ownership.costPerDistanceScaled);
  });

  it('but the accessory still counts in what the bike has cost', () => {
    const withAccessory = analyseBike({
      ...garage(), fuelEntries: ridden,
      accessories: [{ ...tailBox, purchaseCostMinor: 600_000, installationCostMinor: 0 }],
    });
    expect(withAccessory.ownership.runningCostMinor)
      .toBeGreaterThan(withAccessory.ownership.consumptionCostMinor);
    expect(withAccessory.ownership.runningCostMinor - withAccessory.ownership.consumptionCostMinor)
      .toBe(600_000);
  });
});

describe('cost per distance is given early, with the caveat that it is early', () => {
  const shortLog = [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5118, 6, '2026-08-30', 2)];

  it('answers over a few hundred kilometres, and flags the figure as unsettled', () => {
    // 273 km tracked and a suspension replacement on it. The arithmetic is the
    // rider's own spending over their own distance, so it is shown — but one
    // purchase still dominates it, which `costPerDistanceSettled` says.
    // No opening reading, so the tracked span is only the 273 km between fills.
    const a = analyseBike({
      ...garage(), odometerReadings: [], fuelEntries: shortLog,
      services: [{ ...service, totalCostMinor: 600_000, partsCostMinor: 600_000, labourCostMinor: 0 }],
    });
    expect(a.odometer.totalDistanceMetres).toBeLessThan(1_000_000);
    expect(a.ownership.costPerDistanceScaled).not.toBeNull();
    expect(a.ownership.costPerDistanceSettled).toBe(false);
    expect(a.ownership.runningCostMinor).toBeGreaterThan(600_000);
  });

  it('answers once the bike has covered enough ground', () => {
    const longLog = [
      fill('f1', 4845, 11, '2026-08-20', 1),
      fill('f2', 6200, 28, '2026-09-05', 2),
    ];
    const a = analyseBike({ ...garage(), odometerReadings: [], fuelEntries: longLog });
    expect(a.odometer.totalDistanceMetres).toBeGreaterThanOrEqual(1_000_000);
    expect(a.ownership.costPerDistanceScaled).not.toBeNull();
  });
});

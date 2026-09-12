import type { Bike, FuelEntry } from '@/types';
import type { GarageData } from './analytics';
import { analyseBike, hasChartData, monthlySeries } from './analytics';
import { formatMileageValue } from '@/utils/format';

const units = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l', costBasis: 'running' } as const;

const bike: Bike = {
  id: 'b1',
  userId: 'u1',
  createdAt: 1,
  updatedAt: 1,
  manufacturer: 'Honda',
  model: 'Hornet 2.0',
  nickname: 'Honda Hornet',
  year: 2025,
  tankCapacityMl: 12_000,
  purchasePriceMinor: 28_500_000, // BDT 285,000
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

const fuel = (id: string, km: number, litres: number, date: string): FuelEntry => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: Number(id.slice(1)),
  updatedAt: 1,
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
  clientRef: `r-${id}`,
});

const emptyGarage: GarageData = {
  bike,
  fuelEntries: [],
  fuelAdjustments: [],
  odometerReadings: [],
  rules: [],
  services: [],
  parts: [],
  accessories: [],
  expenses: [],
  units,
  today: '2026-09-01',
};

describe('a brand new garage', () => {
  const a = analyseBike(emptyGarage);

  it('reports emptiness rather than inventing zeros', () => {
    expect(a.isEmpty).toBe(true);
    expect(a.hasMileage).toBe(false);
    expect(a.odometer.currentMetres).toBeNull();
    expect(a.mileage.average).toBeNull();
    expect(a.mileage.latest).toBeNull();
    expect(a.mileage.best).toBeNull();
    expect(a.ownership.costPerDistanceScaled).toBeNull();
  });

  it('still produces safe, empty collections', () => {
    expect(a.ledger).toEqual([]);
    expect(a.spend.total).toBe(0);
    expect(a.maintenance.rules).toEqual([]);
    expect(a.maintenance.nextDue).toBeNull();
    expect(a.parts.active).toEqual([]);
    expect(a.fuel.averagePricePerLitreMinor).toBeNull();
  });

  it('renders a monthly series of real months with zero totals', () => {
    const series = monthlySeries(a, 3);
    expect(series.map((m) => m.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(hasChartData(series.map((m) => m.totalMinor))).toBe(false);
  });
});

describe('the worked example from the design', () => {
  const a = analyseBike({
    ...emptyGarage,
    fuelEntries: [fuel('f1', 4845, 11, '2026-08-20'), fuel('f2', 5180, 9, '2026-08-30')],
    odometerReadings: [
      {
        id: 'o1',
        userId: 'u1',
        bikeId: 'b1',
        createdAt: 1,
        updatedAt: 1,
        metres: 3_900_000,
        date: '2026-07-12',
        source: 'manual',
        sourceId: null,
        note: null,
      },
    ],
  });

  it('derives the current odometer from the fuel log', () => {
    expect(a.odometer.currentMetres).toBe(5_180_000);
  });

  it('produces one interval at 37.2 km/L', () => {
    expect(a.mileage.count).toBe(1);
    expect(formatMileageValue(a.mileage.latest!.efficiency, 'km_per_l')).toBe('37.2');
    expect(a.mileage.confidence).toBe('high');
  });

  it('withholds the statistics that need five intervals', () => {
    expect(a.hasReliableStats).toBe(false);
    expect(a.mileage.lastFive).toBeNull();
    expect(a.mileage.best).toBeNull();
  });

  it('totals fuel spending for the month', () => {
    expect(a.fuel.thisMonthFills).toBe(0); // both fills are August, today is September
    expect(a.spend.fuel).toBe(Math.round(11 * 14_500) + Math.round(9 * 14_500));
  });

  it('keeps purchase price out of the running cost', () => {
    expect(a.ownership.runningCostMinor).toBe(a.spend.total);
    expect(a.ownership.purchasePriceMinor).toBe(28_500_000);
    expect(a.ownership.totalOwnershipMinor).toBe(28_500_000 + a.spend.total);
    // Cost per km is built from running cost alone.
    expect(a.ownership.costPerDistanceScaled).toBeGreaterThan(0);
    expect(a.ownership.costPerDistanceScaled!).toBeLessThan(100_000);
  });
});

describe('company allowance', () => {
  it('offsets what the rider pays without hiding the true cost', () => {
    const a = analyseBike({
      ...emptyGarage,
      today: '2026-08-31',
      bike: {
        ...bike,
        company: { enabled: true, companyName: 'TechScape Ltd', monthlyAllowanceMinor: 300_000 },
      },
      fuelEntries: [fuel('f1', 4845, 11, '2026-08-20'), fuel('f2', 5180, 9, '2026-08-30')],
    });

    expect(a.allowance.enabled).toBe(true);
    expect(a.allowance.fuelSpendMinor).toBe(290_000);
    expect(a.allowance.riderFuelCostMinor).toBe(0);
    expect(a.allowance.usedMinor).toBe(290_000);
    // The true operating cost is untouched by the allowance.
    expect(a.allowance.trueOperatingCostMinor).toBe(a.thisMonthMinor);
  });

  it('charges the rider for anything over the allowance', () => {
    const a = analyseBike({
      ...emptyGarage,
      today: '2026-08-31',
      bike: {
        ...bike,
        company: { enabled: true, companyName: 'TechScape Ltd', monthlyAllowanceMinor: 100_000 },
      },
      fuelEntries: [fuel('f1', 4845, 11, '2026-08-20')],
    });
    expect(a.allowance.riderFuelCostMinor).toBe(159_500 - 100_000);
    expect(a.allowance.usedFraction).toBe(1);
  });
});

describe('bikes never mix', () => {
  it('analyses only the records it is handed', () => {
    const a = analyseBike({
      ...emptyGarage,
      fuelEntries: [fuel('f1', 4845, 11, '2026-08-20')],
    });
    expect(a.fuel.entries.every((f) => f.bikeId === 'b1')).toBe(true);
  });
});

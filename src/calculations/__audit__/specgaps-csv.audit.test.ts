/**
 * Audit 15.8 / rule 9 — CSV export: a partial (or unknown) fill row must never
 * carry a mileage value; only the fill that closes a full-to-full interval does.
 *
 * `exportFuelCsv` is not pure (it writes a file and opens the share sheet), so
 * the two Expo modules are stubbed and the written text is captured.
 */
import type { FuelEntry, UnitPreferences } from '@/types';

let written = '';

jest.mock('expo-file-system', () => ({
  Paths: { cache: '/audit-cache' },
  File: class {
    uri = 'file:///audit-cache/out.csv';
    write(text: string) {
      written = text;
    }
  },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => undefined,
}));

// eslint-disable-next-line import/first
import { exportFuelCsv } from '@/features/premium/exportCsv';

const units: UnitPreferences = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l', costBasis: 'running' };

function fill(
  id: string,
  km: number,
  litres: number,
  date: string,
  fillType: FuelEntry['fillType'],
  order: number,
): FuelEntry {
  const litresMl = litres * 1000;
  const pricePerLitreMinor = 14_500; // BDT 145.00 / L
  return {
    id,
    userId: 'u1',
    bikeId: 'b1',
    createdAt: order,
    updatedAt: order,
    date,
    odometerMetres: km * 1000,
    litresMl,
    pricePerLitreMinor,
    // litresMl × price / 1000, exact for these fixtures.
    totalCostMinor: (litresMl * pricePerLitreMinor) / 1000,
    currency: 'BDT',
    fillType,
    missedPreviousFill: false,
    station: null,
    notes: null,
    receiptPath: null,
    clientRef: id,
  };
}

// Header columns, by index, as exportCsv.ts writes them.
const COL = {
  date: 0, odometer: 1, fuel: 2, intervalFuel: 3, fillType: 4, price: 5, total: 6,
  distance: 7, mileage: 8, confidence: 9, station: 10, notes: 11,
} as const;

function rows(): string[][] {
  return written.split('\n').map((line) => line.split(','));
}

describe('CSV export — partial fills never carry a mileage (audit rule 9)', () => {
  beforeEach(() => {
    written = '';
  });

  it('only the closing full tank carries interval fuel, distance, mileage and confidence', async () => {
    const entries = [
      fill('f1', 1000, 10, '2026-08-01', 'full', 1),
      fill('f2', 1100, 5, '2026-08-08', 'partial', 2),
      fill('f3', 1250, 8, '2026-08-15', 'full', 3),
    ];
    await exportFuelCsv(entries, [], 'BDT', units);

    const [header, r1, r2, r3] = rows();
    expect(header).toHaveLength(12);
    expect(header?.[COL.mileage]).toBe('Mileage (km_per_l)');

    // f1 opens the interval: no figure on the opening fill.
    expect(r1?.[COL.fillType]).toBe('full');
    expect(r1?.[COL.intervalFuel]).toBe('');
    expect(r1?.[COL.distance]).toBe('');
    expect(r1?.[COL.mileage]).toBe('');
    expect(r1?.[COL.confidence]).toBe('');
    // 10 L × 145.00 = 1450.00
    expect(r1?.[COL.price]).toBe('145.00');
    expect(r1?.[COL.total]).toBe('1450.00');

    // f2 is partial: it contributes fuel to the interval but must carry NO mileage.
    expect(r2?.[COL.fillType]).toBe('partial');
    expect(r2?.[COL.fuel]).toBe('5.00');
    expect(r2?.[COL.intervalFuel]).toBe('');
    expect(r2?.[COL.distance]).toBe('');
    expect(r2?.[COL.mileage]).toBe('');
    expect(r2?.[COL.confidence]).toBe('');

    // f3 closes f1→f3: distance 1250 km − 1000 km = 250.0 km;
    // interval fuel = 5 L (partial) + 8 L (closing) = 13.00 L;
    // mileage = 250 km / 13 L = 19.2307… → '19.23'; one partial → 'medium'.
    expect(r3?.[COL.fillType]).toBe('full');
    expect(r3?.[COL.intervalFuel]).toBe('13.00');
    expect(r3?.[COL.distance]).toBe('250.0');
    expect(r3?.[COL.mileage]).toBe('19.23');
    expect(r3?.[COL.confidence]).toBe('medium');
  });

  it('a trailing partial and an unknown fill carry no mileage even when the log has intervals', async () => {
    const entries = [
      fill('f1', 1000, 10, '2026-08-01', 'full', 1),
      fill('f2', 1200, 10, '2026-08-15', 'full', 2),
      fill('f3', 1300, 4, '2026-08-20', 'unknown', 3),
      fill('f4', 1350, 3, '2026-08-25', 'partial', 4),
    ];
    await exportFuelCsv(entries, [], 'BDT', units);

    const [, r1, r2, r3, r4] = rows();
    expect(r1?.[COL.mileage]).toBe('');
    // f2 closes f1→f2: 200 km / 10 L = 20.00 km/L, high confidence.
    expect(r2?.[COL.mileage]).toBe('20.00');
    expect(r2?.[COL.confidence]).toBe('high');
    expect(r3?.[COL.fillType]).toBe('unknown');
    expect(r3?.[COL.mileage]).toBe('');
    expect(r4?.[COL.fillType]).toBe('partial');
    expect(r4?.[COL.mileage]).toBe('');
    expect(r4?.[COL.intervalFuel]).toBe('');
  });

  it('a partial fill dated on the same day as a closing full tank still carries no mileage', async () => {
    const entries = [
      fill('f1', 1000, 10, '2026-08-01', 'full', 1),
      fill('f2', 1100, 5, '2026-08-15', 'partial', 2),
      fill('f3', 1250, 8, '2026-08-15', 'full', 3),
    ];
    await exportFuelCsv(entries, [], 'BDT', units);
    const body = rows().slice(1);
    const partialRow = body.find((r) => r[COL.fillType] === 'partial');
    expect(partialRow).toBeDefined();
    expect(partialRow?.[COL.mileage]).toBe('');
    // Exactly one row in the whole file carries a mileage figure.
    expect(body.filter((r) => r[COL.mileage] !== '').length).toBe(1);
  });
});

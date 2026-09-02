import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { calculateMileageIntervals } from '@/calculations/mileage';
import { efficiencyToDisplay, metresToDisplay, mlToDisplay } from '@/calculations/units';
import { AppError } from '@/services/errors';
import type { CurrencyCode, FuelAdjustment, FuelEntry, UnitPreferences } from '@/types';
import { currencyDecimals } from '@/calculations/money';

/**
 * The fuel history export.
 *
 * Written to the app's own cache directory and handed to the system share sheet,
 * so nothing is uploaded anywhere and no storage permission is needed
 * (requirement 48 / 50).
 */

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function major(minor: number, currency: CurrencyCode): string {
  const divisor = 10 ** currencyDecimals(currency);
  return (minor / divisor).toFixed(2);
}

export async function exportFuelCsv(
  entries: readonly FuelEntry[],
  adjustments: readonly FuelAdjustment[],
  currency: CurrencyCode,
  units: UnitPreferences,
): Promise<void> {
  if (entries.length === 0) {
    throw new AppError('validation', 'There are no fuel logs to export yet.');
  }

  const intervals = calculateMileageIntervals(entries, adjustments);
  const byClosingEntry = new Map(intervals.map((i) => [i.toEntryId, i]));

  const header = [
    'Date',
    `Odometer (${units.distance})`,
    `Fuel (${units.volume})`,
    `Interval fuel (${units.volume})`,
    'Fill type',
    `Price per ${units.volume} (${currency})`,
    `Total (${currency})`,
    `Distance (${units.distance})`,
    `Mileage (${units.mileage})`,
    'Confidence',
    'Station',
    'Notes',
  ];

  const rows = [...entries]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((entry) => {
      const interval = byClosingEntry.get(entry.id) ?? null;
      return [
        entry.date,
        metresToDisplay(entry.odometerMetres, units.distance).toFixed(1),
        mlToDisplay(entry.litresMl, units.volume).toFixed(2),
        interval ? mlToDisplay(interval.fuelMl, units.volume).toFixed(2) : '',
        entry.fillType,
        major(entry.pricePerLitreMinor, entry.currency),
        major(entry.totalCostMinor, entry.currency),
        interval ? metresToDisplay(interval.distanceMetres, units.distance).toFixed(1) : '',
        interval ? efficiencyToDisplay(interval.efficiency, units.mileage).toFixed(2) : '',
        interval ? interval.confidence : '',
        entry.station ?? '',
        entry.notes ?? '',
      ];
    });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');

  const directory = FileSystem.Paths.cache;
  const file = new FileSystem.File(directory, `revora-fuel-${Date.now()}.csv`);
  file.write(csv);

  if (!(await Sharing.isAvailableAsync())) {
    throw new AppError('unknown', 'Sharing is not available on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export fuel history',
    UTI: 'public.comma-separated-values-text',
  });
}

import React from 'react';

import { Badge, RecordRow } from '@/components';
import type { MileageInterval } from '@/calculations/mileage';
import { mileageUnitLabel } from '@/calculations/units';
import type { FuelEntry, UnitPreferences } from '@/types';
import {
  formatCurrency,
  formatDistance,
  formatMileageValue,
  formatVolume,
  NO_VALUE,
} from '@/utils/format';
import { formatShortDate } from '@/utils/date';

const FILL_LABEL: Record<FuelEntry['fillType'], string> = {
  full: 'Full tank',
  partial: 'Partial',
  unknown: 'Unknown',
};

/**
 * One fill in the log, exactly as the board draws it: no icon plate — the date
 * and the odometer carry the row — a supporting line of litres, fill type and
 * station, then the amount with the interval's km/L pill under it.
 *
 * The pill only appears on a fill that *closed* a full-to-full interval. A
 * partial fill has no mileage of its own, so it takes the muted `—` pill the
 * board draws rather than a figure that would be a guess.
 */
export function FuelRow({
  entry,
  interval,
  units,
  onPress,
  testID,
}: {
  entry: FuelEntry;
  /** The interval this entry closed, if any. */
  interval: MileageInterval | null;
  units: UnitPreferences;
  onPress: () => void;
  testID?: string;
}) {
  const subtitle = [
    formatVolume(entry.litresMl, units.volume),
    FILL_LABEL[entry.fillType],
    entry.station,
  ]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' · ');

  return (
    <RecordRow
      variant="flush"
      onPress={onPress}
      testID={testID}
      title={`${formatShortDate(entry.date)} · ${formatDistance(entry.odometerMetres, units.distance)}`}
      subtitle={subtitle}
      amount={formatCurrency(entry.totalCostMinor, entry.currency)}
      badge={
        interval ? (
          <Badge
            label={`${formatMileageValue(interval.efficiency, units.mileage)} ${mileageUnitLabel(units.mileage)}`}
            tone="accent"
          />
        ) : (
          <Badge label={NO_VALUE} tone="neutral" />
        )
      }
    />
  );
}

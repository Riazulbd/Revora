import React from 'react';
import { View } from 'react-native';

import { Badge, Icon, RecordRow, RowIcon, Txt } from '@/components';
import type { MileageInterval } from '@/calculations/mileage';
import type { FuelEntry, UnitPreferences } from '@/types';
import { formatCurrency, formatDistance, formatMileageValue, formatPricePerVolume, formatVolume, NO_VALUE } from '@/utils/format';
import { formatLongDate } from '@/utils/date';
import { useTheme } from '@/theme';

const FILL_LABEL: Record<FuelEntry['fillType'], string> = {
  full: 'Full',
  partial: 'Partial',
  unknown: 'Unknown',
};

/**
 * One row of the fuel log, matching the design: an accent icon plate, the date,
 * the odometer and volume, a supporting line, then the cost with the interval's
 * km/L badge.
 *
 * The badge only appears on a fill that *closed* a full-to-full interval — a
 * partial fill has no mileage of its own and showing one would be a lie.
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
  const { c } = useTheme();
  const adjusted = interval !== null && interval.hasAdjustments;

  const subtitle = `${formatDistance(entry.odometerMetres, units.distance)} · ${formatVolume(
    entry.litresMl,
    units.volume,
  )} · ${FILL_LABEL[entry.fillType]}`;

  const caption = interval
    ? `${formatDistance(interval.distanceMetres, units.distance)} · ${formatPricePerVolume(
        entry.pricePerLitreMinor,
        entry.currency,
      )}/${units.volume}`
    : `${adjusted ? 'Adjusted · ' : ''}${formatPricePerVolume(entry.pricePerLitreMinor, entry.currency)}/${units.volume}`;

  return (
    <RecordRow
      onPress={onPress}
      testID={testID}
      leading={
        <RowIcon>
          <Icon name="fuel" size={17} color={c.acc} />
        </RowIcon>
      }
      title={formatLongDate(entry.date)}
      subtitle={subtitle}
      caption={caption}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <Txt role="rowTitle" numberOfLines={1}>
            {formatCurrency(entry.totalCostMinor, entry.currency)}
          </Txt>
          {interval ? (
            <Badge
              label={`${formatMileageValue(interval.efficiency, units.mileage)} ${
                units.mileage === 'km_per_l' ? 'km/L' : units.mileage === 'l_per_100km' ? 'L/100km' : 'MPG'
              }`}
              tone="accent"
            />
          ) : (
            <Txt role="badge" tone="mut">
              {NO_VALUE}
            </Txt>
          )}
        </View>
      }
    />
  );
}

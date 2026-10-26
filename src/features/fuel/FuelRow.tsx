import React from 'react';
import { Pressable, View } from 'react-native';

import { Badge, DateChip, Txt } from '@/components';
import type { MileageInterval } from '@/calculations/mileage';
import { mileageUnitLabel } from '@/calculations/units';
import type { FuelEntry, UnitPreferences } from '@/types';
import { formatCurrencySymbol, formatDistance, formatMileageValue, formatVolume } from '@/utils/format';

const FILL_TAG: Record<FuelEntry['fillType'], { label: string; tone: 'good' | 'warn' | 'neutral' }> = {
  full: { label: 'Full', tone: 'good' },
  partial: { label: 'Partial', tone: 'warn' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};

/**
 * One fill in the log (Figma `Fill row`): `padding:12px 0; gap:12px` — the
 * date chip; the litres (`600 15px`) with a Full / Partial tag, and the
 * odometer and station under them; on the right the amount (`600 15px`) over
 * the interval's mileage in green.
 *
 * Mileage only appears on a fill that *closed* a full-to-full interval. Any
 * other fill has no figure of its own, so it says "km/L later" in grey rather
 * than print a guess.
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
  const tag = FILL_TAG[entry.fillType];
  const unitLabel = mileageUnitLabel(units.mileage);
  const detail = [formatDistance(entry.odometerMetres, units.distance), entry.station]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' · ');
  const litres = formatVolume(entry.litresMl, units.volume);
  const amount = formatCurrencySymbol(entry.totalCostMinor, entry.currency);
  const mileage = interval ? `${formatMileageValue(interval.efficiency, units.mileage)} ${unitLabel}` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${litres}, ${tag.label}. ${detail}. ${amount}${mileage ? `, ${mileage}` : ''}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <DateChip date={entry.date} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt role="rowTitleLarge" numberOfLines={1}>
            {litres}
          </Txt>
          <Badge label={tag.label} tone={tag.tone} size="chip" />
        </View>
        <Txt role="meta" tone="mut" numberOfLines={1}>
          {detail}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <Txt role="rowTitleLarge" numberOfLines={1}>
          {amount}
        </Txt>
        {mileage ? (
          <Txt role="smallStrong" tone="good" numberOfLines={1}>
            {mileage}
          </Txt>
        ) : (
          <Txt role="micro" tone="mut" numberOfLines={1}>
            {`${unitLabel} later`}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}

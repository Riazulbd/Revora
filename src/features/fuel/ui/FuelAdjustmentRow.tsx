import React from 'react';
import { View } from 'react-native';

import { Badge, DateChip, Txt } from '@/components';
import { adjustmentReasonLabel } from '@/calculations/fuellog';
import type { FuelAdjustment, UnitPreferences } from '@/types';
import { formatVolume, NO_VALUE } from '@/utils/format';

/**
 * An adjustment on the fuel log, in the fill row's shape: the date chip, the
 * signed volume with an "Adjustment" tag, the reason under it, and a muted dash
 * where a fill would show what it cost.
 *
 * No odometer is shown on purpose. An adjustment records fuel that left the
 * tank between fills; no reading is taken when it happens, and interpolating
 * one from the fills around it would be a figure the rider never gave us.
 */
export function FuelAdjustmentRow({
  adjustment,
  units,
  testID,
}: {
  adjustment: FuelAdjustment;
  units: UnitPreferences;
  testID?: string;
}) {
  const sign = adjustment.millilitres > 0 ? '+' : '−';
  const volume = `${sign}${formatVolume(Math.abs(adjustment.millilitres), units.volume)}`;
  const reason = adjustmentReasonLabel(adjustment);

  return (
    <View
      testID={testID}
      accessibilityLabel={`Adjustment ${volume}. ${reason}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
    >
      <DateChip date={adjustment.date} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt role="rowTitleLarge" numberOfLines={1}>
            {volume}
          </Txt>
          <Badge label="Adjustment" tone="neutral" size="chip" />
        </View>
        <Txt role="meta" tone="mut" numberOfLines={1}>
          {reason}
        </Txt>
      </View>
      <Txt role="rowTitleLarge" tone="mut">
        {NO_VALUE}
      </Txt>
    </View>
  );
}

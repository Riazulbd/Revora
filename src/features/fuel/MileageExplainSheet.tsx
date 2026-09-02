import React from 'react';
import { View } from 'react-native';

import { Sheet, Txt } from '@/components';
import type { BikeAnalytics } from '@/calculations/analytics';
import { RELIABLE_INTERVALS_REQUIRED } from '@/calculations/mileage';
import { formatDistance, formatMileage, formatVolume } from '@/utils/format';
import { useTheme } from '@/theme';

/**
 * "How is this calculated?" — the design's `explain` sheet, filled with the
 * rider's own latest interval rather than an illustration.
 *
 * This is the app explaining its own arithmetic, so it must show the real
 * numbers that produced the figure on screen.
 */
export function MileageExplainSheet({
  visible,
  onClose,
  analytics,
}: {
  visible: boolean;
  onClose: () => void;
  analytics: BikeAnalytics | null;
}) {
  const { c, radius } = useTheme();
  const latest = analytics?.mileage.latest ?? null;
  const units = analytics?.units;

  return (
    <Sheet visible={visible} onClose={onClose} title="How mileage is calculated" testID="sheet-explain">
      {latest && units ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: c.sur2,
            borderRadius: radius.input,
            paddingVertical: 16,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <Txt role="cardTitle">{formatDistance(latest.distanceMetres, units.distance)}</Txt>
          <Txt role="cardTitle" tone="mut">
            ÷
          </Txt>
          <Txt role="cardTitle">{formatVolume(latest.fuelMl, units.volume)}</Txt>
          <Txt role="cardTitle" tone="mut">
            =
          </Txt>
          <Txt role="cardTitle" tone="acc">
            {formatMileage(latest.efficiency, units.mileage)}
          </Txt>
        </View>
      ) : null}

      <Txt role="body" tone="mut" style={{ marginBottom: 12 }}>
        Revora measures the distance between two <Txt role="body">full-tank</Txt> fills and divides it by the
        fuel used in between. Partial fills roll into the next full-tank interval; adjustments (spillage, leaks,
        service use) are excluded so the number stays honest.
      </Txt>

      {latest && latest.rawFuelMl !== latest.fuelMl && units ? (
        <Txt role="body" tone="mut" style={{ marginBottom: 12 }}>
          This interval logged {formatVolume(latest.rawFuelMl, units.volume)} of fuel, of which{' '}
          {formatVolume(latest.rawFuelMl - latest.fuelMl, units.volume)} was adjusted out. Your original entry
          is unchanged.
        </Txt>
      ) : null}

      <Txt role="metaSmall" tone="mut">
        {analytics === null || analytics.mileage.count === 0
          ? `No complete full-to-full interval yet — the first figure appears after your second full-tank fill. Averages and best/worst unlock at ${RELIABLE_INTERVALS_REQUIRED}.`
          : analytics.mileage.count < RELIABLE_INTERVALS_REQUIRED
            ? `${analytics.mileage.count} reliable interval${analytics.mileage.count === 1 ? '' : 's'} so far — averages and best/worst unlock at ${RELIABLE_INTERVALS_REQUIRED}.`
            : `Built from ${analytics.mileage.count} reliable intervals.`}
      </Txt>
    </Sheet>
  );
}

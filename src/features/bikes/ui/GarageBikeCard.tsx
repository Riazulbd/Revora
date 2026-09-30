import React from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Card, PhotoThumb, Txt } from '@/components';
import type { GarageBikeSummary } from '@/calculations/garage';
import { useImageUrl } from '@/features/shared/useImageUrl';
import { formatDistance, formatVolume, NO_VALUE } from '@/utils/format';
import { formatMonthLong } from '@/utils/date';
import { useTheme } from '@/theme';
import type { DistanceUnit, VolumeUnit } from '@/types';

/**
 * One motorcycle on the Garage board's several-bikes layout.
 *
 * Three states, all drawn by the board: the one in use carries a 1.5px accent
 * border and an ACTIVE pill; the others say "Tap to switch"; a sold one is
 * dimmed, labelled ARCHIVED and inert, with "records kept" in place of its
 * odometer — because the point of keeping it on the screen is to tell a rider
 * their history did not go anywhere.
 *
 * Status is never colour alone: every card says what it is in words.
 */
export function GarageBikeCard({
  bike,
  distanceUnit,
  volumeUnit,
  onPress,
  testID,
}: {
  bike: GarageBikeSummary;
  distanceUnit: DistanceUnit;
  volumeUnit: VolumeUnit;
  /** Omitted for an archived motorcycle, which the board draws as inert. */
  onPress?: () => void;
  testID: string;
}) {
  const { c, radius } = useTheme();
  const photo = useImageUrl(bike.photoPath);
  const active = bike.status === 'active';
  const archived = bike.status === 'archived';

  const odometer = bike.odometerMetres === null ? NO_VALUE : formatDistance(bike.odometerMetres, distanceUnit);
  const tank = bike.tankCapacityMl === null ? null : `${formatVolume(bike.tankCapacityMl, volumeUnit)} tank`;

  const subtitle = archived
    ? [bike.descriptor, bike.archivedMonth === null ? null : `sold ${formatMonthLong(bike.archivedMonth)}`, 'records kept']
        .filter((part) => part !== null && part !== '')
        .join(' · ')
    : bike.descriptor;

  const body = (
    <Card
      variant="flush"
      style={{
        borderRadius: radius.card,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? c.acc : c.brd,
        opacity: archived ? 0.6 : 1,
      }}
    >
      <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {archived ? (
          <View style={{ width: 84, height: 64, borderRadius: radius.tile, backgroundColor: c.sur2, flexShrink: 0 }} />
        ) : (
          <PhotoThumb uri={photo} accessibilityLabel={`${bike.nickname} photo`} />
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt role="cardTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
              {bike.nickname}
            </Txt>
            {active ? <Badge label="ACTIVE" tone="accent" uppercase /> : null}
            {archived ? <Badge label="ARCHIVED" tone="neutral" uppercase /> : null}
          </View>

          {subtitle === '' ? null : (
            <Txt role="meta" tone="mut" numberOfLines={2} style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          )}

          {archived ? null : (
            <Txt role="rowTitleDense" numberOfLines={1} style={{ marginTop: 6 }}>
              {odometer}
              {tank === null ? null : (
                <Txt role="meta" tone="mut">
                  {` · ${tank}`}
                </Txt>
              )}
            </Txt>
          )}
        </View>

        {bike.status === 'other' ? (
          <Txt role="smallStrong" tone="mut" style={{ flexShrink: 0 }}>
            Tap to switch
          </Txt>
        ) : null}
      </View>
    </Card>
  );

  if (!onPress) return <View testID={testID}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={
        active
          ? `${bike.nickname}, active motorcycle. Open motorcycle profile.`
          : `${bike.nickname}. Tap to switch to this motorcycle.`
      }
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {body}
    </Pressable>
  );
}

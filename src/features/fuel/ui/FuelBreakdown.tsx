import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { Card, Divider, Eyebrow, Icon, Txt } from '@/components';
import { adjustmentReasonLabel } from '@/calculations/fuellog';
import type { MileageInterval } from '@/calculations/mileage';
import type { FuelAdjustment, FuelEntry, UnitPreferences } from '@/types';
import { formatShortDate } from '@/utils/date';
import {
  formatDistance,
  formatDistanceValue,
  formatMileage,
  formatMileageValue,
  formatVolume,
  formatVolumeValue,
} from '@/utils/format';
import { fontFamily, HIT_SIZE, useTheme } from '@/theme';

const FILL_PHRASE: Record<FuelEntry['fillType'], string> = {
  full: 'first full tank in this stretch of the log',
  partial: 'partial fill',
  unknown: 'fill of unknown tank level',
};

/**
 * "How 41.2 was measured" — the arithmetic behind the figure, on the same
 * screen as the figure.
 *
 * Every number here comes off the interval the fill closed, so what the rider
 * reads is the sum the app actually did, not a re-derivation that could drift
 * from it.
 */
export function FuelMileageBreakdown({
  entry,
  interval,
  units,
  style,
}: {
  entry: FuelEntry;
  interval: MileageInterval;
  units: UnitPreferences;
  style?: { marginTop?: number };
}) {
  // A partial fill before this one, or an adjustment inside the interval, means
  // the fuel that did the work is not the fuel in this fill — so say which.
  const wholeFillOnly = interval.fuelMl === entry.litresMl;

  return (
    <Card style={{ gap: 10, ...style }} testID="card-mileage-breakdown">
      <Eyebrow>{`How ${formatMileageValue(interval.efficiency, units.mileage)} was measured`}</Eyebrow>

      <BreakdownRow
        label="Distance since last full tank"
        note={`(${formatShortDate(interval.fromDate)} · ${formatDistance(interval.fromOdometerMetres, units.distance)})`}
        value={formatDistance(interval.distanceMetres, units.distance)}
      />
      <BreakdownRow
        label={wholeFillOnly ? 'Fuel in this fill' : 'Fuel counted in this interval'}
        value={formatVolume(interval.fuelMl, units.volume)}
      />

      <Divider />

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Txt role="body" tone="mut" style={{ flexShrink: 1 }}>
          {`${formatDistanceValue(interval.distanceMetres, units.distance)} ÷ ${formatVolumeValue(interval.fuelMl, units.volume)}`}
        </Txt>
        <Txt role="rowTitle" tone="acc" numberOfLines={1}>
          {`= ${formatMileage(interval.efficiency, units.mileage)}`}
        </Txt>
      </View>
    </Card>
  );
}

function BreakdownRow({ label, note, value }: { label: string; note?: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <Txt role="body" style={{ flexShrink: 1 }}>
        {label}
        {note ? <Txt color={c.mut}>{` ${note}`}</Txt> : null}
      </Txt>
      <Txt role="rowTitleDense" numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

/**
 * The other half of the same honesty: when there is no mileage, the screen says
 * why in the rider's own numbers rather than printing a dash and moving on.
 */
export function FuelNoMileageCard({
  entry,
  units,
  style,
}: {
  entry: FuelEntry;
  units: UnitPreferences;
  style?: { marginTop?: number };
}) {
  const { c } = useTheme();

  return (
    <Card style={{ gap: 8, ...style }} testID="card-no-mileage">
      <Eyebrow>Why there’s no mileage here</Eyebrow>
      <Txt role="body" style={{ lineHeight: 20.15 }}>
        {'This was a '}
        <Txt style={{ fontFamily: fontFamily[700], color: c.ink }}>{FILL_PHRASE[entry.fillType]}</Txt>
        {entry.fillType === 'full'
          ? ' — mileage is measured between two full tanks, so it needs one before this to measure from. Its '
          : ' — the tank wasn’t full, so the distance it covers can’t be pinned down. Its '}
        {formatVolume(entry.litresMl, units.volume)}
        {' will be counted into the next interval that two full tanks close.'}
      </Txt>
    </Card>
  );
}

/** "Adjustments on this fill" — each one still its own dated record. */
export function FuelAdjustmentsCard({
  adjustments,
  units,
  style,
}: {
  adjustments: readonly FuelAdjustment[];
  units: UnitPreferences;
  style?: { marginTop?: number };
}) {
  return (
    <Card style={{ gap: 10, ...style }} testID="card-adjustments">
      <Eyebrow>Adjustments on this fill</Eyebrow>
      {adjustments.map((adjustment) => {
        const added = adjustment.millilitres > 0;
        return (
          <View
            key={adjustment.id}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt role="rowTitle">{adjustmentReasonLabel(adjustment)}</Txt>
              <Txt role="meta" tone="mut">
                {`Logged ${formatShortDate(adjustment.date)} · kept as its own record`}
              </Txt>
            </View>
            <Txt role="rowTitleDense" tone={added ? 'good' : 'warn'} numberOfLines={1}>
              {`${added ? '+' : '−'}${formatVolume(Math.abs(adjustment.millilitres), units.volume)}`}
            </Txt>
          </View>
        );
      })}
    </Card>
  );
}

/**
 * The receipt row: the board's 44×32 thumbnail on the right of a key/value row,
 * tappable to open the photo full-screen.
 */
export function FuelReceiptRow({
  uri,
  onPress,
  testID,
}: {
  uri: string | null;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View pump receipt"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt role="body" tone="mut" style={{ lineHeight: 18 }}>
        Receipt
      </Txt>
      <View
        style={{
          width: 44,
          height: 32,
          borderRadius: 7,
          backgroundColor: c.sur2,
          borderWidth: 1,
          borderColor: c.brd,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <ReceiptThumb uri={uri} />
      </View>
    </Pressable>
  );
}

function ReceiptThumb({ uri }: { uri: string | null }) {
  const { c } = useTheme();
  if (uri === null) {
    return <Icon name="document" size={15} color={c.mut} strokeWidth={1.8} opacity={0.55} />;
  }
  return <Image source={{ uri }} accessibilityIgnoresInvertColors style={{ width: '100%', height: '100%' }} />;
}

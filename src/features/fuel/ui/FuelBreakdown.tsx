import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Card, Divider, Icon, RowIcon, Txt } from '@/components';
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
 * "How 41.2 was measured" (Figma `How measured`) — the arithmetic behind the
 * figure, on the same screen as the figure: the interval drawn as a line
 * from the opening full tank to this one, the sum in an inset box, and the
 * rule in one sentence.
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
  const { c } = useTheme();
  // A partial fill before this one, or an adjustment inside the interval, means
  // the fuel that did the work is not the fuel in this fill — so say which.
  const wholeFillOnly = interval.fuelMl === entry.litresMl;

  return (
    <Card style={{ gap: 12, ...style }} testID="card-mileage-breakdown">
      <Txt role="cardTitle">{`How ${formatMileageValue(interval.efficiency, units.mileage)} was measured`}</Txt>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ gap: 2 }}>
          <Txt role="mediumStrong">{`${formatShortDate(interval.fromDate)} · Full`}</Txt>
          <Txt role="meta" tone="mut">
            {formatDistance(interval.fromOdometerMetres, units.distance)}
          </Txt>
        </View>
        <IntervalLine />
        <View style={{ gap: 2, alignItems: 'flex-end' }}>
          <Txt role="mediumStrong">{`${formatShortDate(entry.date)} · Full`}</Txt>
          <Txt role="meta" tone="mut">
            {formatDistance(entry.odometerMetres, units.distance)}
          </Txt>
        </View>
      </View>

      <View style={{ backgroundColor: c.field, borderRadius: 16, padding: 14, gap: 10 }}>
        <SumRow label="Distance since last full tank" value={formatDistance(interval.distanceMetres, units.distance)} />
        <SumRow
          label={wholeFillOnly ? 'Fuel in this fill' : 'Fuel counted in this interval'}
          value={formatVolume(interval.fuelMl, units.volume)}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: c.brd,
          }}
        >
          <Txt role="body" tone="mut" style={{ flexShrink: 1 }}>
            {`${formatDistanceValue(interval.distanceMetres, units.distance)} ÷ ${formatVolumeValue(interval.fuelMl, units.volume)}`}
          </Txt>
          <Txt style={{ fontFamily: fontFamily[700], fontSize: 15, color: c.accText }} numberOfLines={1}>
            {`= ${formatMileage(interval.efficiency, units.mileage)}`}
          </Txt>
        </View>
      </View>

      <Txt role="helper" tone="mut">
        Distance between two full tanks ÷ fuel used in between. Check it yourself — that&rsquo;s the point.
      </Txt>
    </Card>
  );
}

/** Figma `chart:interval-line`: a dot at each end joined by a hairline, the accent on the closing end. */
function IntervalLine() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, height: 20 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={20} viewBox="0 0 100 20" preserveAspectRatio="none">
        <Line x1={6} y1={10} x2={94} y2={10} stroke={c.brdStrong} strokeWidth={2} strokeDasharray="4 4" />
      </Svg>
      <Svg width="100%" height={20} style={{ position: 'absolute' }}>
        <Circle cx={6} cy={10} r={4} fill={c.sur} stroke={c.brdStrong} strokeWidth={2} />
      </Svg>
      <View style={{ position: 'absolute', right: 0, top: 0 }}>
        <Svg width={12} height={20}>
          <Circle cx={6} cy={10} r={4} fill={c.accBright} />
        </Svg>
      </View>
    </View>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Txt role="body" style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <Txt role="value" numberOfLines={1}>
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
      <Txt role="cardTitle">Why there&rsquo;s no mileage here</Txt>
      <Txt role="body" tone="mut">
        {'This was a '}
        <Txt style={{ fontFamily: fontFamily[600], color: c.ink }}>{FILL_PHRASE[entry.fillType]}</Txt>
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
    <Card style={{ gap: 4, ...style }} testID="card-adjustments">
      <Txt role="cardTitle" style={{ paddingBottom: 6 }}>
        Adjustments on this fill
      </Txt>
      {adjustments.map((adjustment, index) => {
        const added = adjustment.millilitres > 0;
        return (
          <View key={adjustment.id}>
            {index > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <RowIcon icon="droplet" tone={added ? 'good' : 'warn'} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt role="rowTitle">{adjustmentReasonLabel(adjustment)}</Txt>
                <Txt role="meta" tone="mut">
                  {`Logged ${formatShortDate(adjustment.date)} · kept as its own record`}
                </Txt>
              </View>
              <Txt role="value" tone={added ? 'good' : 'warn'} numberOfLines={1}>
                {`${added ? '+' : '−'}${formatVolume(Math.abs(adjustment.millilitres), units.volume)}`}
              </Txt>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

/**
 * The receipt row (Figma `Receipt`): a 40px neutral tile with the receipt
 * glyph — or the photo itself — "Pump receipt" over "Tap to view full size",
 * and a chevron.
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
        minHeight: Math.max(64, HIT_SIZE),
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {uri === null ? (
        <RowIcon icon="receipt" tone="neutral" />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: c.sur2 }}>
          <Image source={{ uri }} accessibilityIgnoresInvertColors style={{ width: '100%', height: '100%' }} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="rowTitle">Pump receipt</Txt>
        <Txt role="meta" tone="mut">
          Tap to view full size
        </Txt>
      </View>
      <Icon name="chevronRight" size={20} color={c.faint} />
    </Pressable>
  );
}

import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path, Polyline, Circle, Rect, Text as SvgText } from 'react-native-svg';

import { fontFamily, useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';
import { Txt } from './Text';

/**
 * Charts, drawn with the boards' own SVG geometry.
 *
 * Every one of them refuses to render on empty or degenerate data and shows the
 * "not enough data" state instead — an empty array must never reach a chart
 * (mistake 11).
 */

const GAUGE_W = 170;
const GAUGE_H = 100;
const GAUGE_R = 70;
const GAUGE_CX = 85;
const GAUGE_CY = 95;

/**
 * The Dashboard mileage gauge (board "Latest mileage"): a 170×100 box, a 180°
 * arc of radius 70 from (15,95) to (155,95) at stroke 12 with round caps, the
 * accent arc over it to the measured fraction, and the figure (`700 34px`)
 * sitting 57px down, with the `500 12px` muted caption under the box.
 */
export function Gauge({
  value,
  max,
  caption,
  label,
  formatted,
  estimated = false,
  testID,
}: {
  /** The figure printed in the middle. Null renders an em dash. */
  value: number | null;
  max: number;
  caption: string;
  /** A second muted line under the caption. */
  label?: string;
  /** Overrides the printed figure (already formatted by the screen). */
  formatted?: string;
  /** Prefixes the figure with ≈, as the estimated board draws it. */
  estimated?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();

  const fraction = value === null || max <= 0 || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(1, value / max));
  const angle = Math.PI * fraction;
  const endX = GAUGE_CX - GAUGE_R * Math.cos(angle);
  const endY = GAUGE_CY - GAUGE_R * Math.sin(angle);
  const printed = value === null || !Number.isFinite(value) ? NO_VALUE : (formatted ?? value.toFixed(1));

  return (
    <View style={{ alignItems: 'center', gap: 8 }} testID={testID} accessibilityLabel={`${printed} ${caption}`}>
      <View style={{ width: GAUGE_W, height: GAUGE_H }}>
        <Svg width={GAUGE_W} height={GAUGE_H} viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`}>
          <Path
            d={`M15 95 A ${GAUGE_R} ${GAUGE_R} 0 0 1 155 95`}
            fill="none"
            stroke={c.sur2}
            strokeWidth={12}
            strokeLinecap="round"
          />
          {fraction > 0 ? (
            <Path
              d={`M15 95 A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
              fill="none"
              stroke={c.acc}
              strokeWidth={12}
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 57, alignItems: 'center' }}>
          <Txt
            numberOfLines={1}
            style={{
              fontFamily: fontFamily[700],
              fontSize: 34,
              lineHeight: 36,
              color: printed === NO_VALUE ? c.mut : c.ink,
            }}
          >
            {estimated && printed !== NO_VALUE ? `≈ ${printed}` : printed}
          </Txt>
        </View>
      </View>
      <Txt role="meta" tone="mut" align="center">
        {caption}
      </Txt>
      {label ? (
        <Txt role="metaSmall" tone="mut" align="center">
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

export type TrendPoint = { value: number; label: string };

const AXIS_FONT = { fontSize: 10, fontWeight: '600' as const };

/**
 * The Analytics "Mileage trend", transcribed from the board's own SVG
 * (`M36 10v92M36 102h296`): a 340×120 box with a hairline y-axis at x=36 and a
 * baseline at y=102, three tick labels (max / mid / min) on the left, a dashed
 * midline at y=58, the accent line at stroke 2.5 with a 3.5px dot on the last
 * point, and three period labels at y=117.
 */
export function TrendChart({
  points,
  width = 340,
  height = 120,
  formatValue,
  xLabels,
}: {
  points: readonly TrendPoint[];
  width?: number;
  height?: number;
  formatValue?: (value: number) => string;
  /** First / middle / last period labels; defaults to the points' own labels. */
  xLabels?: readonly [string, string, string];
}) {
  const { c, text } = useTheme();

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const fmt = formatValue ?? ((v: number) => v.toFixed(1));

  const axisX = 36;
  const left = 48;
  const right = width - 10;
  const top = 10;
  const bottom = height - 18;
  const midY = (top + bottom) / 2;

  const coords = points.map((point, index) => {
    const x = left + (index * (right - left)) / (points.length - 1);
    const y = bottom - ((point.value - min) / span) * (bottom - top);
    return { x, y };
  });
  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  const middleIndex = Math.floor((points.length - 1) / 2);
  const labels = xLabels ?? [points[0]?.label ?? '', points[middleIndex]?.label ?? '', points[points.length - 1]?.label ?? ''];
  const family = text('smallStrong').fontFamily;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={`M${axisX} ${top - 2}v${bottom - top + 2}M${axisX} ${bottom}h${right - axisX}`} stroke={c.brd} strokeWidth={1} />
      <SvgText x={axisX - 6} y={top + 6} textAnchor="end" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
        {fmt(max)}
      </SvgText>
      <SvgText x={axisX - 6} y={midY + 2} textAnchor="end" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
        {fmt((max + min) / 2)}
      </SvgText>
      <SvgText x={axisX - 6} y={bottom + 2} textAnchor="end" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
        {fmt(min)}
      </SvgText>
      <Path d={`M${axisX} ${midY}h${right - axisX}`} stroke={c.brd} strokeWidth={1} strokeDasharray="3 4" />
      <Polyline
        points={line}
        fill="none"
        stroke={c.acc}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last ? <Circle cx={last.x} cy={last.y} r={3.5} fill={c.acc} /> : null}
      <SvgText x={left} y={height - 3} textAnchor="start" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
        {labels[0]}
      </SvgText>
      <SvgText x={(left + right) / 2} y={height - 3} textAnchor="middle" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
        {labels[1]}
      </SvgText>
      <SvgText x={right} y={height - 3} textAnchor="end" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
        {labels[2]}
      </SvgText>
    </Svg>
  );
}

export type BarDatum = { label: string; value: number; caption: string };

/**
 * The Analytics "Monthly spending" bars: a 340×110 box, y-axis at x=36 with
 * the top tick and "0", 30px bars (`rx:4`) on a 48px pitch — `--sur2` for
 * past months and `--acc` for the current one — and the first and last
 * month labelled underneath.
 */
export function BarChart({
  data,
  width = 340,
  height = 110,
  highlightLast = true,
  topLabel,
  style,
  maxHeight: _legacyMaxHeight,
}: {
  data: readonly BarDatum[];
  width?: number;
  height?: number;
  highlightLast?: boolean;
  /** The top tick's label, already formatted ("6k"); omitted when not given. */
  topLabel?: string;
  style?: ViewStyle;
  /** Kept for existing callers; the board fixes the chart's geometry. */
  maxHeight?: number;
}) {
  const { c, text } = useTheme();
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const axisX = 36;
  const top = 8;
  const bottom = height - 16;
  const plotLeft = axisX + 8;
  const plotRight = width - 8;
  const slot = (plotRight - plotLeft) / data.length;
  const barWidth = Math.min(30, slot * 0.625);
  const family = text('smallStrong').fontFamily;
  const first = data[0];
  const last = data[data.length - 1];

  return (
    <View style={style}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={`M${axisX} ${top}v${bottom - top}M${axisX} ${bottom}h${plotRight - axisX}`} stroke={c.brd} strokeWidth={1} />
        {topLabel ? (
          <SvgText x={axisX - 6} y={top + 6} textAnchor="end" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
            {topLabel}
          </SvgText>
        ) : null}
        <SvgText x={axisX - 6} y={bottom + 2} textAnchor="end" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
          0
        </SvgText>
        {data.map((datum, index) => {
          const barHeight = datum.value <= 0 ? 0 : Math.max(4, (datum.value / max) * (bottom - top));
          const x = plotLeft + index * slot + (slot - barWidth) / 2;
          const isCurrent = highlightLast && index === data.length - 1;
          return (
            <Rect
              key={`${datum.label}-${index}`}
              x={x.toFixed(1)}
              y={(bottom - barHeight).toFixed(1)}
              width={barWidth.toFixed(1)}
              height={barHeight.toFixed(1)}
              rx={4}
              fill={isCurrent ? c.acc : c.sur2}
            />
          );
        })}
        {first ? (
          <SvgText x={plotLeft + (slot - barWidth) / 2 + 3} y={height - 4} textAnchor="start" fill={c.mut} fontFamily={family} {...AXIS_FONT}>
            {first.label}
          </SvgText>
        ) : null}
        {last && data.length > 1 ? (
          <SvgText
            x={plotLeft + (data.length - 1) * slot + (slot - barWidth) / 2 + 5}
            y={height - 4}
            textAnchor="start"
            fill={c.mut}
            fontFamily={family}
            {...AXIS_FONT}
          >
            {last.label}
          </SvgText>
        ) : null}
      </Svg>
      <View accessible accessibilityLabel={data.map((d) => `${d.label}: ${d.caption}`).join(', ')} />
    </View>
  );
}

/** The horizontal progress bar used for allowance, part life and spend shares. */
export function ProgressBar({
  fraction,
  tone = 'accent',
  height = 8,
  style,
}: {
  /** 0–1, clamped. */
  fraction: number;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
  height?: number;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const safe = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const color = tone === 'good' ? c.good : tone === 'warn' ? c.warn : tone === 'bad' ? c.bad : c.acc;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(safe * 100), min: 0, max: 100 }}
      style={[{ height, borderRadius: height / 2, backgroundColor: c.sur2, overflow: 'hidden' }, style]}
    >
      <View style={{ width: `${safe * 100}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/** One row of the spending breakdown: category, bar, amount. */
export function SpendBar({
  category,
  amount,
  fraction,
  opacity = 1,
}: {
  category: string;
  amount: string;
  fraction: number;
  opacity?: number;
}) {
  const { c } = useTheme();
  const safe = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Txt role="smallStrong" style={{ width: 72 }} numberOfLines={1}>
        {category}
      </Txt>
      <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: c.sur2, overflow: 'hidden' }}>
        <View
          style={{
            width: `${safe * 100}%`,
            height: '100%',
            backgroundColor: c.acc,
            borderRadius: 4,
            opacity,
          }}
        />
      </View>
      <Txt role="rowTitleDense" style={{ width: 82, textAlign: 'right' }} numberOfLines={1}>
        {amount}
      </Txt>
    </View>
  );
}

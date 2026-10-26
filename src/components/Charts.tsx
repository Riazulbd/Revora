import React, { useState } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

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
    <ScaledSvg width={width} height={height}>
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
    </ScaledSvg>
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
      <ScaledSvg width={width} height={height}>
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
      </ScaledSvg>
      <View accessible accessibilityLabel={data.map((d) => `${d.label}: ${d.caption}`).join(', ')} />
    </View>
  );
}

/** The horizontal progress bar (Figma `Track`): 8px, `#F1F2F5`, a tone fill, both pills. */
export function ProgressBar({
  fraction,
  tone = 'accent',
  height = 8,
  style,
}: {
  /** 0–1, clamped. */
  fraction: number;
  tone?: 'accent' | 'good' | 'warn' | 'bad' | 'neutral';
  height?: number;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const safe = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const color = tone === 'good' ? c.good : tone === 'warn' ? c.warnIcon : tone === 'bad' ? c.badIcon : tone === 'neutral' ? c.faint : c.acc;

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

/** One row of the spending breakdown (Figma `Cat`): category, a 6px bar, amount. */
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
      <Txt role="smallStrong" style={{ width: 76 }} numberOfLines={1}>
        {category}
      </Txt>
      <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: c.div, overflow: 'hidden' }}>
        <View
          style={{
            width: `${safe * 100}%`,
            height: '100%',
            backgroundColor: c.acc,
            borderRadius: 999,
            opacity,
          }}
        />
      </View>
      <Txt role="value" style={{ width: 82, textAlign: 'right' }} numberOfLines={1}>
        {amount}
      </Txt>
    </View>
  );
}

/** Width of the box a chart is laid out in, so strokes stay crisp at any size. */
/**
 * An SVG drawn in a fixed coordinate box (`viewBox`) and scaled to whatever
 * width its container gives it. react-native-svg does not honour a
 * percentage `width` on Android, so the container is measured instead.
 */
function ScaledSvg({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const [measured, onLayout] = useWidth();
  const drawn = measured > 0 ? measured : width;
  return (
    <View style={{ alignSelf: 'stretch' }} onLayout={onLayout}>
      {measured > 0 ? (
        <Svg width={drawn} height={(drawn * height) / width} viewBox={`0 0 ${width} ${height}`}>
          {children}
        </Svg>
      ) : null}
    </View>
  );
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

/**
 * The bento's mileage sparkline (Figma `chart:line`, 140×44): a 2px
 * `#F4511E` line over a fill fading from 22% to nothing, inset 4px each side,
 * the last point a white dot ringed in the accent. Needs two points.
 */
export function Sparkline({
  values,
  height = 44,
  color,
  dotFill,
  testID,
}: {
  values: readonly number[];
  height?: number;
  /** The line; defaults to the bright accent. */
  color?: string;
  /** The last point's fill; defaults to the card colour. */
  dotFill?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const stroke = color ?? c.accBright;
  const [width, onLayout] = useWidth();
  const points = values.filter(Number.isFinite);
  const drawable = points.length >= 2 && width > 0;

  let line = '';
  let area = '';
  let last = { x: 0, y: 0 };
  if (drawable) {
    const inset = 4;
    const top = 10;
    const bottom = height - 8;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const step = (width - inset * 2) / (points.length - 1);
    const xy = points.map((v, i) => ({ x: inset + i * step, y: bottom - ((v - min) / span) * (bottom - top) }));
    line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    area = `${line} L${(xy[xy.length - 1]?.x ?? 0).toFixed(1)} ${height} L${inset} ${height} Z`;
    last = xy[xy.length - 1] ?? last;
  }

  return (
    <View style={{ height, alignSelf: 'stretch' }} onLayout={onLayout} testID={testID}>
      {drawable ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#spark)" />
          <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={last.x} cy={last.y} r={3.5} fill={dotFill ?? c.sur} stroke={stroke} strokeWidth={2} />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Small columns on a shared baseline (Figma `chart:bars`, 140×44): seven bars
 * a tenth of the width each, `#E9EBEF`, the last one — the current period — in
 * ink. `highlight` picks a different one; `rounded` caps them.
 */
export function MiniBars({
  values,
  height = 44,
  highlight,
  color,
  highlightColor,
  reference,
  referenceColor,
  rounded = true,
  gapRatio = 0.5,
  baseline = 'zero',
  testID,
}: {
  values: readonly number[];
  height?: number;
  /** Index of the emphasised bar; defaults to the last. */
  highlight?: number;
  color?: string;
  highlightColor?: string;
  /** A dashed rule at this value (the Fuel hero's average). */
  reference?: number;
  referenceColor?: string;
  rounded?: boolean;
  /** Gap between bars as a share of a bar's width. */
  gapRatio?: number;
  /**
   * `zero` — bars rise from nothing (amounts). `spread` — bars rise from a
   * floor below the lowest value, so figures that sit close together (37–42
   * km/L) still read as different heights.
   */
  baseline?: 'zero' | 'spread';
  testID?: string;
}) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  const n = values.length;
  const finite = values.filter(Number.isFinite);
  const max = Math.max(...finite, reference ?? 0, 0);
  const lowest = Math.min(...finite, reference ?? Infinity);
  const floor = baseline === 'spread' && finite.length > 0 ? Math.max(0, lowest - Math.max(max - lowest, max * 0.05) * 1.2) : 0;
  const lit = highlight ?? n - 1;

  const barW = n > 0 ? width / (n + (n - 1) * gapRatio) : 0;
  const pitch = barW * (1 + gapRatio);
  const minBar = Math.min(6, height);
  const scale = (v: number) =>
    max > floor && Number.isFinite(v) && v > 0 ? Math.max(minBar, ((v - floor) / (max - floor)) * height) : minBar;

  return (
    <View style={{ height, alignSelf: 'stretch' }} onLayout={onLayout} testID={testID}>
      {width > 0 && n > 0 ? (
        <Svg width={width} height={height}>
          {values.map((v, i) => {
            const h = scale(v);
            return (
              <Rect
                key={i}
                x={i * pitch}
                y={height - h}
                width={barW}
                height={h}
                rx={rounded ? Math.min(barW / 2, 8) : 2}
                fill={i === lit ? (highlightColor ?? c.ink) : (color ?? c.brd)}
              />
            );
          })}
          {reference !== undefined && max > 0 ? (
            <Line
              x1={0}
              x2={width}
              y1={height - scale(reference)}
              y2={height - scale(reference)}
              stroke={referenceColor ?? c.accBright}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * The category donut (Figma `chart:cat-donut`, 112px): a ring of slices in
 * the chart ramp over a track, drawn with dashed strokes so there is no path
 * arithmetic to get wrong. An empty total draws the track alone.
 */
export function Donut({
  slices,
  size = 112,
  thickness = 16,
  track,
  accessibilityLabel,
  testID,
}: {
  slices: readonly { value: number; color: string }[];
  size?: number;
  thickness?: number;
  /** The ring behind the slices; defaults to the inset surface. */
  track?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((sum, s) => sum + (Number.isFinite(s.value) && s.value > 0 ? s.value : 0), 0);
  const gap = slices.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      testID={testID}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.sur2} strokeWidth={thickness} fill="none" />
        {total > 0
          ? slices.map((slice, index) => {
              if (!(slice.value > 0)) return null;
              const span = (slice.value / total) * circumference;
              const dash = Math.max(0, span - gap);
              const start = offset;
              offset += span;
              return (
                <Circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={slice.color}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-start}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
            })
          : null}
      </Svg>
    </View>
  );
}

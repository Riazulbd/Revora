import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path, Polygon, Polyline, Circle, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme';
import { Txt } from './Text';

/**
 * Charts, drawn with the design's own SVG geometry.
 *
 * Every one of them refuses to render on empty or degenerate data and shows the
 * "not enough data" state instead — an empty array must never reach a chart
 * (mistake 11).
 */

/**
 * The dashboard mileage gauge: a 180° arc from (25,118) to (205,118) with a
 * 90px radius and a 15px round cap, exactly as the design draws it.
 */
export function Gauge({
  value,
  max,
  caption,
  label,
}: {
  /** The figure printed in the middle. Null renders an em dash. */
  value: number | null;
  max: number;
  caption: string;
  label?: string;
}) {
  const { c, text } = useTheme();

  const fraction = value === null || max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  // The arc is a half-circle of radius 90, so its length is exactly pi x 90.
  const ARC_LENGTH = Math.PI * 90;
  const dash = `${(fraction * ARC_LENGTH).toFixed(2)} ${ARC_LENGTH.toFixed(2)}`;
  const printed = value === null ? '—' : value.toFixed(1);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={230} height={132} viewBox="0 0 230 132">
        <Path
          d="M25 118 A 90 90 0 0 1 205 118"
          fill="none"
          stroke={c.sur2}
          strokeWidth={15}
          strokeLinecap="round"
        />
        {fraction > 0 ? (
          <Path
            d="M25 118 A 90 90 0 0 1 205 118"
            fill="none"
            stroke={c.acc}
            strokeWidth={15}
            strokeLinecap="round"
            strokeDasharray={dash}
          />
        ) : null}
        <SvgText
          x={115}
          y={98}
          textAnchor="middle"
          fill={c.ink}
          fontSize={38}
          fontFamily={text('hero').fontFamily}
        >
          {printed}
        </SvgText>
        <SvgText
          x={115}
          y={120}
          textAnchor="middle"
          fill={c.mut}
          fontSize={12}
          fontFamily={text('smallStrong').fontFamily}
        >
          {caption}
        </SvgText>
        <SvgText x={24} y={131} textAnchor="middle" fill={c.mut} fontSize={9} fontFamily={text('smallStrong').fontFamily}>
          0
        </SvgText>
        <SvgText x={206} y={131} textAnchor="middle" fill={c.mut} fontSize={9} fontFamily={text('smallStrong').fontFamily}>
          {String(max)}
        </SvgText>
      </Svg>
      {label ? (
        <Txt role="metaSmall" tone="mut">
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

export type TrendPoint = { value: number; label: string };

/**
 * The mileage trend line. The design plots five points across a 320×110 box with
 * a soft fill beneath the line and the value printed above each dot.
 */
export function TrendChart({
  points,
  width = 320,
  height = 110,
  formatValue,
}: {
  points: readonly TrendPoint[];
  width?: number;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const { c, text } = useTheme();

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const left = 24;
  const right = width - 24;
  const top = 16;
  const bottom = height - 18;

  const coords = points.map((point, index) => {
    const x = points.length === 1 ? (left + right) / 2 : left + (index * (right - left)) / (points.length - 1);
    const y = bottom - ((point.value - min) / span) * (bottom - top);
    return { x, y, point };
  });

  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} ${right},${bottom + 6} ${left},${bottom + 6}`;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polygon points={area} fill={c.accS} />
      <Polyline
        points={line}
        fill="none"
        stroke={c.acc}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((p, index) => (
        <React.Fragment key={index}>
          <Circle cx={p.x} cy={p.y} r={3.5} fill={c.acc} />
          <SvgText
            x={p.x}
            y={p.y - 9}
            textAnchor="middle"
            fill={c.ink}
            fontSize={10}
            fontFamily={text('smallStrong').fontFamily}
          >
            {formatValue ? formatValue(p.point.value) : p.point.value.toFixed(1)}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

export type BarDatum = { label: string; value: number; caption: string };

/** The monthly spending bars from the Analytics screen. */
export function BarChart({
  data,
  maxHeight = 100,
  style,
}: {
  data: readonly BarDatum[];
  maxHeight?: number;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, style]}>
      {data.map((datum) => {
        const height = datum.value <= 0 ? 4 : Math.max(6, (datum.value / max) * maxHeight);
        return (
          <View key={datum.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Txt role="micro" tone="mut" numberOfLines={1}>
              {datum.caption}
            </Txt>
            <View
              accessibilityLabel={`${datum.label}: ${datum.caption}`}
              style={{
                width: '100%',
                height,
                borderRadius: 8,
                backgroundColor: datum.value <= 0 ? c.sur2 : c.acc,
                opacity: datum.value <= 0 ? 1 : 0.9,
              }}
            />
            <Txt role="micro" tone="mut">
              {datum.label}
            </Txt>
          </View>
        );
      })}
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
      <Txt role="smallStrong" style={{ width: 64 }} numberOfLines={1}>
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
      <Txt role="smallStrong" style={{ width: 78, textAlign: 'right' }} numberOfLines={1}>
        {amount}
      </Txt>
    </View>
  );
}

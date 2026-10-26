import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Icon, Txt } from '@/components';
import { fontFamily, useTheme } from '@/theme';

/**
 * The two charts the Analytics board draws that no shared chart matches:
 * the mileage trend with its dashed average and ringed best point, and the
 * monthly spending columns with every month labelled. Both are transcribed
 * from the frame's own SVGs (`chart:mileage-line` 326×120, `chart:spend-bars`
 * 326×110) and draw nothing until they have been given a width.
 */

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

/**
 * Figma `chart:mileage-line`: the accent line over a fading fill, a dashed
 * grey average, the best point ringed in green, the latest point a filled
 * accent dot, and the first point an open ring.
 */
export function MileageTrendChart({
  values,
  average,
  bestIndex,
  height = 120,
  testID,
}: {
  /** Oldest first, in the rider's unit. */
  values: readonly number[];
  average: number | null;
  /** Which point to ring in green; null for none. */
  bestIndex: number | null;
  height?: number;
  testID?: string;
}) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  const points = values.filter(Number.isFinite);
  const drawable = points.length >= 2 && width > 0;

  const inset = 6;
  const top = 12;
  const bottom = height - 12;
  const all = average === null ? points : [...points, average];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const y = (v: number) => bottom - ((v - min) / span) * (bottom - top);
  const step = points.length > 1 ? (width - inset * 2) / (points.length - 1) : 0;
  const xy = points.map((v, i) => ({ x: inset + i * step, y: y(v) }));
  const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = xy.length > 0 ? `${line} L${(xy[xy.length - 1]?.x ?? 0).toFixed(1)} ${bottom} L${inset} ${bottom} Z` : '';
  const first = xy[0];
  const last = xy[xy.length - 1];
  const best = bestIndex === null ? undefined : xy[bestIndex];

  return (
    <View style={{ height, alignSelf: 'stretch' }} onLayout={onLayout} testID={testID}>
      {drawable ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.accBright} stopOpacity={0.18} />
              <Stop offset="1" stopColor={c.accBright} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#trendFill)" />
          {average === null ? null : (
            <Path d={`M${inset} ${y(average).toFixed(1)}H${width - inset}`} stroke={c.faint} strokeWidth={1.5} strokeDasharray="4 4" />
          )}
          <Path d={line} stroke={c.accBright} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {xy.map((p, i) =>
            i === 0 || i === xy.length - 1 || i === bestIndex ? null : (
              <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={c.accBright} />
            ),
          )}
          {first ? <Circle cx={first.x} cy={first.y} r={4} fill={c.sur} stroke={c.accBright} strokeWidth={2} /> : null}
          {best ? <Circle cx={best.x} cy={best.y} r={4.5} fill={c.sur} stroke={c.good} strokeWidth={2} /> : null}
          {last ? <Circle cx={last.x} cy={last.y} r={4.5} fill={c.accBright} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Figma `chart:spend-bars`: one column per month, `--sur2` for the past and
 * the accent for the current month, with a `rx:8` cap; the labels under them
 * are the caller's, so the current month can be set bold.
 */
export function SpendColumns({
  values,
  height = 110,
  testID,
}: {
  values: readonly number[];
  height?: number;
  testID?: string;
}) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  const n = values.length;
  const max = Math.max(...values, 1);
  const slot = n > 0 ? width / n : 0;
  const barW = Math.min(36, slot * 0.58);

  return (
    <View style={{ height, alignSelf: 'stretch' }} onLayout={onLayout} testID={testID}>
      {width > 0 && n > 0 ? (
        <Svg width={width} height={height}>
          {values.map((v, i) => {
            const h = v <= 0 ? 4 : Math.max(4, (v / max) * height);
            return (
              <Rect
                key={i}
                x={i * slot + (slot - barW) / 2}
                y={height - h}
                width={barW}
                height={h}
                rx={8}
                fill={i === n - 1 ? c.accBright : c.sur2}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/** Figma `PRO chip` on the Analytics top bar: `#FF6B3D`, the sparkles and `700 12px` tracked PRO. */
export function ProChip({ testID }: { testID?: string }) {
  const { c } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 10,
        paddingRight: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: c.heroAcc,
      }}
    >
      <Icon name="sparkles" size={14} color="#14171B" />
      <Txt style={{ fontFamily: fontFamily[700], fontSize: 12, lineHeight: 15, letterSpacing: 0.72, color: '#14171B' }}>PRO</Txt>
    </View>
  );
}

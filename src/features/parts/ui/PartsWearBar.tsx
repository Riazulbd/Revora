import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { Txt } from '@/components';
import { useTheme } from '@/theme';

/**
 * Figma `chart:wear` (326×40) on the part detail: a 6px track, the used share
 * filled in the health colour with a ringed marker at its end, and `Fitted
 * 26,700 km` / `Expected end 35,400 km` in `400 12px` muted under the ends.
 */
export function PartsWearBar({
  fraction,
  tone,
  startLabel,
  endLabel,
  testID,
}: {
  /** 0–1, clamped. */
  fraction: number;
  tone: 'good' | 'warn' | 'bad';
  startLabel: string;
  endLabel: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const safe = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const color = tone === 'good' ? c.good : tone === 'warn' ? c.warnIcon : c.badIcon;
  const r = 6;
  const trackW = Math.max(0, width - r * 2);
  const end = r + trackW * safe;

  return (
    <View style={{ gap: 6 }} onLayout={onLayout} testID={testID}>
      <View style={{ height: r * 2 + 2 }} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(safe * 100), min: 0, max: 100 }}>
        {width > 0 ? (
          <Svg width={width} height={r * 2 + 2}>
            <Rect x={r} y={r - 2} width={trackW} height={6} rx={3} fill={c.sur2} />
            <Rect x={r} y={r - 2} width={Math.max(0, end - r)} height={6} rx={3} fill={color} />
            <Circle cx={end} cy={r + 1} r={r - 1} fill={c.sur} stroke={color} strokeWidth={2} />
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Txt role="meta" tone="mut" numberOfLines={1} style={{ flexShrink: 1 }}>
          {startLabel}
        </Txt>
        <Txt role="meta" tone="mut" numberOfLines={1} align="right" style={{ flexShrink: 1 }}>
          {endLabel}
        </Txt>
      </View>
    </View>
  );
}

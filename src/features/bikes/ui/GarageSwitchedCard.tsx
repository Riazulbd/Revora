import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fontFamily, useTheme } from '@/theme';
import { Txt } from '@/components';

/**
 * "Now showing Gixxer everywhere — Dashboard, Fuel, Costs."
 *
 * The board draws this as a solid slab pinned over the garage rather than as
 * the app's usual toast pill, and the wording is the reason: a bike switch is
 * not a save confirmation, it is a statement about the rest of the app, and it
 * names the screens that just changed underneath the rider.
 *
 * The board only draws it in light, where the slab is `--ink`. In dark `--ink`
 * is near-white, so the slab takes `--sur2` and the label `--ink`, the same
 * inversion the solid Fast Capture tile uses.
 */
export function GarageSwitchedCard({ nickname, testID }: { nickname: string; testID?: string }) {
  const { c, dark, radius } = useTheme();
  const surface = dark ? c.sur2 : c.ink;
  const label = dark ? c.ink : '#FFFFFF';

  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`Now showing ${nickname} everywhere — Dashboard, Fuel, Costs.`}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: radius.pill,
        backgroundColor: surface,
        paddingVertical: 13,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      }}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <Circle cx={12} cy={12} r={10} fill={c.good} />
        <Path
          d="m7.5 12.5 3 3 6-6.5"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Txt color={label} numberOfLines={3} style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 18.2, flex: 1 }}>
        Now showing <Txt color={label} style={{ fontFamily: fontFamily[700], fontSize: 13 }}>{nickname}</Txt> everywhere — Dashboard, Fuel, Costs.
      </Txt>
    </View>
  );
}

import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';
import { Txt } from './Text';

const MARK_DARK = require('../../assets/splash-icon.png');
const MARK_LIGHT = require('../../assets/splash-icon-light.png');

/**
 * The in-app loading screen.
 *
 * Android 12+ shows only the launcher icon on a flat colour for the *system*
 * splash and that cannot be changed; this is what the app draws immediately
 * afterwards, while auth and the garage resolve.
 *
 * Composed rather than composited: nothing is a fixed-size bitmap, so it holds
 * from 16:9 to 21:9 and at any density. The road is drawn — a photograph would
 * cost a megabyte of decode on a screen that lives under a second.
 */

/** Centre-line dashes, spaced on a power curve so they read as receding. */
const DASHES: readonly (readonly [number, number, number])[] = [
  [2.2, 1.38, 0.8], [7.1, 1.8, 1.01], [14.2, 2.39, 1.32], [23.2, 3.13, 1.7],
  [33.8, 4.02, 2.17], [46.2, 5.05, 2.7], [60, 6.2, 3.3],
];

export function Splash() {
  const { c, dark } = useTheme();
  const { height } = useWindowDimensions();
  // useState, not useRef: the lint rule rightly forbids reading a ref during
  // render, and the interpolation below is read while rendering.
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1500,
        easing: Easing.bezier(0.65, 0, 0.35, 1),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  const barWidth = 132;
  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth * 0.46, barWidth * 1.04],
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.46, opacity: dark ? 0.9 : 0.75 }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.acc} stopOpacity={0.18} />
              <Stop offset="0.5" stopColor={c.acc} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="14" fill="url(#horizon)" />
          <Path d="M50 0 L115 60 L-15 60 Z" fill={c.sur} />
          {DASHES.map(([y, h, w]) => (
            <Rect
              key={y}
              x={50 - w / 2}
              y={y}
              width={w}
              height={h}
              rx={Math.min(w / 2, 0.9)}
              fill={dark ? c.brd : c.sur}
              opacity={0.3 + 0.55 * (y / 60)}
            />
          ))}
        </Svg>
      </View>

      <Image
        source={dark ? MARK_DARK : MARK_LIGHT}
        style={{ width: 120, height: 120 }}
        resizeMode="contain"
        accessibilityLabel="Revora"
      />
      <Txt role="screenTitle" style={{ fontSize: 34, fontWeight: '800', letterSpacing: 4.8 }}>
        REVORA
      </Txt>
      <Txt role="helper" tone="mut" style={{ marginTop: -8 }}>
        Track Today. Ride Further.
      </Txt>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center', gap: 16 }}>
        <View style={{ width: barWidth, height: 3, borderRadius: 999, backgroundColor: c.sur2, overflow: 'hidden' }}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: barWidth * 0.42,
              borderRadius: 999,
              backgroundColor: c.acc,
              transform: [{ translateX }],
            }}
          />
        </View>
        <Txt role="micro" tone="mut" style={{ fontSize: 9, letterSpacing: 3.1 }}>
          TRACK · MAINTAIN · RIDE · REPEAT
        </Txt>
      </View>
    </View>
  );
}

import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';

import { fontFamily, useTheme } from '@/theme';
import { Txt } from './Text';

const MARK_ON_DARK = require('../../assets/splash-icon.png');
const MARK_ON_LIGHT = require('../../assets/splash-icon-light.png');

/**
 * The cold-start frame.
 *
 * Android 12+ shows only the launcher icon on a flat colour for the *system*
 * splash and that cannot be changed; this is what the app draws immediately
 * afterwards, while the fonts, the session and the garage resolve.
 *
 * The board is deliberately spare — the mark, the wordmark, the tracked line,
 * a 160px bar and "Loading your garage…" — because it is on screen for well
 * under a second and anything heavier (a photograph, a drawn road) costs decode
 * time on the one frame that must appear instantly. It is drawn on `--sur`,
 * which is the board's white in light and the card ground in dark, so the seam
 * between the system splash and this one does not flash.
 */
export function Splash() {
  const { c, dark } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // The board's own load bar: 12% at once, 74% by the time most cold starts
    // are done, easing towards 92% rather than completing — it never claims to
    // have finished something that is still running.
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: 2400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [progress]);

  const width = progress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: ['12%', '74%', '92%'],
  });

  return (
    <View
      testID="screen-splash"
      style={{
        flex: 1,
        backgroundColor: c.sur,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        paddingHorizontal: 24,
      }}
    >
      <Image
        source={dark ? MARK_ON_DARK : MARK_ON_LIGHT}
        style={{ width: 96, height: 96 }}
        resizeMode="contain"
        accessibilityLabel="Revora"
      />

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Txt
          style={{
            fontFamily: fontFamily[700],
            fontSize: 28,
            letterSpacing: 6,
            color: c.ink,
            marginRight: -6,
          }}
        >
          REVORA
        </Txt>
        <Txt
          style={{
            fontFamily: fontFamily[700],
            fontSize: 10.5,
            letterSpacing: 0.95,
            color: c.mut,
            textTransform: 'uppercase',
          }}
        >
          Track · Maintain · Ride better
        </Txt>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Loading your garage"
        style={{
          width: 160,
          height: 5,
          borderRadius: 3,
          backgroundColor: c.sur2,
          overflow: 'hidden',
          marginTop: 8,
        }}
      >
        <Animated.View style={{ height: '100%', borderRadius: 3, backgroundColor: c.acc, width }} />
      </View>

      <Txt style={{ fontFamily: fontFamily[500], fontSize: 12, color: c.mut }}>Loading your garage…</Txt>
    </View>
  );
}

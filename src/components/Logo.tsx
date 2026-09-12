import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Text';

const MARK_DARK = require('../../assets/splash-icon.png');
const MARK_LIGHT = require('../../assets/splash-icon-light.png');

/**
 * The Revora lockup: the mark above the wordmark.
 *
 * Composed rather than shipped as one flattened image. The old lockup was a
 * single PNG drawn on a black field with a near-black wordmark, which is why it
 * could only ever appear on a dark ground and why a knocked-out "dark variant"
 * destroyed it. Built this way the wordmark is real text that takes the theme's
 * ink, so it reads on either background.
 */
export function Logo({ width = 230, style }: { width?: number; style?: ViewStyle }) {
  const { c, dark } = useTheme();
  const mark = Math.round(width * 0.42);

  return (
    <View style={[{ alignItems: 'center', gap: Math.round(width * 0.045) }, style]}>
      <Image
        source={dark ? MARK_DARK : MARK_LIGHT}
        style={{ width: mark, height: mark }}
        resizeMode="contain"
        accessibilityLabel="Revora"
      />
      <Txt
        role="screenTitle"
        style={{
          fontSize: Math.round(width * 0.155),
          fontWeight: '800',
          letterSpacing: width * 0.021,
          color: c.ink,
          // The tracking is applied to the right of every glyph, including the
          // last, so the word sits left of centre without this.
          marginLeft: width * 0.021,
        }}
      >
        REVORA
      </Txt>
    </View>
  );
}

import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';

import { fontFamily } from '@/theme';
import { Txt } from '@/components';
import { useAuthTheme } from './AuthTheme';

const MARK_ON_LIGHT = require('../../../../assets/splash-icon-light.png');

/**
 * The Revora lockup as the Welcome screen draws it (Figma `Brand`): a 48px
 * rounded tile with the mark, then "Revora" in `700 20px` over the caption in
 * `400 13px` muted, side by side.
 *
 * The mark is a road-"R" with an orange panel, drawn for a light ground; the
 * tile is white (the design's accent tile would swallow the panel) with a
 * hairline, which reads the same way in both palettes.
 *
 * `variant="stacked"` is the splash's centred form: the mark above the word.
 */
export function AuthLockup({
  caption,
  variant = 'row',
  markSize = 48,
  style,
}: {
  caption: string;
  variant?: 'row' | 'stacked';
  markSize?: number;
  style?: ViewStyle;
}) {
  const { c } = useAuthTheme();

  const tile = (
    <View
      style={{
        width: markSize,
        height: markSize,
        borderRadius: markSize / 3,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Image
        source={MARK_ON_LIGHT}
        style={{ width: markSize * 1.1, height: markSize * 1.1 }}
        resizeMode="contain"
        accessibilityLabel="Revora"
      />
    </View>
  );

  if (variant === 'stacked') {
    return (
      <View style={[{ alignItems: 'center', gap: 16 }, style]}>
        {tile}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt accessibilityLabel="Revora" style={{ fontFamily: fontFamily[700], fontSize: 28, lineHeight: 35, color: c.ink }}>
            Revora
          </Txt>
          <Txt style={{ fontFamily: fontFamily[400], fontSize: 13, lineHeight: 16, color: c.mut }}>{caption}</Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
      {tile}
      <View style={{ flex: 1 }}>
        <Txt accessibilityLabel="Revora" style={{ fontFamily: fontFamily[700], fontSize: 20, lineHeight: 25, color: c.ink }}>
          Revora
        </Txt>
        <Txt style={{ fontFamily: fontFamily[400], fontSize: 13, lineHeight: 16, color: c.mut }}>{caption}</Txt>
      </View>
    </View>
  );
}

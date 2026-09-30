import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';

import { fontFamily } from '@/theme';
import { Txt } from '@/components';
import { useAuthTheme } from './AuthTheme';

const MARK_ON_LIGHT = require('../../../../assets/splash-icon-light.png');

/**
 * The Revora lockup as the Welcome and Splash boards draw it: the mark, then
 * `REVORA` at `700 28px` on 6px of tracking, then the line under it.
 *
 * In dark the boards do not knock the mark out — they seat it on an 88px
 * `--ink` plate at `border-radius:22px`, which is why the light mark is the one
 * used there. The tracking is applied to the right of every glyph including the
 * last, so the word needs pulling back by the same 6px to sit centred.
 */
export function AuthLockup({
  caption,
  markSize = 88,
  wordSize = 28,
  captionRole = 'muted',
  style,
}: {
  caption: string;
  markSize?: number;
  wordSize?: number;
  /** `muted` is Welcome's "The motorcycle logbook."; `eyebrow` is Splash's tracked line. */
  captionRole?: 'muted' | 'eyebrow';
  style?: ViewStyle;
}) {
  const { c, dark } = useAuthTheme();
  const tracking = wordSize * 0.214;

  return (
    <View style={[{ alignItems: 'center', gap: 20 }, style]}>
      {dark ? (
        <View
          style={{
            width: markSize,
            height: markSize,
            borderRadius: markSize / 4,
            backgroundColor: c.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={MARK_ON_LIGHT}
            style={{ width: markSize * 0.82, height: markSize * 0.82 }}
            resizeMode="contain"
            accessibilityLabel="Revora"
          />
        </View>
      ) : (
        <Image
          source={MARK_ON_LIGHT}
          style={{ width: markSize, height: markSize }}
          resizeMode="contain"
          accessibilityLabel="Revora"
        />
      )}

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Txt
          accessibilityLabel="Revora"
          style={{
            fontFamily: fontFamily[700],
            fontSize: wordSize,
            letterSpacing: tracking,
            color: c.ink,
            marginRight: -tracking,
          }}
        >
          REVORA
        </Txt>
        {captionRole === 'eyebrow' ? (
          <Txt
            style={{
              fontFamily: fontFamily[700],
              fontSize: 10.5,
              letterSpacing: 0.95,
              color: c.mut,
              textTransform: 'uppercase',
            }}
          >
            {caption}
          </Txt>
        ) : (
          <Txt style={{ fontFamily: fontFamily[500], fontSize: 13, color: c.mut }}>{caption}</Txt>
        )}
      </View>
    </View>
  );
}

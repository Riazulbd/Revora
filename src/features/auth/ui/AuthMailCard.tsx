import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { fontFamily } from '@/theme';
import { Txt } from '@/components';
import { useAuthTheme } from './AuthTheme';

/**
 * The Reset password screen's "Check your email" panel: a white 24px-radius
 * card, `padding:24px 16px; gap:12px`, centred, opening on a 64px soft-accent
 * disc with the accent envelope.
 *
 * The sentence is deliberately conditional — "**If** that address has a Revora
 * account" — because confirming which addresses are registered would hand an
 * attacker a list of riders.
 */
export function AuthMailCard({ email, style, testID }: { email: string; style?: ViewStyle; testID?: string }) {
  const { c, radius } = useAuthTheme();

  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: c.sur,
          borderRadius: radius.card,
          paddingVertical: 24,
          paddingHorizontal: 16,
          alignItems: 'center',
          gap: 12,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.accS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Rect x={2} y={4} width={20} height={16} rx={2} stroke={c.accBright} strokeWidth={2} fill="none" />
          <Path
            d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
            stroke={c.accBright}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>

      <Txt style={{ fontFamily: fontFamily[600], fontSize: 18, lineHeight: 23, color: c.ink }}>Check your email</Txt>

      <Txt
        style={{
          fontFamily: fontFamily[400],
          fontSize: 14,
          lineHeight: 21,
          color: c.mut,
          textAlign: 'center',
          maxWidth: 290,
        }}
      >
        If{' '}
        <Txt style={{ fontFamily: fontFamily[600], fontSize: 14, lineHeight: 21, color: c.ink }}>{email}</Txt>
        {' has a Revora account, a reset link is on its way. It can take a minute or two.'}
      </Txt>

      <Txt style={{ fontFamily: fontFamily[400], fontSize: 12, color: c.mut }}>Not seeing it? Check spam.</Txt>
    </View>
  );
}

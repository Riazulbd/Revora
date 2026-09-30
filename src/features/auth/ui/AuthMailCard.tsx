import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { fontFamily } from '@/theme';
import { Txt } from '@/components';
import { useAuthTheme } from './AuthTheme';

/**
 * The Reset password board's "Check your email" panel:
 * `border-radius:18px; background:var(--sur); border:1px solid var(--brd);
 * padding:24px 20px; gap:12px`, centred, opening on a 52px `--accS` disc with
 * the accent envelope.
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
          borderWidth: 1,
          borderColor: c.brd,
          borderRadius: radius.card,
          paddingVertical: 24,
          paddingHorizontal: 20,
          alignItems: 'center',
          gap: 12,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: c.accS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Rect x={2} y={4} width={20} height={16} rx={2} stroke={c.acc} strokeWidth={2} fill="none" />
          <Path
            d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
            stroke={c.acc}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>

      <Txt style={{ fontFamily: fontFamily[700], fontSize: 17, color: c.ink }}>Check your email</Txt>

      <Txt
        style={{
          fontFamily: fontFamily[500],
          fontSize: 13,
          lineHeight: 20.15,
          color: c.ink,
          textAlign: 'center',
          maxWidth: 290,
        }}
      >
        If{' '}
        <Txt style={{ fontFamily: fontFamily[700], fontSize: 13, lineHeight: 20.15, color: c.ink }}>{email}</Txt>
        {' has a Revora account, a reset link is on its way. It can take a minute or two.'}
      </Txt>

      <Txt style={{ fontFamily: fontFamily[500], fontSize: 11.5, color: c.mut }}>
        Not seeing it? Check spam.
      </Txt>
    </View>
  );
}

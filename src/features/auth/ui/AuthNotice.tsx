import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fontFamily } from '@/theme';
import { Txt } from '@/components';
import { useAuthTheme } from './AuthTheme';

export type AuthNoticeTone = 'warn' | 'bad' | 'good';

/**
 * The inline notice every auth board draws — "You're offline.", "That email and
 * password don't match.", "Motorcycle saved on this phone.":
 * `border-radius:11px; background:var(--sur); border:1px solid var(--brd);
 * padding:12px 14px; gap:10px`, an 18px tone glyph top-aligned, then a
 * `500 13px/1.5` sentence whose opening clause is bold in the tone.
 *
 * It is `Banner`'s shape, drawn here because the entry screens have to render
 * outside the design system too — see `useAuthTheme`.
 */
export function AuthNotice({
  tone,
  lead,
  message,
  link,
  tail,
  style,
  testID,
}: {
  tone: AuthNoticeTone;
  /** The bold, tone-coloured opening sentence. */
  lead: string;
  message: string;
  /** The accent link the boards end two of these with — "reset your password". */
  link?: { label: string; onPress: () => void; testID?: string };
  /** What follows the link, usually the full stop. */
  tail?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useAuthTheme();
  const toneColor = tone === 'bad' ? c.bad : tone === 'good' ? c.good : c.warn;

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[
        {
          backgroundColor: c.sur,
          borderWidth: 1,
          borderColor: c.brd,
          borderRadius: 11,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
        },
        style,
      ]}
    >
      <View style={{ marginTop: 1, flexShrink: 0 }}>
        <AuthNoticeGlyph tone={tone} color={toneColor} />
      </View>
      <Txt style={{ flex: 1, fontFamily: fontFamily[500], fontSize: 13, lineHeight: 19.5, color: c.ink }}>
        <Txt style={{ fontFamily: fontFamily[700], fontSize: 13, lineHeight: 19.5, color: toneColor }}>
          {lead}{' '}
        </Txt>
        {message}
        {link ? (
          <Txt
            accessibilityRole="link"
            onPress={link.onPress}
            testID={link.testID}
            style={{ fontFamily: fontFamily[700], fontSize: 13, lineHeight: 19.5, color: c.acc }}
          >
            {link.label}
          </Txt>
        ) : null}
        {tail ?? ''}
      </Txt>
    </View>
  );
}

/** The boards' own glyphs: a wifi-off stroke, an alert circle, a filled tick. */
function AuthNoticeGlyph({ tone, color }: { tone: AuthNoticeTone; color: string }) {
  if (tone === 'good') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} fill={color} />
        <Path
          d="m7.5 12.5 3 3 6-6.5"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (tone === 'bad') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
        <Path d="M12 7.5v5.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={12} cy={16.4} r={1.2} fill={color} />
      </Svg>
    );
  }

  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.24-2.76M19 12.9a10 10 0 0 0-2.8-1.9M2 8.8a15 15 0 0 1 6.4-3.2M22 8.8a15 15 0 0 0-11.3-3M4 3l17 17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

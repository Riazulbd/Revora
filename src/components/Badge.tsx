import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Text';

export type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral' | 'accent';

const TONE_ROLES: Record<BadgeTone, { fg: 'good' | 'warn' | 'bad' | 'mut' | 'acc'; bg: 'goodS' | 'warnS' | 'badS' | 'sur2' | 'accS' }> = {
  good: { fg: 'good', bg: 'goodS' },
  warn: { fg: 'warn', bg: 'warnS' },
  bad: { fg: 'bad', bg: 'badS' },
  neutral: { fg: 'mut', bg: 'sur2' },
  accent: { fg: 'acc', bg: 'accS' },
};

/**
 * The status pill: `font:700 10.5px; border-radius:7px; padding:4px 8px`,
 * coloured from the tone's paired foreground/soft-background tokens.
 */
export function Badge({
  label,
  tone = 'neutral',
  size = 'default',
  style,
}: {
  label: string;
  tone?: BadgeTone;
  size?: 'default' | 'chip';
  style?: ViewStyle;
}) {
  const { c, radius } = useTheme();
  const { fg, bg } = TONE_ROLES[tone];

  return (
    <View
      style={[
        {
          backgroundColor: c[bg],
          borderRadius: size === 'chip' ? radius.badge : radius.chip,
          paddingHorizontal: size === 'chip' ? 9 : 8,
          paddingVertical: size === 'chip' ? 5 : 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Txt role={size === 'chip' ? 'chip' : 'badge'} color={c[fg]}>
        {label}
      </Txt>
    </View>
  );
}

/** `font:800 9px; letter-spacing:.06em` — the PRO marker beside a locked feature. */
export function ProBadge({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.accS,
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 3,
          alignSelf: 'center',
        },
        style,
      ]}
    >
      <Txt role="pro" color={c.acc}>
        PRO
      </Txt>
    </View>
  );
}

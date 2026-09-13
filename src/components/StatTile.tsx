import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Text';

/**
 * The inset statistic tile:
 * `background:var(--sur2); border-radius:13px; padding:11px 12px`
 * with a 9.5px tracked label above a 15px value.
 */
export function StatTile({
  label,
  value,
  suffix,
  tone = 'ink',
  variant = 'default',
  style,
}: {
  label: string;
  value: string;
  /** Small muted trailer, e.g. the `/km` in `BDT 5/km`. */
  suffix?: string;
  tone?: 'ink' | 'good' | 'warn' | 'bad' | 'acc';
  variant?: 'default' | 'centered' | 'accent';
  style?: ViewStyle;
}) {
  const { c, radius, text } = useTheme();
  const accent = variant === 'accent';

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: accent ? c.accS : c.sur2,
          borderRadius: variant === 'centered' ? radius.tile : radius.input,
          paddingHorizontal: variant === 'centered' ? 4 : 12,
          paddingVertical: variant === 'centered' ? 8 : 11,
          gap: 3,
          alignItems: variant === 'centered' ? 'center' : 'flex-start',
        },
        style,
      ]}
    >
      {/* Labels are tracked uppercase in a third-width tile, so a two-word one
          clips to "RUNNING TOT…". Shrinking beats truncating: a smaller label
          still reads, a clipped one leaves the rider guessing what it counted. */}
      <Txt
        role="tileLabel"
        tone={accent ? 'acc' : 'mut'}
        uppercase
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Txt>
      <Txt role="tileValue" tone={accent ? 'acc' : tone} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
        {suffix ? <Txt style={text('micro', c.mut)}>{suffix}</Txt> : null}
      </Txt>
    </View>
  );
}

/** The three-across tile row used on the odometer, fuel and detail cards. */
export function StatRow({ children, gap = 10 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', gap }}>{children}</View>;
}

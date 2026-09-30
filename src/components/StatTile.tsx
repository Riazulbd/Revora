import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';
import { Txt } from './Text';

/**
 * The inset statistic tile from the boards:
 * `border-radius:11px; background:var(--sur2); padding:10px 12px`
 * with a `700 9.5px / 0.57px` tracked label above a `700 15px` figure (`margin-top:4px`).
 *
 * `centered` — text-align centre (the three under the mileage gauge).
 * `accent` — `background:var(--accS)`, label and figure in `--acc` (Fuel detail "Mileage").
 * `outlined` — `background:var(--sur); border:1px solid var(--brd)` (a tile on the page, not in a card).
 *
 * A figure that is `NO_VALUE` renders muted, as every board draws its em dashes.
 */
export function StatTile({
  label,
  value,
  suffix,
  tone = 'ink',
  variant = 'default',
  badge,
  style,
  testID,
}: {
  label: string;
  value?: string;
  /** Small muted trailer, e.g. the `/km` in `BDT 5/km`. */
  suffix?: string;
  tone?: 'ink' | 'mut' | 'good' | 'warn' | 'bad' | 'acc';
  variant?: 'default' | 'centered' | 'accent' | 'outlined';
  /** Replaces the figure with a pill — CONFIDENCE → `<Badge variant="outlined" tone="good" label="HIGH" />`. */
  badge?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius, text } = useTheme();
  const accent = variant === 'accent';
  const centered = variant === 'centered';
  const printed = value ?? NO_VALUE;
  const valueTone = accent ? 'acc' : printed === NO_VALUE ? 'mut' : tone;

  return (
    <View
      testID={testID}
      style={[
        {
          flex: 1,
          backgroundColor: accent ? c.accS : variant === 'outlined' ? c.sur : c.sur2,
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: c.brd,
          borderRadius: radius.tile,
          paddingHorizontal: 12,
          paddingVertical: 10,
          alignItems: centered ? 'center' : 'flex-start',
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
        align={centered ? 'center' : 'left'}
      >
        {label}
      </Txt>
      {badge ? (
        <View style={{ marginTop: 3, alignItems: centered ? 'center' : 'flex-start' }}>{badge}</View>
      ) : (
        <Txt
          role="tileValue"
          tone={valueTone}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          align={centered ? 'center' : 'left'}
          style={{ marginTop: 4 }}
        >
          {printed}
          {suffix ? <Txt style={text('micro', c.mut)}>{suffix}</Txt> : null}
        </Txt>
      )}
    </View>
  );
}

/** The three-across tile row used on the odometer, fuel and detail cards (`gap:8px`). */
export function StatRow({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

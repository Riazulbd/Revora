import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { fontFamily, useTheme } from '@/theme';
import { Txt } from './Text';

export type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral' | 'accent';
export type BadgeVariant = 'filled' | 'outlined';
/**
 * `default` — `font:700 11px; border-radius:8px; padding:2px 8px` (the km/L pill
 *   on a fuel row, the status pills on the maintenance list).
 * `chip` — kept as an alias of `default` for existing callers.
 * `tag` — `font:700 9.5px; letter-spacing:0.57px; uppercase; border-radius:7px;
 *   padding:2px 7px` (the category tag under a Costs row).
 * `wide` — `font:700 11px; letter-spacing:0.4px; border-radius:8px;
 *   padding:3px 10px` (the Pro board's FREE marker, and the roomier PRO pill
 *   the Analytics upsell draws).
 */
export type BadgeSize = 'default' | 'chip' | 'tag' | 'wide';

const TONE_ROLES: Record<BadgeTone, { fg: 'good' | 'warn' | 'bad' | 'mut' | 'acc'; bg: 'goodS' | 'warnS' | 'badS' | 'sur2' | 'accS' }> = {
  good: { fg: 'good', bg: 'goodS' },
  warn: { fg: 'warn', bg: 'warnS' },
  bad: { fg: 'bad', bg: 'badS' },
  neutral: { fg: 'mut', bg: 'sur2' },
  accent: { fg: 'acc', bg: 'accS' },
};

/**
 * The status pill.
 *
 * Filled: the tone's foreground on its soft background. Outlined (the boards'
 * CONFIDENCE HIGH, 310 KM OVER, EXPIRING · 12 DAYS): `background:var(--sur);
 * border:1px solid <tone>; letter-spacing:0.4px; text-transform:uppercase`.
 * Text carries the status as well as colour, so a tone is never the only signal.
 */
export function Badge({
  label,
  tone = 'neutral',
  variant = 'filled',
  size = 'default',
  uppercase,
  style,
  testID,
}: {
  label: string;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Outlined and tag badges are uppercase on every board; filled ones are not. */
  uppercase?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const { fg, bg } = TONE_ROLES[tone];
  const outlined = variant === 'outlined';
  const tag = size === 'tag';
  const wide = size === 'wide';

  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: outlined ? c.sur : c[bg],
          borderWidth: outlined ? 1 : 0,
          borderColor: outlined ? c[fg] : 'transparent',
          borderRadius: tag ? radius.chip : radius.badge,
          paddingHorizontal: tag ? 7 : wide ? 10 : 8,
          paddingVertical: wide ? 3 : 2,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Txt
        role={tag ? 'tileLabel' : 'chip'}
        color={c[fg]}
        uppercase={uppercase ?? (outlined || tag || wide)}
        numberOfLines={1}
        style={(outlined || wide) && !tag ? { letterSpacing: 0.4 } : undefined}
      >
        {label}
      </Txt>
    </View>
  );
}

/**
 * The PRO marker: `font:700 10.5px; letter-spacing:0.95px; color:var(--acc);
 * background:var(--accS); border-radius:8px; padding:3px 8px` (Garage "Add
 * another motorcycle", the Analytics title). `small` is the overflow menu's
 * `9.5px / 0.57px / padding:2px 7px`; `wide` is the Analytics upsell's
 * `padding:3px 10px`.
 */
export function ProBadge({
  small = false,
  wide = false,
  style,
}: {
  small?: boolean;
  wide?: boolean;
  style?: ViewStyle;
}) {
  const { c, radius } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.accS,
          borderRadius: radius.badge,
          paddingHorizontal: small ? 7 : wide ? 10 : 8,
          paddingVertical: small ? 2 : 3,
          alignSelf: 'center',
        },
        style,
      ]}
    >
      <Txt
        color={c.acc}
        style={{
          fontFamily: fontFamily[700],
          fontSize: small ? 9.5 : 10.5,
          letterSpacing: small ? 0.57 : 0.95,
        }}
      >
        PRO
      </Txt>
    </View>
  );
}

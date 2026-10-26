import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral' | 'accent' | 'info' | 'ink';
export type BadgeVariant = 'filled' | 'outlined';
/**
 * Every badge is a pill (`border-radius:999px`) set in `600 12px`:
 * `default` — `padding:3px 8px` (Figma `Badge`, `Tag`: "2 DUE", "1 EXPIRING").
 * `chip` — `padding:2px 8px`, the tighter tag beside a row title ("Full").
 * `tag` — the `chip` shape, kept for existing callers.
 * `wide` — `padding:4px 10px` (`4px 10px 4px 8px` once it carries a glyph).
 * `status` — `padding:6px 8px`, the count chips over the Maintenance list.
 */
export type BadgeSize = 'default' | 'chip' | 'tag' | 'wide' | 'status';

/**
 * The status pill: the tone's text colour on its soft fill. `outlined` puts
 * the same text on the card colour inside a 1px tone border. Text carries the
 * status as well as colour, so a tone is never the only signal.
 */
export function Badge({
  label,
  tone = 'neutral',
  variant = 'filled',
  size = 'default',
  icon,
  bordered = false,
  uppercase,
  style,
  testID,
}: {
  label: string;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** A 1px hairline in the tone's border colour (Figma `Badge bad` on Workshop records). */
  bordered?: boolean;
  /** A 14px glyph before the label ("✓ Valid", the clock on "1 EXPIRING"). */
  icon?: IconName;
  uppercase?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();
  const [fg, bg] =
    tone === 'good'
      ? [c.good, c.goodS]
      : tone === 'warn'
        ? [c.warn, c.warnS]
        : tone === 'bad'
          ? [c.bad, c.badS]
          : tone === 'accent'
            ? [c.accText, c.accS]
            : tone === 'info'
              ? [c.info, c.infoS]
              : tone === 'ink'
                ? [c.ink, c.sur]
                : [c.mut, c.sur2];
  const hairline =
    tone === 'good' ? c.goodBrd : tone === 'warn' ? c.warnBrd : tone === 'bad' ? c.badBrd : tone === 'accent' ? c.accBrd : c.brd;
  const outlined = variant === 'outlined';
  const tight = size === 'chip' || size === 'tag';

  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: outlined ? c.sur : bg,
          borderWidth: outlined || bordered ? 1 : 0,
          borderColor: outlined ? fg : bordered ? hairline : 'transparent',
          borderRadius: 999,
          paddingLeft: size === 'wide' ? (icon ? 8 : 10) : 8,
          paddingRight: size === 'wide' ? 10 : 8,
          paddingVertical: size === 'wide' ? 4 : size === 'status' ? 6 : tight ? 2 : 3,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Txt role="badge" color={fg} uppercase={uppercase ?? false} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * The PRO marker (Figma `PRO chip`): `background:#FF6B3D; border-radius:999px;
 * padding:2px 8px`, `700 12px #14171B`. `small` keeps that size; `wide` is
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
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.heroAcc,
          borderRadius: 999,
          paddingHorizontal: wide ? 10 : 8,
          paddingVertical: small ? 2 : 3,
          alignSelf: 'center',
        },
        style,
      ]}
    >
      <Txt role="pro" color="#14171B">
        PRO
      </Txt>
    </View>
  );
}

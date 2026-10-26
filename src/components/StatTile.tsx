import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * The statistic tile. Figma draws it two ways:
 *
 * `hero` — inside the dark-accent hero (Figma `Stat`): `background:#23272C;
 *   border-radius:16px; padding:12px; gap:4px`, a `500 12px #9AA1AA` label, a
 *   `700 20px` white figure and an optional `12px` line under it
 *   ("▲ 1.4 km/L" in green, "all costs" muted).
 * `default` — the same shape on a white card: `background:#F1F2F5`, muted
 *   label, `700 18px` ink figure.
 *
 * `centered` centres the text; `accent` is the soft-accent tile; `outlined`
 * is a tile standing on the page rather than in a card (`border-radius:20px`,
 * a hairline); `good` / `warn` / `bad` are the tone-tinted tiles ("You pay",
 * the Delta on Workshop records, a part's Used reading), which take the tone's
 * hairline when `bordered`.
 *
 * `eyebrow` sets the label in the tracked uppercase eyebrow, with an optional
 * 14px `icon` before it (Figma `L` on Workshop records).
 *
 * A figure that is `NO_VALUE` renders muted, so an em dash never reads as data.
 */
export function StatTile({
  label,
  value,
  suffix,
  sub,
  subTone = 'mut',
  tone = 'ink',
  variant = 'default',
  valueSize,
  eyebrow = false,
  icon,
  bordered = false,
  badge,
  style,
  testID,
}: {
  label: string;
  value?: string;
  /** Small muted trailer, e.g. the `/L` in `৳122/L`. */
  suffix?: string;
  /** The line under the figure ("all costs", "▲ 1.4 km/L"). */
  sub?: string;
  subTone?: 'mut' | 'good' | 'bad' | 'warn';
  tone?: 'ink' | 'mut' | 'good' | 'warn' | 'bad' | 'acc';
  variant?: 'default' | 'hero' | 'centered' | 'accent' | 'outlined' | 'good' | 'warn' | 'bad';
  /** `700 22px` (`xl`), `700 20px` (`lg`, the Dashboard hero), `700 18px` (`md`), `700 16px` (`sm`). Hero tiles default to `lg`, others to `md`. */
  valueSize?: 'xl' | 'lg' | 'md' | 'sm';
  /** The label as the tracked uppercase eyebrow (`INSTALLED`, `QUOTED`). */
  eyebrow?: boolean;
  /** A 14px glyph before the label. */
  icon?: IconName;
  /** A 1px hairline: `#E9EBEF` on white, the tone's own on a tinted tile. */
  bordered?: boolean;
  /** Replaces the figure with a pill — confidence → `<Badge tone="good" label="High" />`. */
  badge?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius, text } = useTheme();
  const hero = variant === 'hero';
  const accent = variant === 'accent';
  const good = variant === 'good';
  const warnTile = variant === 'warn';
  const badTile = variant === 'bad';
  const outlined = variant === 'outlined';
  const centered = variant === 'centered';
  const printed = value ?? NO_VALUE;
  const empty = printed === NO_VALUE;
  const size = valueSize ?? (hero ? 'lg' : 'md');

  const labelColor = hero ? c.heroMut : accent ? c.accText : good ? c.good : warnTile ? c.warn : badTile ? c.bad : c.mut;
  const valueColor = hero
    ? empty
      ? c.heroMut
      : c.heroInk
    : accent
      ? c.accText
      : good
        ? c.good
        : warnTile
          ? c.warn
          : badTile
            ? c.bad
        : empty
        ? c.mut
        : tone === 'mut'
          ? c.mut
          : tone === 'good'
            ? c.good
            : tone === 'warn'
              ? c.warn
              : tone === 'bad'
                ? c.bad
                : tone === 'acc'
                  ? c.accText
                  : c.ink;
  const subColor =
    subTone === 'good'
      ? hero
        ? c.heroGood
        : c.good
      : subTone === 'bad'
        ? c.bad
        : subTone === 'warn'
          ? c.warn
          : labelColor;

  return (
    <View
      testID={testID}
      style={[
        {
          flex: 1,
          backgroundColor: hero
            ? c.heroTile
            : accent
              ? c.accS
              : good
                ? c.goodS
                : warnTile
                  ? c.warnS
                  : badTile
                    ? c.badS
                    : outlined
                      ? c.sur
                      : c.sur2,
          borderWidth: outlined || bordered ? 1 : 0,
          borderColor: good ? c.goodBrd : warnTile ? c.warnBrd : badTile ? c.badBrd : c.brd,
          borderRadius: outlined || bordered ? radius.smallCard : radius.tile,
          padding: outlined || bordered ? 14 : 12,
          gap: 4,
          alignItems: centered ? 'center' : 'flex-start',
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: centered ? 'center' : 'stretch' }}>
        {icon ? <Icon name={icon} size={14} color={labelColor} /> : null}
        <Txt
          role={eyebrow ? 'eyebrow' : 'tileLabel'}
          color={labelColor}
          uppercase={eyebrow}
          numberOfLines={1}
          align={centered ? 'center' : 'left'}
          style={{ flexShrink: 1 }}
        >
          {label}
        </Txt>
      </View>
      {badge ? (
        <View style={{ alignItems: centered ? 'center' : 'flex-start' }}>{badge}</View>
      ) : (
        <Txt
          role={size === 'xl' ? 'headline' : size === 'lg' ? 'tileValueLarge' : 'tileValue'}
          color={valueColor}
          numberOfLines={1}
          ellipsizeMode="tail"
          align={centered ? 'center' : 'left'}
          style={size === 'sm' ? { fontSize: 16, lineHeight: 20 } : undefined}
        >
          {printed}
          {suffix ? <Txt style={text('micro', labelColor)}>{suffix}</Txt> : null}
        </Txt>
      )}
      {sub ? (
        <Txt
          role={subTone === 'mut' ? 'micro' : 'smallStrong'}
          color={subColor}
          numberOfLines={1}
          align={centered ? 'center' : 'left'}
        >
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

/** The three-across tile row (`gap:8px`). */
export function StatRow({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SIZE, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';
import { Divider } from './Divider';

/**
 * The row shapes used inside a `ListCard` (`padding:0 16px`, a hairline
 * between rows):
 *
 *  · MenuRow — tinted icon square, title, optional subtitle, something on the
 *    right, a chevron.
 *  · RecordRow — the same skeleton with a trailing amount and/or a badge.
 *  · KeyValueRow — a static label / value pair.
 *
 * Every row sits on a 48dp minimum height so each target is reachable
 * (requirement 58).
 */

export type RowTone = 'accent' | 'good' | 'neutral' | 'warn' | 'bad' | 'info';

function useRowTint(tone: RowTone): string {
  const { c } = useTheme();
  return tone === 'good'
    ? c.goodS
    : tone === 'warn'
      ? c.warnS
      : tone === 'bad'
        ? c.badS
        : tone === 'info'
          ? c.infoS
          : tone === 'neutral'
            ? c.sur2
            : c.accS;
}

function useRowInk(tone: RowTone): string {
  const { c } = useTheme();
  return tone === 'good'
    ? c.good
    : tone === 'warn'
      ? c.warnIcon
      : tone === 'bad'
        ? c.badIcon
        : tone === 'info'
          ? c.info
          : tone === 'neutral'
            ? c.ink
            : c.accBright;
}

/**
 * The tinted icon tile in front of a row (Figma `Tile`): `40×40;
 * border-radius:12px`, the tone's soft fill and a 20px glyph in its ink.
 */
export function RowIcon({
  children,
  icon,
  tone = 'accent',
  size = 40,
}: {
  children?: React.ReactNode;
  /** Draws this glyph in the tone's ink, sized to the square, when no children are given. */
  icon?: IconName;
  tone?: RowTone;
  size?: number;
}) {
  const background = useRowTint(tone);
  const ink = useRowInk(tone);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size >= 36 ? 12 : 10,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children ?? (icon ? <Icon name={icon} size={size >= 36 ? 20 : 16} color={ink} /> : null)}
    </View>
  );
}

export function MenuRow({
  label,
  subtitle,
  onPress,
  icon,
  iconTone = 'neutral',
  leading,
  right,
  badge,
  chevron = true,
  dense = false,
  disabled = false,
  testID,
}: {
  label: string;
  subtitle?: string;
  onPress: () => void;
  /** Renders a 40px `RowIcon` in front of the label. */
  icon?: IconName;
  iconTone?: RowTone;
  /** Anything else in front of the label (a PRO badge in the overflow menu). */
  leading?: React.ReactNode;
  /** Extra content before the chevron — a badge, a value, a PRO marker. */
  right?: React.ReactNode;
  badge?: React.ReactNode;
  chevron?: boolean;
  /** `500 14px` (the overflow menu, the search "Jump to" list). */
  dense?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : undefined}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        opacity: pressed ? 0.6 : disabled ? 0.5 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: dense ? 11 : 12, flexShrink: 1, flex: 1 }}>
        {icon ? <RowIcon icon={icon} tone={iconTone} /> : null}
        {leading}
        <View style={{ flexShrink: 1, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt role={dense ? 'bullet' : 'menuLabel'} numberOfLines={2} style={{ flexShrink: 1 }}>
              {label}
            </Txt>
            {badge}
          </View>
          {subtitle ? (
            <Txt role="meta" tone="mut" numberOfLines={2}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {right}
        {chevron ? <Icon name="chevronRight" size={20} color={c.faint} /> : null}
      </View>
    </Pressable>
  );
}

/** `padding:12px 0` — `400 14px` muted label, `600 14px` value (Fill detail). */
export function KeyValueRow({
  label,
  value,
  valueTone = 'ink',
  onPress,
  trailing,
  testID,
}: {
  label: string;
  value: string;
  valueTone?: 'ink' | 'mut' | 'acc' | 'good' | 'warn' | 'bad';
  onPress?: () => void;
  /** e.g. the copy icon on engine / chassis numbers. */
  trailing?: React.ReactNode;
  testID?: string;
}) {
  const content = (
    <View
      style={{
        minHeight: HIT_SIZE,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Txt role="body" tone="mut" style={{ flexShrink: 0, lineHeight: 18 }}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
        <Txt
          role="body"
          tone={valueTone}
          numberOfLines={2}
          style={{ flexShrink: 1, textAlign: 'right', fontFamily: fontFamily[600], lineHeight: 18 }}
        >
          {value}
        </Txt>
        {trailing}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

/** Renders children with the design's 1px hairline between each. */
export function DividedList({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={style}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * A record in a list.
 *
 * `flush` — a row inside a `ListCard` (Figma `Row`/`Item`): `padding:10px 0;
 * gap:12px`, a 40px icon tile, `600 14px` title, `400 12px` subtitle, an
 * optional `600 14px` amount and a pill on the right, a 20px chevron when it
 * navigates.
 *
 * `card` — the same row on its own white 24px-radius surface.
 */
export function RecordRow({
  variant = 'card',
  leading,
  icon,
  iconTone = 'neutral',
  iconSize,
  title,
  subtitle,
  subtitleTone = 'mut',
  subtitleContent,
  caption,
  amount,
  amountTone = 'ink',
  badge,
  trailing,
  chevron,
  dense = false,
  titleSize = 'default',
  onPress,
  disabled,
  testID,
}: {
  variant?: 'card' | 'flush';
  leading?: React.ReactNode;
  /** Renders a `RowIcon` (40px, or `iconSize`) in front of the title. */
  icon?: IconName;
  iconTone?: RowTone;
  iconSize?: number;
  title: string;
  subtitle?: string;
  /** The subtitle carries the status colour on "Needs attention" rows (`color:var(--bad)`). */
  subtitleTone?: 'mut' | 'ink' | 'bad' | 'warn' | 'good' | 'acc';
  /** Replaces the subtitle text — e.g. a date beside a category tag on a Costs row. */
  subtitleContent?: React.ReactNode;
  caption?: string;
  /** `600 14px` on the right, e.g. `৳1,004`. */
  amount?: string;
  amountTone?: 'ink' | 'mut';
  /** A pill under the amount (`41.2 km/L`) or in place of it (`310 KM OVER`). */
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Defaults to "when it navigates and nothing else sits on the right". */
  chevron?: boolean;
  /** Tighter title/subtitle gap. */
  dense?: boolean;
  /** `large` — `600 15px` title and amount, `padding:14px 0` (the Services, Plan and Workshop rows). */
  titleSize?: 'default' | 'large';
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const flush = variant === 'flush';
  const large = titleSize === 'large';
  const showChevron = chevron ?? (flush && !!onPress && amount === undefined && badge === undefined && trailing === undefined);

  const body = (
    <View
      style={
        flush
          ? { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: large ? 14 : 10, minHeight: HIT_SIZE }
          : {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: c.sur,
              borderRadius: radius.listCard,
              paddingHorizontal: 16,
              paddingVertical: 12,
              minHeight: HIT_SIZE,
            }
      }
    >
      {leading}
      {icon ? <RowIcon icon={icon} tone={iconTone} {...(iconSize === undefined ? {} : { size: iconSize })} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt role={large ? 'rowTitleLarge' : dense ? 'rowTitleDense' : 'rowTitle'} numberOfLines={2}>
          {title}
        </Txt>
        {subtitleContent ??
          (subtitle ? (
            <Txt role={dense ? 'metaSmall' : 'meta'} tone={subtitleTone} numberOfLines={2}>
              {subtitle}
            </Txt>
          ) : null)}
        {caption ? (
          <Txt role="micro" tone="mut" numberOfLines={2}>
            {caption}
          </Txt>
        ) : null}
      </View>
      {amount !== undefined || badge ? (
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {amount !== undefined ? (
            <Txt role={large ? 'rowTitleLarge' : 'rowTitle'} tone={amountTone} numberOfLines={1}>
              {amount}
            </Txt>
          ) : null}
          {badge}
        </View>
      ) : null}
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={20} color={c.faint} /> : null}
    </View>
  );

  if (!onPress) return <View testID={testID}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {body}
    </Pressable>
  );
}

import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SIZE, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Text';
import { Divider } from './Divider';

/**
 * The two row shapes the design uses inside list cards:
 * a tappable menu row with a chevron, and a static key/value row.
 * Both sit on a 44–48dp minimum height so every target is reachable
 * (requirement 58).
 */

export function MenuRow({
  label,
  onPress,
  right,
  badge,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Extra content before the chevron — a badge, a value, a PRO marker. */
  right?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        opacity: pressed ? 0.6 : disabled ? 0.5 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Txt role="menuLabel" numberOfLines={2} style={{ flexShrink: 1 }}>
          {label}
        </Txt>
        {badge}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {right}
        <Icon name="chevronRight" size={16} color={c.mut} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

export function KeyValueRow({
  label,
  value,
  onPress,
  trailing,
  testID,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  /** e.g. the copy icon on engine / chassis numbers. */
  trailing?: React.ReactNode;
  testID?: string;
}) {
  const content = (
    <View
      style={{
        minHeight: HIT_SIZE,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Txt role="kv" tone="mut" style={{ flexShrink: 0 }}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
        <Txt role="kv" numberOfLines={2} style={{ flexShrink: 1, textAlign: 'right' }}>
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
 * The tappable record card used by the fuel, service, rule and part lists:
 * `background:var(--sur); border:1px solid var(--brd); border-radius:16px`.
 */
export function RecordRow({
  leading,
  title,
  subtitle,
  caption,
  trailing,
  onPress,
  disabled,
  testID,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  caption?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { c, radius } = useTheme();

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        borderRadius: radius.listCard,
        paddingHorizontal: 15,
        paddingVertical: 14,
        minHeight: HIT_SIZE,
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="rowTitleDense" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt role="metaSmall" tone="mut" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
        {caption ? (
          <Txt role="micro" tone="mut" numberOfLines={2}>
            {caption}
          </Txt>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) return body;

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

/** The rounded square icon holder in front of a record row. */
export function RowIcon({
  children,
  tone = 'accent',
  size = 38,
}: {
  children: React.ReactNode;
  tone?: 'accent' | 'good' | 'neutral' | 'warn' | 'bad';
  size?: number;
}) {
  const { c } = useTheme();
  const background =
    tone === 'good' ? c.goodS : tone === 'warn' ? c.warnS : tone === 'bad' ? c.badS : tone === 'neutral' ? c.sur2 : c.accS;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size <= 34 ? 10 : 12,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

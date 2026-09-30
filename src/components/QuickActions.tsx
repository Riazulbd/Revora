import React, { forwardRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { HIT_SIZE, MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * The quick-action tile row under the Dashboard search bar: three tiles
 * (`flex:1; height:68px; border-radius:16px; gap:4px`), an 18px glyph at
 * stroke 1.8 over a `700 11.5px` label.
 *
 *  · `solid` — the emphasised tile (Fast Capture). Light draws it `--ink` with
 *    a white label; dark draws it `--sur2` with an `--ink` label — a near-white
 *    slab is what `--ink` would give in dark, and no board has one.
 *  · `accent` — `border:1.5px solid var(--acc)`, label in `--acc` (Documents
 *    when something expires soon), with an 8px `--warn` dot at `top:7; right:7`.
 *  · `default` — `background:var(--sur); border:1px solid var(--brd)`.
 */
export function ActionTile({
  label,
  icon,
  emphasis = 'default',
  dot = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: {
  label: string;
  icon: IconName;
  emphasis?: 'solid' | 'accent' | 'default';
  /** The attention dot. `true` is the boards' amber; a tone picks another. */
  dot?: boolean | 'warn' | 'bad' | 'good';
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: ViewStyle;
}) {
  const { c, dark } = useTheme();
  const solid = emphasis === 'solid';
  const accent = emphasis === 'accent';
  const ink = solid ? (dark ? c.ink : '#FFFFFF') : accent ? c.acc : c.ink;
  const surface = solid ? (dark ? c.sur2 : c.ink) : c.sur;
  const dotColor = dot === 'bad' ? c.bad : dot === 'good' ? c.good : c.warn;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (dot ? `${label}, needs attention` : label)}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          flex: 1,
          height: 68,
          borderRadius: 16,
          backgroundColor: surface,
          borderWidth: solid ? 0 : accent ? 1.5 : 1,
          borderColor: accent ? c.acc : c.brd,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={18} color={ink} strokeWidth={1.8} />
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[700], fontSize: 11.5, color: ink }}>
        {label}
      </Txt>
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dotColor,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/** The three tiles side by side (`gap:8px`). */
export function ActionTileRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap: 8 }, style]}>{children}</View>;
}

export type SearchBarProps = Omit<TextInputProps, 'style'> & {
  /**
   * Resting (Dashboard): a 44px `--sur` field with a 1px `--brd` border that
   * opens the search screen on tap. Pass `onPress` and no `onChangeText`.
   * Active (Search screen): 48px, a 1.5px `--acc` border, editable, with a
   * clear control once there is text.
   */
  onPress?: () => void;
  onClear?: () => void;
  style?: ViewStyle;
  testID?: string;
};

/**
 * `height:44px; border-radius:14px; background:var(--sur); border:1px solid
 * var(--brd); gap:9px; padding:0 14px`, a 16px muted search glyph and a
 * `500 13px` muted placeholder — "Search records, documents, workshops…".
 */
export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar(
  { onPress, onClear, style, testID, value, placeholder = 'Search records, documents, workshops…', ...rest },
  ref,
) {
  const { c, radius } = useTheme();
  const active = onPress === undefined;
  const hasText = typeof value === 'string' && value.length > 0;

  const frame: ViewStyle = {
    height: active ? 48 : 44,
    borderRadius: radius.pill,
    backgroundColor: c.sur,
    borderWidth: active ? 1.5 : 1,
    borderColor: active ? c.acc : c.brd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 14,
    paddingRight: active && hasText ? 4 : 14,
  };

  if (!active) {
    return (
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [frame, { opacity: pressed ? 0.75 : 1 }, style]}
      >
        <Icon name="search" size={16} color={c.mut} strokeWidth={2} />
        <Txt numberOfLines={1} style={{ fontFamily: fontFamily[500], fontSize: 13, color: c.mut, flex: 1 }}>
          {placeholder}
        </Txt>
      </Pressable>
    );
  }

  return (
    <View style={[frame, style]}>
      <Icon name="search" size={16} color={c.mut} strokeWidth={2} />
      <TextInput
        ref={ref}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={c.mut}
        selectionColor={c.acc}
        cursorColor={c.acc}
        returnKeyType="search"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityRole="search"
        testID={testID}
        style={{
          flex: 1,
          height: '100%',
          paddingVertical: 0,
          paddingHorizontal: 0,
          fontFamily: fontFamily[hasText ? 700 : 500],
          fontSize: 14,
          color: c.ink,
        }}
        {...rest}
      />
      {hasText && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={onClear}
          testID={testID === undefined ? undefined : `${testID}-clear`}
          style={({ pressed }) => ({
            width: HIT_SIZE - 4,
            height: HIT_SIZE - 4,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="cross" size={18} color={c.mut} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
});

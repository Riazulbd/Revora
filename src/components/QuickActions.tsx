import React, { forwardRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { HIT_SIZE, MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Text';

export type SearchBarProps = Omit<TextInputProps, 'style'> & {
  /**
   * Resting: a 48px white pill with a hairline that opens the search screen on
   * tap. Pass `onPress` and no `onChangeText`.
   * Active (Figma `Search field`): the same pill with a `1.5px #14171B`
   * border, editable, with a clear control once there is text.
   */
  onPress?: () => void;
  onClear?: () => void;
  style?: ViewStyle;
  testID?: string;
};

/**
 * `height:48px; border-radius:999px; background:#FFFFFF; gap:10px;
 * padding:0 4px 0 16px`, a 20px muted search glyph and a `500 15px` value
 * ("Search records, documents, workshops…" as the placeholder).
 */
export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar(
  { onPress, onClear, style, testID, value, placeholder = 'Search records, documents, workshops…', ...rest },
  ref,
) {
  const { c, radius } = useTheme();
  const active = onPress === undefined;
  const hasText = typeof value === 'string' && value.length > 0;

  const frame: ViewStyle = {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.sur,
    borderWidth: active ? 1.5 : 1,
    borderColor: active ? c.ink : c.brd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: active && hasText ? 4 : 16,
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
        <Icon name="search" size={20} color={c.mut} />
        <Txt numberOfLines={1} style={{ fontFamily: fontFamily[400], fontSize: 15, color: c.faint, flex: 1 }}>
          {placeholder}
        </Txt>
      </Pressable>
    );
  }

  return (
    <View style={[frame, style]}>
      <Icon name="search" size={20} color={c.mut} />
      <TextInput
        ref={ref}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
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
          fontFamily: fontFamily[hasText ? 500 : 400],
          fontSize: 15,
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
          <Icon name="x" size={20} color={c.mut} />
        </Pressable>
      ) : null}
    </View>
  );
});

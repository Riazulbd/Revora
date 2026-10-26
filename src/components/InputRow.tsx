import React, { forwardRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { HIT_SIZE, MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * Figma `Field`: a 64px row inside a white card — a 20px muted glyph, the
 * `500 12px` label over the `600 16px` value, and a `500 14px` unit on the
 * right. Rows stack inside a `ListCard`, which draws the hairline between them.
 */
export type InputRowProps = Omit<TextInputProps, 'style'> & {
  icon?: IconName;
  label: string;
  /** `km`, `Litres` — on the right edge. */
  unit?: string;
  /** `৳` stuck to the front of the figure, in the value's own weight. */
  prefix?: string;
  invalid?: boolean;
  /** A `500 12px` line under the value — "⟳ derived", "last fill". */
  hint?: string;
  hintTone?: 'mut' | 'acc' | 'bad';
  trailing?: React.ReactNode;
  /** The row's testID; the TextInput keeps `testID`. */
  frameTestID?: string;
};

export const InputRow = forwardRef<TextInput, InputRowProps>(function InputRow(
  { icon, label, unit, prefix, invalid = false, hint, hintTone = 'mut', trailing, frameTestID, editable, ...rest },
  ref,
) {
  const { c } = useTheme();
  const disabled = editable === false;

  return (
    <View
      testID={frameTestID}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
    >
      {icon ? <Icon name={icon} size={20} color={invalid ? c.badIcon : c.mut} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="fieldLabel" color={invalid ? c.bad : c.mut} numberOfLines={1}>
          {label}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {prefix ? (
            <Txt role="inputNumeric" color={disabled ? c.mut : c.ink}>
              {prefix}
            </Txt>
          ) : null}
          <TextInput
            ref={ref}
            placeholderTextColor={c.faint}
            selectionColor={c.acc}
            cursorColor={c.acc}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            editable={editable}
            accessibilityLabel={rest.accessibilityLabel ?? label}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: fontFamily[600],
              fontSize: 16,
              color: disabled ? c.mut : c.ink,
              // Android centres single-line input text oddly without this.
              paddingVertical: 0,
              paddingHorizontal: 0,
              height: 22,
            }}
            {...rest}
          />
        </View>
        {hint ? (
          <Txt role="micro" color={hintTone === 'acc' ? c.accText : hintTone === 'bad' ? c.bad : c.mut} numberOfLines={1}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {unit ? (
        <Txt role="bullet" tone="mut">
          {unit}
        </Txt>
      ) : null}
      {trailing}
    </View>
  );
});

/**
 * The same row opening a picker instead of the keyboard — Figma's `Date` row:
 * the value ("Today, 16 Sep") and a chevron on the right.
 */
export function PickerRow({
  icon,
  leading,
  label,
  value,
  placeholder,
  onPress,
  valueTone = 'ink',
  trailing,
  accessibilityLabel,
  disabled = false,
  testID,
}: {
  icon?: IconName;
  /** Something other than the 20px glyph in front — a tinted `RowIcon` tile. */
  leading?: React.ReactNode;
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  /** `acc` draws the value as a link ("Add a photo"). */
  valueTone?: 'ink' | 'acc';
  /** Replaces the chevron. */
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={{ text: value ?? placeholder }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: Math.max(64, HIT_SIZE),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.7 : disabled ? 0.6 : 1,
      })}
    >
      {leading ?? (icon ? <Icon name={icon} size={20} color={c.mut} /> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="fieldLabel" tone="mut" numberOfLines={1}>
          {label}
        </Txt>
        <Txt role="inputNumeric" color={value === null ? c.faint : valueTone === 'acc' ? c.accText : c.ink} numberOfLines={1}>
          {value ?? placeholder}
        </Txt>
      </View>
      {trailing ?? <Icon name="chevronRight" size={20} color={c.faint} />}
    </Pressable>
  );
}

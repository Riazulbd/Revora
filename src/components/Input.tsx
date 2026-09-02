import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { MAX_FONT_SCALE, useTheme } from '@/theme';
import { Txt } from './Text';

export type FieldProps = {
  label?: string;
  /** Helper text under the field, or the validation message when invalid. */
  helper?: string;
  error?: string | null;
  children: React.ReactNode;
  flex?: number;
  style?: ViewStyle;
};

/**
 * `<label>` from the design: a 12px bold muted caption above the control, 6px gap.
 */
export function Field({ label, helper, error, children, flex, style }: FieldProps) {
  return (
    <View style={[{ gap: 6 }, flex !== undefined ? { flex } : null, style]}>
      {label ? (
        <Txt role="fieldLabel" tone="mut">
          {label}
        </Txt>
      ) : null}
      {children}
      {error ? (
        <Txt role="helper" tone="bad">
          {error}
        </Txt>
      ) : helper ? (
        <Txt role="helper" tone="mut">
          {helper}
        </Txt>
      ) : null}
    </View>
  );
}

export type InputProps = Omit<TextInputProps, 'style'> & {
  /** `standard` is the 50px field; `numeric` is the 56px large-figure field. */
  size?: 'standard' | 'numeric' | 'compact';
  invalid?: boolean;
  /** Renders on the inset `--sur2` background, like the design's auto-total box. */
  inset?: boolean;
  style?: ViewStyle;
};

/**
 * The text field: `height:50; border-radius:13; border:1px solid var(--brd)`,
 * with the design's focus treatment (`border-color:var(--acc)`).
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { size = 'standard', invalid = false, inset = false, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { c, text, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  const height = size === 'numeric' ? 56 : size === 'compact' ? 48 : 50;
  const role = size === 'numeric' ? 'inputLarge' : size === 'compact' ? 'inputNumeric' : 'input';

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={c.mut}
      selectionColor={c.acc}
      cursorColor={c.acc}
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        text(role, c.ink),
        {
          height,
          borderWidth: 1,
          borderColor: invalid ? c.bad : focused ? c.acc : c.brd,
          borderRadius: size === 'compact' ? 12 : radius.input,
          backgroundColor: inset ? c.sur2 : c.sur,
          paddingHorizontal: size === 'compact' ? 14 : 15,
          width: '100%',
          // Android centres single-line input text oddly without this.
          paddingVertical: 0,
        },
        style,
      ]}
      {...rest}
    />
  );
});

export type TextAreaProps = Omit<InputProps, 'size'> & { rows?: number };

/** The design's `<textarea rows="3">`. */
export const TextArea = forwardRef<TextInput, TextAreaProps>(function TextArea(
  { rows = 3, invalid = false, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { c, text, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      ref={ref}
      multiline
      textAlignVertical="top"
      placeholderTextColor={c.mut}
      selectionColor={c.acc}
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        text('input', c.ink),
        {
          minHeight: 24 * rows + 24,
          borderWidth: 1,
          borderColor: invalid ? c.bad : focused ? c.acc : c.brd,
          borderRadius: radius.input,
          backgroundColor: c.sur,
          paddingHorizontal: 15,
          paddingTop: 14,
          paddingBottom: 14,
        },
        style,
      ]}
      {...rest}
    />
  );
});

/**
 * A field that opens a picker rather than the keyboard — dates, categories.
 * Looks identical to `Input` so the form reads as one system.
 */
export function PickerField({
  value,
  placeholder,
  onPress,
  size = 'standard',
  accessibilityLabel,
  testID,
}: {
  value: string | null;
  placeholder: string;
  onPress: () => void;
  size?: 'standard' | 'compact';
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { c, text, radius } = useTheme();
  const height = size === 'compact' ? 48 : 50;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? placeholder}
      accessibilityValue={{ text: value ?? placeholder }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        height,
        borderWidth: 1,
        borderColor: c.brd,
        borderRadius: size === 'compact' ? 12 : radius.input,
        backgroundColor: c.sur,
        paddingHorizontal: 15,
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt style={text('input', value === null ? c.mut : c.ink)} numberOfLines={1}>
        {value ?? placeholder}
      </Txt>
    </Pressable>
  );
}

/** Two or three fields side by side, as the design lays out Date + Odometer. */
export function FieldRow({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', gap }}>{children}</View>;
}

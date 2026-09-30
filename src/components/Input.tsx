import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type FieldProps = {
  label?: string;
  /** A 13px muted glyph before the label (Add fuel: calendar, odometer, drop, banknote). */
  icon?: IconName;
  /** Helper text under the field, or the validation message when invalid. */
  helper?: string;
  error?: string | null;
  children: React.ReactNode;
  flex?: number;
  style?: ViewStyle;
  testID?: string;
};

/**
 * The field label from the boards: `font:600 12px; color:var(--mut)` with an
 * optional 13px glyph (`gap:6px`), 7px above the control; a `500 11.5px`
 * helper 8px under it.
 */
export function Field({ label, icon, helper, error, children, flex, style, testID }: FieldProps) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: 7 }, flex !== undefined ? { flex } : null, style]} testID={testID}>
      {label ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon ? <Icon name={icon} size={13} color={c.mut} strokeWidth={2} /> : null}
          <Txt role="smallStrong" tone="mut">
            {label}
          </Txt>
        </View>
      ) : null}
      {children}
      {error ? (
        <Txt role="helper" tone="bad" style={{ marginTop: 1 }}>
          {error}
        </Txt>
      ) : helper ? (
        <Txt role="helper" tone="mut" style={{ marginTop: 1 }}>
          {helper}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * `standard` — `height:52px; font:500 15px; padding:0 16px` (Sign in, Add motorcycle).
 * `compact` — `height:48px`, same type (the optional details card).
 * `numeric` — `height:56px; font:700 17px`, centred (Litres, ৳ / litre, Total).
 * `hero` — `height:60px; font:700 24px` with a `700 15px` unit (the first odometer).
 * `mini` — `height:44px; border-radius:11px; font:700 15px` (the odometer
 *   correction field on the history board, the two-up rows on Records).
 * `micro` — `height:40px; border-radius:11px; font:700 13px` (the Services
 *   board's odometer / cost pair).
 *
 * `mini` and `micro` keep the 11px radius the boards give every 40–44px field;
 * everything taller keeps the 13px input radius.
 */
export type InputSize = 'standard' | 'numeric' | 'compact' | 'hero' | 'mini' | 'micro';

export type InputProps = Omit<TextInputProps, 'style'> & {
  size?: InputSize;
  invalid?: boolean;
  /** `warn` draws the amber 1.5px border (below-last-reading odometer); `bad` the red one. */
  tone?: 'default' | 'warn' | 'bad';
  /**
   * `true` / `'sur2'` — the inset `--sur2` surface (a derived total box).
   * `'bg'` — the page background, as fields inside a card are drawn.
   */
  inset?: boolean | 'bg' | 'sur2';
  /** A unit on the right: `km`, `L` (`600 12px` muted; `700 15px` on the hero size). */
  unit?: string;
  /** A prefix on the left, e.g. the currency symbol. */
  prefix?: string;
  align?: 'left' | 'center';
  /** A `600 10px` line under the value inside the field — "last fill", "⟳ derived". */
  hint?: string;
  hintTone?: 'acc' | 'mut';
  /** A control inside the field's right edge (the password eye, 44×44). */
  trailing?: React.ReactNode;
  /**
   * Horizontal padding. The boards draw a field inside a card at 14 and a
   * field on the page at 16; the size's own default is the commoner of the two.
   */
  padX?: number;
  /** Applied to the field's frame (flex, margins). */
  style?: ViewStyle;
  /** The frame's testID; the TextInput keeps `testID`. */
  frameTestID?: string;
};

const INPUT_HEIGHT: Record<InputSize, number> = {
  standard: 52,
  compact: 48,
  numeric: 56,
  hero: 60,
  mini: 44,
  micro: 40,
};

/** Fields at 44px and under take the 11px tile radius on every board. */
const SMALL_SIZES: readonly InputSize[] = ['mini', 'micro'];

const INPUT_FONT: Record<InputSize, number> = {
  standard: 15,
  compact: 15,
  numeric: 17,
  hero: 24,
  mini: 15,
  micro: 13,
};

/**
 * The text field: `border-radius:13px; border:1px solid var(--brd);
 * background:var(--sur)`, a 1.5px accent border while focused.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    size = 'standard',
    invalid = false,
    tone = 'default',
    inset = false,
    unit,
    prefix,
    align,
    hint,
    hintTone = 'mut',
    trailing,
    padX,
    style,
    frameTestID,
    editable,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const { c, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  const small = SMALL_SIZES.includes(size);
  const numeric = size === 'numeric' || size === 'hero' || small;
  const height = INPUT_HEIGHT[size];
  const fontSize = INPUT_FONT[size];
  const weight = numeric ? 700 : 500;
  const frameRadius = small ? radius.tile : radius.input;
  const insetX = padX ?? (numeric && !prefix ? 14 : 16);
  const centered = align === 'center' || (align === undefined && size === 'numeric' && unit === undefined && prefix === undefined);

  const alert = invalid || tone === 'bad';
  const borderColor = alert ? c.bad : tone === 'warn' ? c.warn : focused ? c.acc : c.brd;
  const borderWidth = alert || tone === 'warn' || focused ? 1.5 : 1;
  const background = inset === 'bg' ? c.bg : inset ? c.sur2 : c.sur;
  const disabled = editable === false;

  return (
    <View
      testID={frameTestID}
      style={[
        {
          height,
          borderWidth,
          borderColor,
          borderRadius: frameRadius,
          backgroundColor: disabled ? c.sur2 : background,
          paddingLeft: insetX,
          paddingRight: trailing ? 4 : insetX,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        },
        style,
      ]}
    >
      {prefix ? (
        <Txt style={{ fontFamily: fontFamily[weight], fontSize, color: c.mut }}>{prefix}</Txt>
      ) : null}
      <View style={{ flex: 1, alignItems: centered ? 'center' : 'stretch', justifyContent: 'center' }}>
        <TextInput
          ref={ref}
          placeholderTextColor={c.mut}
          selectionColor={c.acc}
          cursorColor={c.acc}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            fontFamily: fontFamily[weight],
            fontSize,
            color: disabled ? c.mut : c.ink,
            textAlign: centered ? 'center' : 'left',
            // Android centres single-line input text oddly without this.
            paddingVertical: 0,
            paddingHorizontal: 0,
            width: '100%',
            ...(hint ? { height: fontSize + 8 } : { height: '100%' }),
          }}
          {...rest}
        />
        {hint ? (
          <Txt
            numberOfLines={1}
            style={{ fontFamily: fontFamily[600], fontSize: 10, color: hintTone === 'acc' ? c.acc : c.mut, marginTop: -1 }}
          >
            {hint}
          </Txt>
        ) : null}
      </View>
      {unit ? (
        <Txt
          style={{
            fontFamily: fontFamily[size === 'hero' ? 700 : 600],
            fontSize: size === 'hero' ? 15 : 12,
            color: c.mut,
          }}
        >
          {unit}
        </Txt>
      ) : null}
      {trailing}
    </View>
  );
});

/**
 * The read-only third field on Add fuel — the one the other two work out:
 * `height:56px; background:var(--sur2); border:1px solid var(--brd)`, a
 * centred `700 17px` muted figure over a `600 10px` "⟳ derived" note.
 */
export function DerivedField({
  value,
  note = '⟳ derived',
  tone = 'mut',
  style,
  testID,
}: {
  value: string;
  note?: string;
  tone?: 'mut' | 'ink';
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={`${value}, ${note}`}
      style={[
        {
          height: 56,
          borderRadius: radius.input,
          backgroundColor: c.sur2,
          borderWidth: 1,
          borderColor: c.brd,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[700], fontSize: 17, color: tone === 'ink' ? c.ink : c.mut }}>
        {value}
      </Txt>
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[600], fontSize: 10, color: c.mut }}>
        {note}
      </Txt>
    </View>
  );
}

export type TextAreaProps = Omit<InputProps, 'size' | 'unit' | 'prefix' | 'hint' | 'trailing' | 'align'> & { rows?: number };

/** The design's `<textarea rows="3">`: `border-radius:13px; padding:14px 16px`. */
export const TextArea = forwardRef<TextInput, TextAreaProps>(function TextArea(
  { rows = 3, invalid = false, tone = 'default', inset = false, style, frameTestID, onFocus, onBlur, ...rest },
  ref,
) {
  const { c, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const alert = invalid || tone === 'bad';

  return (
    <View testID={frameTestID} style={style}>
      <TextInput
        ref={ref}
        multiline
        textAlignVertical="top"
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
        style={{
          fontFamily: fontFamily[500],
          fontSize: 15,
          color: c.ink,
          minHeight: 24 * rows + 28,
          borderWidth: alert || tone === 'warn' || focused ? 1.5 : 1,
          borderColor: alert ? c.bad : tone === 'warn' ? c.warn : focused ? c.acc : c.brd,
          borderRadius: radius.input,
          backgroundColor: inset === 'bg' ? c.bg : inset ? c.sur2 : c.sur,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 14,
        }}
        {...rest}
      />
    </View>
  );
});

/**
 * A field that opens a picker rather than the keyboard — dates, manufacturers.
 * Looks identical to `Input` so the form reads as one system; `trailingIcon`
 * is the 16px muted chevron the boards draw on "Pick a date" and "Bajaj".
 */
export function PickerField({
  value,
  placeholder,
  onPress,
  size = 'standard',
  weight = 'regular',
  inset = false,
  leading,
  trailingIcon,
  suffix,
  padX,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: {
  value: string | null;
  placeholder: string;
  onPress: () => void;
  size?: InputSize;
  /** `bold` is the boards' `700 15px` date field ("Today", "13 Sep"). */
  weight?: 'regular' | 'bold';
  inset?: boolean | 'bg' | 'sur2';
  leading?: React.ReactNode;
  trailingIcon?: IconName;
  /** `500 11.5px` muted trailer after the value — "· from your history". */
  suffix?: string;
  /** Matches `Input`'s `padX`. */
  padX?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const height = INPUT_HEIGHT[size];
  const small = SMALL_SIZES.includes(size);
  const bold = weight === 'bold' || size === 'numeric' || small;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? placeholder}
      accessibilityValue={{ text: value ?? placeholder }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          height,
          borderWidth: 1,
          borderColor: c.brd,
          borderRadius: small ? radius.tile : radius.input,
          backgroundColor: inset === 'bg' ? c.bg : inset ? c.sur2 : c.sur,
          paddingHorizontal: padX ?? (size === 'numeric' || small ? 14 : 16),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          opacity: pressed ? 0.75 : disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {leading}
      <Txt
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fontFamily[bold ? 700 : 500],
          fontSize: INPUT_FONT[size],
          color: value === null ? c.mut : c.ink,
        }}
      >
        {value ?? placeholder}
        {suffix && value !== null ? (
          <Txt style={{ fontFamily: fontFamily[500], fontSize: 11.5, color: c.mut }}> {suffix}</Txt>
        ) : null}
      </Txt>
      {trailingIcon ? <Icon name={trailingIcon} size={16} color={c.mut} strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** Two or three fields side by side, as the design lays out Date + Odometer (`gap:12px`). */
export function FieldRow({ children, gap = 12, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

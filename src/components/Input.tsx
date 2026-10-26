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
  /** Appends the boards' `· optional` trailer to the label (`400 12px #878E98`). */
  optional?: boolean;
  children: React.ReactNode;
  flex?: number;
  style?: ViewStyle;
  testID?: string;
};

/**
 * The field label (Figma `Input` → label): `500 12px #6B727C` with an optional
 * 14px glyph (`gap:6px`), 6px above the control; a `400 12px` helper under it.
 */
export function Field({ label, icon, helper, error, optional = false, children, flex, style, testID }: FieldProps) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: 6 }, flex !== undefined ? { flex } : null, style]} testID={testID}>
      {label ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon ? <Icon name={icon} size={14} color={c.mut} /> : null}
          <Txt role="fieldLabel" tone="mut">
            {label}
          </Txt>
          {optional ? (
            <Txt role="meta" tone="faint">
              · optional
            </Txt>
          ) : null}
        </View>
      ) : null}
      {children}
      {error ? (
        <Txt role="micro" tone="bad">
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
 * Figma's field (`Box`): `height:48px; background:#F5F6F8; border:1px solid
 * #E9EBEF; border-radius:14px; padding-left:14px`, `400 15px` text.
 *
 * `standard` / `compact` — that field.
 * `numeric` — 56px, `600 17px`, centred when it has no unit or prefix.
 * `hero` — 60px, `700 24px` with a `600 15px` unit (the first odometer).
 * `mini` — 44px, `600 15px`; `micro` — 40px, `600 13px`. Both take the 12px
 *   tile radius.
 */
export type InputSize = 'standard' | 'numeric' | 'compact' | 'hero' | 'mini' | 'micro';

export type InputProps = Omit<TextInputProps, 'style'> & {
  size?: InputSize;
  invalid?: boolean;
  /** `warn` draws the amber 1.5px border (below-last-reading odometer); `bad` the red one. */
  tone?: 'default' | 'warn' | 'bad';
  /**
   * The field fill. Default — `#F5F6F8`, as a field inside a card is drawn.
   * `'sur'` — white, for a field standing on the page.
   * `true` / `'sur2'` — the deeper `#F1F2F5` (a derived total box).
   * `'bg'` — the page colour (same as the default in light).
   */
  inset?: boolean | 'bg' | 'sur' | 'sur2';
  /** A unit on the right: `km`, `L` (`500 14px` muted; `600 15px` on the hero size). */
  unit?: string;
  /** A prefix on the left, e.g. the currency symbol. */
  prefix?: string;
  /** A 20px muted glyph before the text (the envelope on Reset password). */
  leadingIcon?: IconName;
  /** `bold` sets a 48px field in `600` (the rule editor's interval boxes). */
  weight?: 'regular' | 'bold';
  align?: 'left' | 'center';
  /** A `500 11px` line under the value inside the field — "last fill", "⟳ derived". */
  hint?: string;
  hintTone?: 'acc' | 'mut';
  /** A control inside the field's right edge (the password eye, 44×44). */
  trailing?: React.ReactNode;
  /** Horizontal padding; Figma insets every field 14px. */
  padX?: number;
  /** Applied to the field's frame (flex, margins). */
  style?: ViewStyle;
  /** The frame's testID; the TextInput keeps `testID`. */
  frameTestID?: string;
};

const INPUT_HEIGHT: Record<InputSize, number> = {
  standard: 48,
  compact: 48,
  numeric: 56,
  hero: 60,
  mini: 44,
  micro: 40,
};

/** Fields at 44px and under take the 12px tile radius. */
const SMALL_SIZES: readonly InputSize[] = ['mini', 'micro'];

const INPUT_FONT: Record<InputSize, number> = {
  standard: 15,
  compact: 15,
  numeric: 17,
  hero: 24,
  mini: 15,
  micro: 13,
};

/** The text field, with a 1.5px accent border while focused. */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    size = 'standard',
    invalid = false,
    tone = 'default',
    inset = false,
    weight: weightOverride,
    unit,
    prefix,
    leadingIcon,
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
  const weight = size === 'hero' ? 700 : numeric || weightOverride === 'bold' ? 600 : weightOverride === 'regular' ? 400 : 400;
  const frameRadius = small ? radius.iconTile : radius.input;
  const insetX = padX ?? 14;
  const centered = align === 'center' || (align === undefined && size === 'numeric' && unit === undefined && prefix === undefined);

  // Figma `Input — error`: the field lifts to white inside a 1.5px red border
  // and grows an alert glyph on the right.
  const alert = invalid || tone === 'bad';
  const borderColor = alert ? c.badIcon : tone === 'warn' ? c.warnIcon : focused ? c.acc : c.brd;
  const borderWidth = alert || tone === 'warn' || focused ? 1.5 : 1;
  const background = alert || inset === 'sur' ? c.sur : inset === true || inset === 'sur2' ? c.sur2 : c.field;
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
          gap: leadingIcon ? 10 : 8,
          width: '100%',
        },
        style,
      ]}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={20} color={c.mut} /> : null}
      {prefix ? (
        <Txt style={{ fontFamily: fontFamily[weight], fontSize, color: c.mut }}>{prefix}</Txt>
      ) : null}
      <View style={{ flex: 1, alignItems: centered ? 'center' : 'stretch', justifyContent: 'center' }}>
        <TextInput
          ref={ref}
          placeholderTextColor={c.faint}
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
            style={{ fontFamily: fontFamily[500], fontSize: 11, color: hintTone === 'acc' ? c.accText : c.mut, marginTop: -1 }}
          >
            {hint}
          </Txt>
        ) : null}
      </View>
      {unit ? (
        <Txt
          style={{
            fontFamily: fontFamily[size === 'hero' ? 600 : 500],
            fontSize: size === 'hero' ? 15 : 14,
            color: c.mut,
          }}
        >
          {unit}
        </Txt>
      ) : null}
      {trailing}
      {alert && !trailing && !unit ? <Icon name="circleAlert" size={20} color={c.badIcon} /> : null}
    </View>
  );
});

/**
 * A read-only field showing a value the others work out: `height:56px;
 * background:#F1F2F5`, a centred `600 17px` figure over a `500 11px` note.
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
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[600], fontSize: 17, color: tone === 'ink' ? c.ink : c.mut }}>
        {value}
      </Txt>
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[500], fontSize: 11, color: c.mut }}>
        {note}
      </Txt>
    </View>
  );
}

export type TextAreaProps = Omit<InputProps, 'size' | 'unit' | 'prefix' | 'hint' | 'trailing' | 'align'> & { rows?: number };

/** A multi-line field: the input's fill, border and radius, `padding:12px 14px`. */
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
        placeholderTextColor={c.faint}
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
          fontFamily: fontFamily[400],
          fontSize: 15,
          color: c.ink,
          minHeight: 22 * rows + 24,
          borderWidth: alert || tone === 'warn' || focused ? 1.5 : 1,
          borderColor: alert ? c.bad : tone === 'warn' ? c.warn : focused ? c.acc : c.brd,
          borderRadius: radius.input,
          backgroundColor: inset === true || inset === 'sur2' ? c.sur2 : inset === 'sur' ? c.sur : c.field,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 12,
        }}
        {...rest}
      />
    </View>
  );
});

/**
 * A field that opens a picker rather than the keyboard — dates, manufacturers.
 * Looks identical to `Input` so the form reads as one system; `trailingIcon`
 * is the 20px chevron.
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
  /** `bold` is the `600 15px` date field ("Today", "13 Sep"). */
  weight?: 'regular' | 'bold';
  inset?: boolean | 'bg' | 'sur' | 'sur2';
  leading?: React.ReactNode;
  trailingIcon?: IconName;
  /** `400 12px` muted trailer after the value — "· from your history". */
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
          borderRadius: small ? radius.iconTile : radius.input,
          backgroundColor: inset === 'sur' ? c.sur : inset === true || inset === 'sur2' ? c.sur2 : c.field,
          paddingHorizontal: padX ?? 14,
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
          fontFamily: fontFamily[bold ? 600 : 400],
          fontSize: INPUT_FONT[size],
          color: value === null ? c.faint : c.ink,
        }}
      >
        {value ?? placeholder}
        {suffix && value !== null ? (
          <Txt style={{ fontFamily: fontFamily[400], fontSize: 12, color: c.mut }}> {suffix}</Txt>
        ) : null}
      </Txt>
      {trailingIcon ? <Icon name={trailingIcon} size={20} color={c.faint} /> : null}
    </Pressable>
  );
}

/** Two or three fields side by side, as the design lays out Date + Odometer (`gap:12px`). */
export function FieldRow({ children, gap = 12, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

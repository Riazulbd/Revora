import React, { useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Txt } from '@/components';
import { MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';

/**
 * The two field shapes the completion sheet draws that the shared `Input`
 * cannot express.
 *
 * `MaintenanceNumberField` is the board's Odometer box: 52px tall on the 13px
 * input radius, but with the figure at `700 15px` rather than the shared
 * field's `500 15px`, and a `600 12px` muted unit on the right. A 52px field in
 * bold exists on this one board, so it lives here rather than as a seventh
 * `InputSize`.
 *
 * `MaintenanceInlineField` is the Qty / Price pair: a 48px box on the page
 * ground with the label inline on the left (`600 12px` muted) and the value
 * hard against the right edge (`700 14px`). The value is given an intrinsic
 * width from its own length so that a currency symbol sits against its digits
 * instead of drifting to the far side of the box.
 */

const DIGIT_RATIO = 0.62;

function intrinsicWidth(text: string, fontSize: number): number {
  return Math.max(2, text.length) * fontSize * DIGIT_RATIO + 4;
}

export function MaintenanceNumberField({
  value,
  onChangeText,
  unit,
  placeholder,
  accessibilityLabel,
  testID,
}: {
  value: string;
  onChangeText: (next: string) => void;
  /** `km` / `mi` — `600 12px` muted, hard right. */
  unit?: string;
  placeholder?: string;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        height: 52,
        borderRadius: radius.input,
        borderWidth: focused ? 1.5 : 1,
        borderColor: focused ? c.acc : c.brd,
        backgroundColor: c.sur,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        {...(placeholder === undefined ? {} : { placeholder })}
        keyboardType="decimal-pad"
        placeholderTextColor={c.mut}
        selectionColor={c.acc}
        cursorColor={c.acc}
        accessibilityLabel={accessibilityLabel}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        testID={testID}
        style={{
          flex: 1,
          height: '100%',
          paddingVertical: 0,
          paddingHorizontal: 0,
          fontFamily: fontFamily[700],
          fontSize: 15,
          color: c.ink,
        }}
      />
      {unit ? (
        <Txt style={{ fontFamily: fontFamily[600], fontSize: 12, color: c.mut }}>{unit}</Txt>
      ) : null}
    </View>
  );
}

export function MaintenanceInlineField({
  label,
  value,
  onChangeText,
  prefix,
  suffix,
  placeholder,
  keyboardType = 'decimal-pad',
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  /** A currency symbol, drawn against the digits. */
  prefix?: string;
  /** `L`, `pcs` — drawn after the digits at the value's own weight. */
  suffix?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const shown = value === '' ? (placeholder ?? '') : value;

  return (
    <View
      style={{
        flex: 1,
        height: 48,
        borderRadius: radius.input,
        borderWidth: focused ? 1.5 : 1,
        borderColor: focused ? c.acc : c.brd,
        backgroundColor: c.bg,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Txt role="smallStrong" tone="mut" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        {prefix ? (
          <Txt style={{ fontFamily: fontFamily[700], fontSize: 14, color: c.ink }}>{prefix}</Txt>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          {...(placeholder === undefined ? {} : { placeholder })}
          keyboardType={keyboardType}
          placeholderTextColor={c.mut}
          selectionColor={c.acc}
          cursorColor={c.acc}
          accessibilityLabel={label}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          testID={testID}
          style={{
            flexShrink: 1,
            width: intrinsicWidth(shown, 14),
            height: '100%',
            paddingVertical: 0,
            paddingHorizontal: 0,
            textAlign: 'right',
            fontFamily: fontFamily[700],
            fontSize: 14,
            color: c.ink,
          }}
        />
        {suffix ? (
          <Txt style={{ fontFamily: fontFamily[700], fontSize: 14, color: c.ink }}> {suffix}</Txt>
        ) : null}
      </View>
    </View>
  );
}

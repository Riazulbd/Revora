import React, { useState } from 'react';
import { TextInput, View, type ViewStyle } from 'react-native';

import { Txt } from '@/components';
import { MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';

/**
 * The boards' label-left / figure-right box.
 *
 * `Quoted ৳3,200`, `Invoice ৳3,850`, `Qty 1.2 L`, `Price ৳780` — a muted label
 * pinned to the left edge and a bold, right-aligned figure against the right.
 * The shared `Input` puts its label before the value and left-aligns the text,
 * which is a different shape, so this one lives beside the screens that draw it.
 *
 * `compact` is the estimate guard's 48px / radius 13 pair; `micro` is the
 * maintenance item's 40px / radius 11 pair.
 */
export function ServiceMoneyField({
  label,
  value,
  onChangeText,
  placeholder = '0',
  prefix,
  size = 'micro',
  tone = 'ink',
  inset = false,
  unit,
  keyboardType = 'decimal-pad',
  style,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  /** A `700` leader stuck to the figure: the currency symbol on a price. */
  prefix?: string;
  size?: 'compact' | 'micro';
  /** The figure's colour — the invoice goes red once it is over the quote. */
  tone?: 'ink' | 'bad' | 'good' | 'warn';
  /** Draws the box on the page colour, as a field inside a card is drawn. */
  inset?: boolean;
  /** A `700` trailer after the figure: the `L` on a litre quantity. */
  unit?: string;
  keyboardType?: 'decimal-pad' | 'default';
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  const compact = size === 'compact';
  const height = compact ? 48 : 40;
  const valueSize = compact ? 14 : 13;
  const labelSize = compact ? 12 : 11;
  const ink = tone === 'bad' ? c.bad : tone === 'good' ? c.good : tone === 'warn' ? c.warn : c.ink;

  return (
    <View
      style={[
        {
          flex: 1,
          height,
          borderRadius: compact ? radius.input : radius.tile,
          backgroundColor: inset ? c.bg : c.sur,
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? c.acc : c.brd,
          paddingHorizontal: compact ? 14 : 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      <Txt
        numberOfLines={1}
        style={{ fontFamily: fontFamily[600], fontSize: labelSize, color: c.mut, flexShrink: 0 }}
      >
        {label}
      </Txt>
      {/* The figure, its symbol and its unit read as one thing pinned to the
          right edge, exactly as the board draws `Price ৳780` and `Qty 1.2 L`. */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        {prefix ? (
          <Txt style={{ fontFamily: fontFamily[700], fontSize: valueSize, color: ink }}>{prefix}</Txt>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.mut}
          selectionColor={c.acc}
          cursorColor={c.acc}
          keyboardType={keyboardType}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          testID={testID}
          style={{
            flexShrink: 1,
            minWidth: 52,
            height: '100%',
            textAlign: 'right',
            paddingVertical: 0,
            paddingHorizontal: 0,
            fontFamily: fontFamily[700],
            fontSize: valueSize,
            color: ink,
          }}
        />
        {unit ? (
          <Txt style={{ fontFamily: fontFamily[700], fontSize: valueSize, color: ink }}> {unit}</Txt>
        ) : null}
      </View>
    </View>
  );
}

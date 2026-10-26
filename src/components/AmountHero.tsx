import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';
import { Txt } from './Text';

/**
 * The amount entry at the top of a money form (Figma `Amount hero` on Add
 * fuel and Add expense): a `500 13px` label, the currency symbol and the
 * figure in `700 52px −0.02em` (48px on `size="medium"`), and a chip under
 * it that says what the figure rests on — "8.2 L × ৳122.4 / L", "Parking ·
 * The Red One". The chip can open something when tapped.
 */
export function AmountHero({
  label,
  symbol,
  value,
  onChangeText,
  size = 'large',
  chip,
  error,
  editable = true,
  accessibilityLabel,
  testID,
}: {
  label: string;
  symbol: string;
  value: string;
  onChangeText: (next: string) => void;
  size?: 'large' | 'medium';
  /** False when the figure is derived — the chip says from what. */
  editable?: boolean;
  chip?: {
    label: string;
    /** A trailer after the label, in the accent or muted ("· last fill"). */
    note?: string;
    noteTone?: 'acc' | 'mut';
    onPress?: () => void;
    expanded?: boolean;
    /** What a tap does, for screen readers. */
    hint?: string;
    testID?: string;
  };
  error?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const fontSize = size === 'large' ? 52 : 48;
  const empty = value === '';
  // A text input has no intrinsic width, so the figure is measured off a
  // hidden copy and the field sized to it — that is what keeps the symbol
  // and the digits together in the middle of the screen.
  const [textWidth, setTextWidth] = useState(0);
  const digits = {
    fontFamily: fontFamily[700],
    fontSize,
    letterSpacing: -fontSize * 0.02,
  } as const;

  const chipBody = chip ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: error ? c.bad : c.brd,
      }}
    >
      <Txt role="smallStrong" color={error ? c.bad : c.mut} numberOfLines={1}>
        {chip.label}
        {chip.note ? (
          <Txt role="smallStrong" color={chip.noteTone === 'acc' ? c.accText : c.mut}>
            {chip.note}
          </Txt>
        ) : null}
      </Txt>
    </View>
  ) : null;

  return (
    <View style={{ alignItems: 'center', paddingVertical: size === 'large' ? 12 : 8, gap: 6 }}>
      <Txt style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 16, color: c.mut }}>{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Txt
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          style={{ ...digits, position: 'absolute', opacity: 0 }}
        >
          {empty ? '0' : value}
        </Txt>
        <Txt style={{ ...digits, lineHeight: Math.round(fontSize * 1.25), color: empty ? c.faint : c.ink }}>{symbol}</Txt>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={c.faint}
          keyboardType="decimal-pad"
          editable={editable}
          selectionColor={c.acc}
          cursorColor={c.acc}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID}
          style={{
            ...digits,
            color: c.ink,
            paddingVertical: 0,
            paddingHorizontal: 0,
            width: Math.min(280, Math.max(fontSize * 0.7, textWidth + 6)),
          }}
        />
      </View>
      {chip && chip.onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${chip.label}${chip.note ?? ''}${chip.hint ? `. ${chip.hint}` : ''}`}
          accessibilityState={chip.expanded === undefined ? {} : { expanded: chip.expanded }}
          onPress={chip.onPress}
          testID={chip.testID}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {chipBody}
        </Pressable>
      ) : chip ? (
        <View testID={chip.testID}>{chipBody}</View>
      ) : null}
      {error ? (
        <Txt role="helper" tone="bad" align="center">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

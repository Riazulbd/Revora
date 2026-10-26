import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * A row in the Settings board's Units card (Figma `Row · Distance` …): a
 * `600 15px` label on the left and the control the board draws on the right —
 * an inline segmented track, or the value pill below — on `padding:8px 0`, a
 * 64px row with the hairline supplied by the enclosing `ListCard`.
 *
 * The label itself is a target: the board's three-way Mileage control cannot
 * express both gallons, so tapping the label opens the full list. Everything
 * the pixels show stays exactly as drawn.
 */
export function AccountUnitRow({
  label,
  onPressLabel,
  accessibilityLabel,
  children,
  testID,
}: {
  label: string;
  /** Opens the full list of units behind this row. */
  onPressLabel?: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      style={{
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 8,
      }}
    >
      {onPressLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${label}, all options`}
          onPress={onPressLabel}
          testID={testID}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          style={({ pressed }) => ({ flexShrink: 1, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Txt role="rowTitleLarge">{label}</Txt>
        </Pressable>
      ) : (
        <Txt role="rowTitleLarge" style={{ flexShrink: 1 }}>
          {label}
        </Txt>
      )}
      <View style={{ flexShrink: 0 }}>{children}</View>
    </View>
  );
}

/**
 * The board's value pill (Figma `Value pill`): `height:48px; border-radius:999px;
 * background:#F1F2F5; padding:0 12px 0 16px; gap:6px`, a `600 14px` ink value
 * and a 20px muted chevron.
 */
export function AccountValuePill({
  value,
  onPress,
  accessibilityLabel,
  testID,
}: {
  value: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        height: HIT_SIZE,
        borderRadius: 999,
        backgroundColor: c.sur2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 16,
        paddingRight: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[600], fontSize: 14, color: c.ink }}>
        {value}
      </Txt>
      <Icon name="chevronDown" size={20} color={c.mut} />
    </Pressable>
  );
}

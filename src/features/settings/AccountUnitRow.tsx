import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * A row in the Settings board's Units card: a `700 14px` label on the left and
 * the control the board draws on the right — an inline segmented track, or the
 * value pill below. `padding:14px 0` on the two segmented rows, `16px 0` on the
 * pill rows, with the hairline supplied by the enclosing `ListCard`.
 *
 * The label itself is a target: the board's three-way Mileage control cannot
 * express both gallons, so tapping the label opens the full list. Everything
 * the pixels show stays exactly as drawn.
 */
export function AccountUnitRow({
  label,
  onPressLabel,
  accessibilityLabel,
  padY = 14,
  children,
  testID,
}: {
  label: string;
  /** Opens the full list of units behind this row. */
  onPressLabel?: () => void;
  accessibilityLabel?: string;
  padY?: number;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: padY,
      }}
    >
      {onPressLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${label}, all options`}
          onPress={onPressLabel}
          testID={testID}
          hitSlop={{ top: padY, bottom: padY, left: 4, right: 4 }}
          style={({ pressed }) => ({ flexShrink: 1, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Txt role="rowTitle">{label}</Txt>
        </Pressable>
      ) : (
        <Txt role="rowTitle" style={{ flexShrink: 1 }}>
          {label}
        </Txt>
      )}
      <View style={{ flexShrink: 0 }}>{children}</View>
    </View>
  );
}

/**
 * The board's value pill on the Currency row: `height:36px; border-radius:11px;
 * background:var(--sur2); padding:0 12px; gap:6px`, a `700 13px` ink value and
 * a 14px muted chevron. Hit slop carries the 36px pill up to the 44px target.
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
  const { c, radius } = useTheme();
  const slop = (HIT_SIZE - 36) / 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: slop, bottom: slop, left: 8, right: 8 }}
      style={({ pressed }) => ({
        height: 36,
        borderRadius: radius.tile,
        backgroundColor: c.sur2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[700], fontSize: 13, color: c.ink }}>
        {value}
      </Txt>
      <Icon name="chevronDown" size={14} color={c.mut} strokeWidth={2} />
    </Pressable>
  );
}

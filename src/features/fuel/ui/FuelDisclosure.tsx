import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * The Add fuel board's two folded sections — "Adjustment" and "Details".
 *
 * At a pump, in the rain, the form is date, odometer, litres, price and Save.
 * Everything else is a row with a chevron: `padding:15px 0`, a `700 14px`
 * heading over a `500 11.5px` muted line that says what is inside, so the rider
 * knows whether it is worth opening without opening it.
 */
export function FuelDisclosure({
  title,
  summary,
  open,
  onToggle,
  children,
  testID,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${summary}`}
        accessibilityHint={open ? 'Hides these fields' : 'Shows these fields'}
        onPress={onToggle}
        testID={testID}
        style={({ pressed }) => ({
          minHeight: HIT_SIZE,
          paddingVertical: 15,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt role="rowTitle">{title}</Txt>
          <Txt role="helper" tone="mut" style={{ marginTop: 2 }} numberOfLines={2}>
            {summary}
          </Txt>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={16} color={c.mut} strokeWidth={2} />
        </View>
      </Pressable>
      {open ? <View style={{ paddingBottom: 14, gap: 12 }}>{children}</View> : null}
    </View>
  );
}

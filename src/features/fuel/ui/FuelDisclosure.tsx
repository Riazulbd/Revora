import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * A folded section on a form — the Add fuel adjustments.
 *
 * At a pump, in the rain, the form is odometer, litres, total and Save.
 * Anything rarer is a row with a chevron: `padding:12px 0`, a `600 15px`
 * heading over a `400 12px` muted line that says what is inside, so the rider
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
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt role="rowTitleLarge">{title}</Txt>
          <Txt role="meta" tone="mut" style={{ marginTop: 2 }} numberOfLines={2}>
            {summary}
          </Txt>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={20} color={c.faint} />
        </View>
      </Pressable>
      {open ? <View style={{ paddingBottom: 16, gap: 12 }}>{children}</View> : null}
    </View>
  );
}

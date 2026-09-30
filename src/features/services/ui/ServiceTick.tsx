import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * The boards' 22px tick: `border-radius:6px`, filled `--acc` with a white check
 * when on, an empty `--sur` box with a 1.5px hairline when off.
 *
 * `strong` is the 700 14px item head ("Engine oil"); the default is the 500 13px
 * line the board uses for "Ask before replacing parts", and muted while unticked
 * as the collapsed "Chain lube" row is drawn.
 */
export function ServiceTick({
  label,
  checked,
  onChange,
  strong = false,
  testID,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  strong?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        marginVertical: -11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          backgroundColor: checked ? c.acc : c.sur,
          borderWidth: checked ? 0 : 1.5,
          borderColor: c.brd,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={2.6} /> : null}
      </View>
      <Txt
        role={strong ? 'rowTitle' : 'body'}
        tone={strong || checked ? 'ink' : 'mut'}
        numberOfLines={2}
        style={{ flex: 1 }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

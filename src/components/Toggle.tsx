import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Text';

/**
 * The switch from the design: a 46×26 track with a 22px white knob that slides
 * between 2px and 22px, over 150 ms.
 */
export function Toggle({
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const offset = useSharedValue(value ? 22 : 2);

  useEffect(() => {
    offset.value = withTiming(value ? 22 : 2, { duration: 150 });
  }, [value, offset]);

  const knobStyle = useAnimatedStyle(() => ({ left: offset.value }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      testID={testID}
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        backgroundColor: value ? c.acc : c.sur2,
        opacity: disabled ? 0.5 : 1,
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 2,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          },
          knobStyle,
        ]}
      />
    </Pressable>
  );
}

/** Label + description on the left, switch on the right — the settings row. */
export function ToggleRow({
  title,
  description,
  value,
  onChange,
  disabled,
  testID,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        paddingVertical: 8,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Txt role="rowTitle">{title}</Txt>
        {description ? (
          <Txt role="metaSmall" tone="mut">
            {description}
          </Txt>
        ) : null}
      </View>
      <Toggle
        value={value}
        onChange={onChange}
        accessibilityLabel={title}
        {...(disabled === undefined ? {} : { disabled })}
        {...(testID === undefined ? {} : { testID })}
      />
    </View>
  );
}

/** The checkbox used by the fuel adjustments card. */
export function CheckRow({
  label,
  checked,
  onChange,
  testID,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
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
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt role="bullet" style={{ flex: 1 }}>
        {label}
      </Txt>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          borderWidth: checked ? 0 : 1.5,
          borderColor: c.brd,
          backgroundColor: checked ? c.acc : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

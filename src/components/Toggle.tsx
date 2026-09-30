import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { HIT_SIZE, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Text';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const KNOB = 26;
const PAD = 3;

/**
 * The switch from the Company allowance board: a `52×32` track
 * (`border-radius:16px; padding:3px`) with a 26px knob that slides between
 * 3px and 23px, over 150 ms. On, the track is `--acc`; the knob is white in
 * light and `--bg` in dark, as the board draws it.
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
  const { c, dark } = useTheme();
  const on = TRACK_WIDTH - KNOB - PAD;
  const offset = useSharedValue(value ? on : PAD);

  useEffect(() => {
    offset.value = withTiming(value ? on : PAD, { duration: 150 });
  }, [value, offset, on]);

  const knobStyle = useAnimatedStyle(() => ({ left: offset.value }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={{ left: 10, right: 10 }}
      testID={testID}
      style={{
        // The track is 52×32 on the board; the target is 44 high (requirement 58).
        height: HIT_SIZE,
        marginVertical: -(HIT_SIZE - TRACK_HEIGHT) / 2,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: value ? c.acc : c.sur2,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: PAD,
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: dark ? c.bg : '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
            knobStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}

/**
 * `700 14px` title and `500 12px` description on the left, the switch on the
 * right — the "This is a company bike" card row.
 */
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
        paddingVertical: 6,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="rowTitle">{title}</Txt>
        {description ? (
          <Txt role="meta" tone="mut">
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

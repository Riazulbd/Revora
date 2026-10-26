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
 * The switch (Figma `Toggle on` / `Switch off`): a `52×32` track
 * (`border-radius:999px; padding:3px`) with a 26px white knob that slides
 * between 3px and 23px, over 150 ms. On, the track is `#D2400F`; off, `#C9CED4`.
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
        // The track is 52×32; the target is 48 high (requirement 58).
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
          backgroundColor: value ? c.acc : c.brdStrong,
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
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
              alignItems: 'center',
              justifyContent: 'center',
            },
            knobStyle,
          ]}
        >
          {/* Figma draws the tick in the knob once the switch is on, so the
              state reads without the colour. */}
          {value ? <Icon name="check" size={14} color={c.acc} strokeWidth={2.6} /> : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

/**
 * Figma `Toggle row`: `600 15px` title and `400 12px` description on the
 * left, the switch on the right.
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
        gap: 12,
        paddingVertical: 8,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="rowTitleLarge">{title}</Txt>
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

/**
 * Figma `Checkbox`: a 24px box, `border-radius:8px`, `1.5px #878E98` border
 * when off and the accent fill with a white tick when on; the `600 15px` label
 * beside it, an optional `400 12px` line under it.
 */
export function CheckRow({
  label,
  description,
  checked,
  onChange,
  testID,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={() => onChange(!checked)}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          borderWidth: checked ? 0 : 1.5,
          borderColor: c.faint,
          backgroundColor: checked ? c.acc : c.sur,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="rowTitleLarge">{label}</Txt>
        {description ? (
          <Txt role="meta" tone="mut">
            {description}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

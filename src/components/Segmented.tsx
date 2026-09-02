import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Text';

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * The segmented control from the fill-type picker:
 * a `--sur2` track with 3px padding and a raised `--sur` thumb.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
  testID,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          backgroundColor: c.sur2,
          borderRadius: radius.input,
          padding: 3,
          gap: 3,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              backgroundColor: active ? c.sur : 'transparent',
              opacity: pressed && !active ? 0.6 : 1,
              // The design's `box-shadow:0 1px 3px rgba(0,0,0,.08)` on the thumb.
              ...(active
                ? {
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : {}),
            })}
          >
            <Txt role={active ? 'mediumStrong' : 'kv'} tone={active ? 'ink' : 'mut'} numberOfLines={1}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The pill filter row (`All fills · Full · Partial · Adjustments`) and the
 * settings theme switch. Selected pill inverts to `--ink` on `--bg`.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  const { c } = useTheme();

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => ({
              minHeight: 32,
              paddingHorizontal: 12,
              justifyContent: 'center',
              borderRadius: 16,
              borderWidth: active ? 0 : 1,
              borderColor: c.brd,
              backgroundColor: active ? c.ink : c.sur,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Txt role="chip" color={active ? c.bg : c.mut}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-select variant used by the expense category picker. */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  const { c } = useTheme();

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: 14,
              justifyContent: 'center',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: active ? c.acc : c.brd,
              backgroundColor: active ? c.accS : c.sur,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Txt role="kv" color={active ? c.acc : c.ink}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

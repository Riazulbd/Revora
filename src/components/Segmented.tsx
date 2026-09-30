import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SIZE, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type SegmentedOption<T extends string> = { value: T; label: string; icon?: IconName };

/**
 * `default` 44px (Add fuel's Fill type), `medium` 40px (Appearance), `compact`
 * 38px (Costs "This month / All time"), `inline` 32px hugging its labels (the
 * Units rows in Settings).
 */
export type SegmentedSize = 'default' | 'medium' | 'compact' | 'inline';

const SEGMENT_HEIGHT: Record<SegmentedSize, number> = { default: 44, medium: 40, compact: 38, inline: 32 };

/**
 * The segmented control from the boards: a `--sur2` track
 * (`border-radius:14px; padding:3px`) with a raised `--sur` thumb
 * (`border-radius:11px; border:1px solid var(--brd)`). Active label
 * `700 13px` ink, inactive `600 13px` muted. The inline size is
 * `border-radius:11px; padding:2px`, a 9px-radius thumb and 12px labels. The
 * Settings board sets its own inner padding per row — 14 for the two-way
 * Distance control, 10 for the three-way Mileage one — which is `padX`.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  padX,
  style,
  testID,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedSize;
  /** Inner horizontal padding of each segment; only the `inline` size hugs its labels. */
  padX?: number;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();
  const inline = size === 'inline';
  const height = SEGMENT_HEIGHT[size];
  const fontSize = inline ? 12 : 13;

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          backgroundColor: c.sur2,
          borderRadius: inline ? 11 : 14,
          padding: inline ? 2 : 3,
          alignSelf: inline ? 'flex-start' : 'stretch',
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
            hitSlop={height < HIT_SIZE ? { top: (HIT_SIZE - height) / 2, bottom: (HIT_SIZE - height) / 2 } : undefined}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => ({
              ...(inline
                ? { paddingHorizontal: padX ?? 12 }
                : { flex: 1, ...(padX === undefined ? {} : { paddingHorizontal: padX }) }),
              minHeight: height,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: inline ? 9 : 11,
              backgroundColor: active ? c.sur : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: c.brd,
              opacity: pressed && !active ? 0.6 : 1,
            })}
          >
            <Txt
              numberOfLines={1}
              style={{ fontFamily: fontFamily[active ? 700 : 600], fontSize, color: active ? c.ink : c.mut }}
            >
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The filter chips (`All fills · Full · Partial · Adjustments`, the Services
 * categories, recent searches): `height:36px; border-radius:7px; padding:0 14px`.
 * Selected is solid `--ink` (white text in light, `--bg` text in dark, exactly
 * as the boards draw it); unselected is `background:var(--sur); border:1px solid
 * var(--brd)` with 600 ink text. `compact` is the Services list's 34px / `0 13px`.
 *
 * `tone` recolours the selected chip — the Records board fills the chip that is
 * filtering to something wrong in `--warn` rather than in ink, so the filter
 * itself carries the warning.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  tone = 'ink',
  wrap = true,
  style,
  testID,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'default' | 'compact';
  /** The selected chip's fill. */
  tone?: 'ink' | 'acc' | 'warn';
  wrap?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, dark } = useTheme();
  const height = size === 'compact' ? 34 : 36;
  const selectedFill = tone === 'acc' ? c.acc : tone === 'warn' ? c.warn : c.ink;
  // On ink the label is white in light and the page colour in dark; on a tone
  // fill it is white in both, which is what every filled pill on the boards does.
  const selectedInk = tone === 'ink' ? (dark ? c.bg : '#FFFFFF') : '#FFFFFF';

  return (
    <View style={[{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 8 }, style]} testID={testID}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => ({
              // The chip is 36px on the board; the target around it is 44
              // (requirement 58), pulled back so the row keeps its rhythm.
              minHeight: HIT_SIZE,
              marginVertical: -(HIT_SIZE - height) / 2,
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                height,
                paddingHorizontal: size === 'compact' ? 13 : 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                borderRadius: 7,
                borderWidth: active ? 0 : 1,
                borderColor: c.brd,
                backgroundColor: active ? selectedFill : c.sur,
              }}
            >
              {option.icon ? (
                <Icon name={option.icon} size={13} color={active ? selectedInk : c.mut} strokeWidth={2} />
              ) : null}
              <Txt
                numberOfLines={1}
                style={{ fontFamily: fontFamily[active ? 700 : 600], fontSize: 12, color: active ? selectedInk : c.ink }}
              >
                {option.label}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single-select grid used by the expense category picker. */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  style,
  testID,
}: {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]} testID={testID}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: 14,
              justifyContent: 'center',
              borderRadius: 12,
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? c.acc : c.brd,
              backgroundColor: active ? c.accS : c.sur,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Txt style={{ fontFamily: fontFamily[active ? 700 : 600], fontSize: 13, color: active ? c.acc : c.ink }}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

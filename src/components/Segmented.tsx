import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SIZE, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  /** A glyph drawn only while the segment is selected (the tick on "Full tank"). */
  activeIcon?: IconName;
};

/**
 * Two tracks from Figma:
 *
 * `default` / `medium` / `compact` — a page-level control (`Fill type`,
 *   `Segmented · Theme`, the Fuel range): white track, `border:1px solid
 *   #E9EBEF; border-radius:999px; padding:4px; gap:4px`, equal-width 44px
 *   segments (40 for `compact`, which sets both labels in `600 13px`).
 * `inline` — the control inside a card row (`Segmented` in Settings → Units):
 *   `background:#F1F2F5; padding:4px; gap:2px`, 40px segments hugging their
 *   labels (`padX`, 12–16 in the design).
 *
 * The active segment is a `#14171B` pill with a `600 14px` white label;
 * inactive labels are `500 14px` muted.
 */
export type SegmentedSize = 'default' | 'medium' | 'compact' | 'inline';

const SEGMENT_HEIGHT: Record<SegmentedSize, number> = { default: 44, medium: 44, compact: 40, inline: 40 };

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

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          gap: inline ? 2 : 4,
          padding: 4,
          borderRadius: 999,
          backgroundColor: inline ? c.sur2 : c.sur,
          borderWidth: inline ? 0 : 1,
          borderColor: c.brd,
          alignSelf: inline ? 'flex-start' : 'stretch',
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        const ink = active ? c.sur : c.mut;
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
                ? { paddingHorizontal: padX ?? 14 }
                : { flex: 1, ...(padX === undefined ? {} : { paddingHorizontal: padX }) }),
              minHeight: height,
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: active ? c.ink : 'transparent',
              opacity: pressed && !active ? 0.6 : 1,
            })}
          >
            {active && option.activeIcon ? (
              <Icon name={option.activeIcon} size={20} color={ink} />
            ) : option.icon ? (
              <Icon name={option.icon} size={20} color={ink} />
            ) : null}
            <Txt
              numberOfLines={1}
              style={{
                fontFamily: fontFamily[active || size === 'compact' ? 600 : 500],
                fontSize: size === 'compact' ? 13 : 14,
                color: ink,
              }}
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
 * The filter chips (fill types, Services categories, recent searches): 36px
 * pills, `padding:0 14px`. Selected is solid ink with a `600 13px` label in the
 * card colour; unselected is white with a `#E9EBEF` border and a `500 13px`
 * ink label. `compact` is 34px.
 *
 * `tone` recolours the selected chip, so a filter showing something wrong can
 * carry the warning itself.
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
  /** `large` — the 48px `600 14px` pills on Services (`padding:0 18px`, 16 with a glyph). */
  size?: 'default' | 'compact' | 'large';
  /** The selected chip's fill. */
  tone?: 'ink' | 'acc' | 'warn';
  wrap?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();
  const height = size === 'compact' ? 34 : size === 'large' ? 48 : 36;
  const large = size === 'large';
  const selectedFill = tone === 'acc' ? c.acc : tone === 'warn' ? c.warn : c.ink;
  // On ink the label takes the card colour (white in light, near-black in dark);
  // on a tone fill it is white in both.
  const selectedInk = tone === 'ink' ? c.sur : '#FFFFFF';

  return (
    <View style={[{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 8 }, style]} testID={testID}>
      {options.map((option) => {
        const active = option.value === value;
        const glyph = active ? (option.activeIcon ?? option.icon) : option.icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => ({
              // The chip is 36px; the target around it is 48 (requirement 58),
              // pulled back so the row keeps its rhythm.
              minHeight: HIT_SIZE,
              marginVertical: -Math.max(0, HIT_SIZE - height) / 2,
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                height,
                paddingLeft: large ? (glyph ? 14 : 18) : size === 'compact' ? 13 : 14,
                paddingRight: large ? (glyph ? 16 : 18) : size === 'compact' ? 13 : 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: large ? 6 : 7,
                borderRadius: 999,
                borderWidth: active ? 0 : 1,
                borderColor: c.brd,
                backgroundColor: active ? selectedFill : c.sur,
              }}
            >
              {glyph ? (
                <Icon name={glyph} size={large ? 18 : 16} color={active ? selectedInk : large ? c.ink : c.mut} />
              ) : null}
              <Txt
                numberOfLines={1}
                style={{
                  fontFamily: fontFamily[active || large ? 600 : 500],
                  fontSize: large ? 14 : 13,
                  color: active ? selectedInk : c.ink,
                }}
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

/**
 * Single-select grid (the expense category picker): 48px tiles,
 * `border-radius:14px`; selected takes the offer card's treatment — `#FFF7F3`
 * fill, accent border, accent label.
 */
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
              minHeight: 48,
              paddingHorizontal: 16,
              justifyContent: 'center',
              borderRadius: 14,
              borderWidth: active ? 2 : 1,
              borderColor: active ? c.acc : c.brd,
              backgroundColor: active ? c.accSel : c.sur,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Txt style={{ fontFamily: fontFamily[600], fontSize: 14, color: active ? c.accText : c.ink }}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

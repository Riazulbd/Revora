import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Icon, Txt, type IconName } from '@/components';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';
import { useImagePicker } from '@/features/shared/useImagePicker';
import type { SafetyStatus } from '@/types';

/**
 * The small shapes the Records boards draw that the shared set does not have
 * in exactly this form. Each one is transcribed from its frame; none of them
 * holds a figure of its own.
 */

/** Figma `Add`: the 48px ink disc with a white plus, in the top bar's right slot. */
export function InkAddButton({ onPress, accessibilityLabel, testID }: { onPress: () => void; accessibilityLabel: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        width: HIT_SIZE,
        height: HIT_SIZE,
        borderRadius: HIT_SIZE / 2,
        backgroundColor: c.ink,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon name="plus" size={20} color={c.sur} />
    </Pressable>
  );
}

/**
 * Figma `Chip` / `Chip on`: a `600 13px` (or `600 14px`) pill, ink with a white
 * tick when selected, white with the hairline when not. 40px on the document
 * kinds, 44px on the safety areas.
 */
export function RecordsChip({
  label,
  selected,
  onPress,
  height = 40,
  size = 13,
  tick = false,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  height?: 40 | 44;
  size?: 13 | 14;
  /** Draws the white tick before a selected label (the safety areas). */
  tick?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const showTick = tick && selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: (HIT_SIZE - height) / 2, bottom: (HIT_SIZE - height) / 2 }}
      style={({ pressed }) => ({
        height,
        paddingLeft: showTick ? 12 : 14,
        paddingRight: 14,
        gap: 6,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: selected ? c.ink : c.sur,
        borderWidth: selected ? 0 : 1,
        borderColor: c.brd,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {showTick ? <Icon name="check" size={18} color={c.sur} strokeWidth={2.2} /> : null}
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[600], fontSize: size, color: selected ? c.sur : c.ink }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** A wrapping row of chips, `gap:8px`. */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;
}

/**
 * Figma `Stat` inside a Records hero: `#23272C; border-radius:16px;
 * padding:12px; gap:4px`, a `500 12px #9AA1AA` label and a `700 20px` figure
 * in whatever colour the frame gives it — green for valid, amber for due soon.
 */
export function HeroStat({ label, value, color, testID }: { label: string; value: string; color?: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.heroTile, borderRadius: 16, padding: 12, gap: 4 }} testID={testID}>
      <Txt role="tileLabel" color={c.heroMut} numberOfLines={1}>
        {label}
      </Txt>
      <Txt role="tileValueLarge" color={color ?? c.heroInk} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
    </View>
  );
}

/**
 * Figma `Segmented` inside a card (claim status): `#F1F2F5; padding:4px;
 * gap:2px; border-radius:999px`, equal 44px segments, `600 13px`; the live
 * one is the ink pill.
 */
export function InsetSegmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" testID={testID} style={{ flexDirection: 'row', gap: 2, padding: 4, borderRadius: 999, backgroundColor: c.sur2 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? c.ink : 'transparent',
              opacity: pressed && !active ? 0.6 : 1,
            })}
          >
            <Txt numberOfLines={1} style={{ fontFamily: fontFamily[600], fontSize: 13, color: active ? c.sur : c.mut }}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const STATUS_CHOICE: Record<SafetyStatus, { label: string; icon: IconName }> = {
  ok: { label: 'Good', icon: 'circleCheck' },
  watch: { label: 'Watch', icon: 'eye' },
  action: { label: 'Bad', icon: 'triangleAlert' },
};

/**
 * Figma `Options` under "How is it": three 72px tiles, `border-radius:18px;
 * gap:4px`, a 20px glyph in the status colour over a `600 14px` label; the
 * chosen one takes the status's soft fill and a 1.5px border in its colour.
 */
export function StatusChoice({
  value,
  onChange,
  testID,
}: {
  value: SafetyStatus | null;
  onChange: (next: SafetyStatus) => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const palette: Record<SafetyStatus, { ink: string; fill: string; brd: string; text: string }> = {
    ok: { ink: c.good, fill: c.goodS, brd: c.good, text: c.good },
    watch: { ink: c.warnIcon, fill: c.warnS, brd: c.warnIcon, text: c.warn },
    action: { ink: c.badIcon, fill: c.badS, brd: c.badIcon, text: c.bad },
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }} testID={testID}>
      {(['ok', 'watch', 'action'] as const).map((status) => {
        const active = value === status;
        const tone = palette[status];
        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={STATUS_CHOICE[status].label}
            onPress={() => onChange(status)}
            testID={testID === undefined ? undefined : `${testID}-${status}`}
            style={({ pressed }) => ({
              flex: 1,
              height: 72,
              borderRadius: 18,
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? tone.fill : c.sur,
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? tone.brd : c.brd,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Icon name={STATUS_CHOICE[status].icon} size={20} color={tone.ink} />
            <Txt style={{ fontFamily: fontFamily[600], fontSize: 14, color: active ? tone.text : c.ink }}>{STATUS_CHOICE[status].label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Figma `Photo` on the document editor: a 168px white panel with a `#C9CED4`
 * hairline, a 56px soft-accent disc holding the camera, `600 15px` and a
 * `400 12px` muted line. Tapping it opens the picker.
 */
export function AttachPhotoPanel({
  title,
  hint,
  onChange,
  testID,
}: {
  title: string;
  hint: string;
  onChange: (uri: string) => void;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const picker = useImagePicker();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={() => void picker.choose(title).then((uri) => uri && onChange(uri))}
      testID={testID}
      style={({ pressed }) => ({
        height: 168,
        borderRadius: radius.card,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brdStrong,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: pressed || picker.busy ? 0.7 : 1,
      })}
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accS, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="camera" size={24} color={c.accBright} />
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Txt role="rowTitleLarge">{title}</Txt>
        <Txt role="meta" tone="mut">
          {hint}
        </Txt>
      </View>
    </Pressable>
  );
}

/** Figma `Segments` in the Safety hero: one 8px rounded bar per area, in its status colour. */
export function HeroSegments({ segments }: { segments: readonly (SafetyStatus | null)[] }) {
  const { c } = useTheme();
  const color = (status: SafetyStatus | null) =>
    status === 'ok' ? c.heroGood : status === 'watch' ? '#F5C26B' : status === 'action' ? c.heroAcc : c.heroLine;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {segments.map((status, index) => (
        <View key={index} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: color(status) }} />
      ))}
    </View>
  );
}

/** Figma `Dots` on a history row: an 8px disc per status present that day. */
export function StatusDots({ statuses }: { statuses: readonly SafetyStatus[] }) {
  const { c } = useTheme();
  const color = (status: SafetyStatus) => (status === 'ok' ? c.good : status === 'watch' ? c.warnIcon : c.badIcon);
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {statuses.map((status) => (
        <View key={status} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color(status) }} />
      ))}
    </View>
  );
}

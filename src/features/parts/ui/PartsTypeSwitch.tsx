import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Txt } from '@/components';
import { fontFamily, useTheme } from '@/theme';

/**
 * The Part / Accessory switch at the top of both editors.
 *
 * It is the shared `Segmented` control's shape — a `--sur2` track,
 * `border-radius:14px; padding:3px`, a 44px raised `--sur` thumb at
 * `border-radius:11px` — but each segment carries a second line explaining what
 * the choice means ("wears out" / "bought once"), which is the whole point of
 * the control: it is the one place a rider decides whether Revora should track
 * wear against the odometer at all.
 *
 * `pending` draws the accent-outlined thumb the dark board shows while the
 * conversion dialog is open: the rider has asked for the other kind, and
 * nothing has changed yet.
 */
export type PartsType = 'part' | 'accessory';

const OPTIONS: readonly { value: PartsType; label: string; note: string }[] = [
  { value: 'part', label: 'Part', note: 'wears out' },
  { value: 'accessory', label: 'Accessory', note: 'bought once' },
];

export function PartsTypeSwitch({
  value,
  onChange,
  pending = null,
  style,
  testID,
}: {
  value: PartsType;
  onChange: (next: PartsType) => void;
  /** The kind awaiting confirmation in a dialog, drawn in the accent. */
  pending?: PartsType | null;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[
        { flexDirection: 'row', backgroundColor: c.sur2, borderRadius: 14, padding: 3 },
        style,
      ]}
    >
      {OPTIONS.map((option) => {
        const awaiting = pending === option.value;
        const active = awaiting || (pending === null && option.value === value);
        const ink = awaiting ? c.acc : active ? c.ink : c.mut;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label} — ${option.note}`}
            onPress={() => onChange(option.value)}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              backgroundColor: active ? c.sur : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: awaiting ? c.acc : c.brd,
              opacity: pressed && !active ? 0.6 : 1,
            })}
          >
            <Txt
              numberOfLines={1}
              style={{ fontFamily: fontFamily[active ? 700 : 600], fontSize: 13, color: ink }}
            >
              {option.label}
            </Txt>
            <Txt numberOfLines={1} style={{ fontFamily: fontFamily[500], fontSize: 10, color: c.mut }}>
              {option.note}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

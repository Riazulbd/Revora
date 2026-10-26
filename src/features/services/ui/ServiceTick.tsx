import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * Figma `Checkbox on` / `Checkbox off`: a 24px box, `border-radius:8px`,
 * filled `#D2400F` with a white tick when on, white with a `1.5px #878E98`
 * hairline when off.
 *
 * `strong` is the `600 15px` item head ("Brake pads"); the default is the
 * `500 13px` line the board uses for "Ask before replacing parts".
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
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        marginVertical: -10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <TickBox checked={checked} />
      <Txt role={strong ? 'rowTitleLarge' : 'bullet'} tone={strong || checked ? 'ink' : 'mut'} numberOfLines={2} style={{ flex: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** The box alone, for rows that draw their own label and trailer. */
export function TickBox({ checked }: { checked: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: checked ? c.acc : c.sur,
        borderWidth: checked ? 0 : 1.5,
        borderColor: c.faint,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {checked ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}
    </View>
  );
}

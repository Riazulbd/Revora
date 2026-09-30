import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Txt } from '@/components';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * The boards' 32px suggestion chip: `height:32px; border-radius:7px;
 * padding:0 12px`.
 *
 * Three states are drawn on the Services boards and all three are here:
 *  · `suggestion` — `--sur2` fill, 600 12px muted. The workshops from the
 *    rider's own history, and "Self-service".
 *  · `selected` — `--accS` fill, 700 12px accent. The product already chosen.
 *  · `outline` — `--sur` with a hairline, 600 12px muted. "+ Other".
 *
 * The chip itself stays 32px, as the board draws it; the target around it is
 * pulled back out to 44 (requirement 58).
 */
export type ServiceChipKind = 'suggestion' | 'selected' | 'outline';

export function ServiceChip({
  label,
  kind = 'suggestion',
  onPress,
  accessibilityLabel,
  selected,
  testID,
}: {
  label: string;
  kind?: ServiceChipKind;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Announced to a screen reader; defaults to `kind === 'selected'`. */
  selected?: boolean;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const isSelected = selected ?? kind === 'selected';

  const background = kind === 'selected' ? c.accS : kind === 'outline' ? c.sur : c.sur2;
  const ink = kind === 'selected' ? c.acc : c.mut;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        marginVertical: -(HIT_SIZE - 32) / 2,
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          height: 32,
          paddingHorizontal: kind === 'selected' || kind === 'outline' ? 11 : 12,
          borderRadius: radius.chip,
          borderWidth: kind === 'outline' ? 1 : 0,
          borderColor: c.brd,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt
          numberOfLines={1}
          style={{ fontFamily: fontFamily[kind === 'selected' ? 700 : 600], fontSize: 12, color: ink }}
        >
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

/** The board's `display:flex; gap:8px` chip row. */
export function ServiceChipRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;
}

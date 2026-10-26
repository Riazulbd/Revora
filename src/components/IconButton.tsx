import React from 'react';
import { Pressable, View } from 'react-native';

import { HIT_SIZE, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

/**
 * The 48px round button in every top bar (Figma `Bell button`, `Back`,
 * `Close`, `Scan`): `border-radius:24px; background:#FFFFFF; border:1px solid
 * #E9EBEF`, a 20px glyph. An unread count shows as the design's 10px red dot
 * (`#D92D20` ringed in 2px of the button colour, `left:25px; top:10px`); the
 * number itself goes into the accessibility label.
 *
 * `plain` is the same target without chrome; `inset` sits on the `#F1F2F5`
 * surface with no border (the month switcher's arrows); `primary` is the
 * accent-filled "+" on list screens. `size` 56 is the Dashboard's icon-only
 * quick actions.
 */
export function IconSquareButton({
  icon,
  onPress,
  accessibilityLabel,
  count = 0,
  variant = 'default',
  color,
  size = HIT_SIZE,
  disabled = false,
  testID,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Shows the red dot when > 0; read out in the accessibility label. */
  count?: number;
  variant?: 'default' | 'plain' | 'inset' | 'primary';
  color?: string;
  size?: number;
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const plain = variant === 'plain';
  const inset = variant === 'inset';
  const primary = variant === 'primary';
  const label = count > 0 ? `${accessibilityLabel}, ${count} unread` : accessibilityLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: plain || inset || primary ? 0 : 1,
        borderColor: c.brd,
        backgroundColor: plain ? 'transparent' : inset ? c.sur2 : primary ? c.acc : c.sur,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
      })}
    >
      <Icon name={icon} size={20} color={color ?? (primary ? '#FFFFFF' : c.ink)} />
      {count > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: Math.round(size * 0.21),
            left: size / 2 + 1,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.badIcon,
            borderWidth: 2,
            borderColor: plain ? c.bg : c.sur,
          }}
        />
      ) : null}
    </Pressable>
  );
}

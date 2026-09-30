import React from 'react';
import { Pressable, View } from 'react-native';

import { HIT_SIZE, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * The 44×44 rounded square in the tab header (Dashboard board, top band):
 * `border-radius:14px; background:var(--sur); border:1px solid var(--brd)`,
 * a 19px glyph at stroke 1.8, and for the bell a red count badge pinned
 * `top:-4px; right:-4px; min-width:18px; height:18px; border-radius:9px;
 * background:var(--bad); font:700 10.5px; color:#fff; padding:0 4px`.
 *
 * `plain` is the same target without chrome — the back chevron's 44px area.
 */
export function IconSquareButton({
  icon,
  onPress,
  accessibilityLabel,
  count = 0,
  variant = 'default',
  color,
  disabled = false,
  testID,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Shown as the red badge when > 0; part of the accessibility label too. */
  count?: number;
  variant?: 'default' | 'plain';
  color?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const plain = variant === 'plain';
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
        width: HIT_SIZE,
        height: HIT_SIZE,
        borderRadius: radius.pill,
        borderWidth: plain ? 0 : 1,
        borderColor: c.brd,
        backgroundColor: plain ? 'transparent' : c.sur,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
      })}
    >
      <Icon name={icon} size={plain ? 22 : 19} color={color ?? c.ink} strokeWidth={plain ? 2.2 : 1.8} />
      {count > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: c.bad,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Txt role="badge" color="#FFFFFF" numberOfLines={1}>
            {count > 99 ? '99+' : String(count)}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

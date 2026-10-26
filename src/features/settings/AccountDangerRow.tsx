import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, RowIcon, Txt } from '@/components';
import { fontFamily, useTheme } from '@/theme';

/**
 * The last row of the Settings board's Data & account card (Figma `Row ·
 * Delete account`): a `#FBE9E7` icon square with the bin, the label in
 * `700 15px` danger, a `400 12px` muted line under it, and the chevron in the
 * danger colour too — the one row in the card that is not ordinary navigation
 * says so in every part of itself.
 */
export function AccountDangerRow({
  label,
  subtitle,
  onPress,
  testID,
}: {
  label: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${subtitle}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 64,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <RowIcon icon="trash" tone="bad" />
      <View style={{ flexShrink: 1, flex: 1, gap: 2 }}>
        <Txt numberOfLines={2} style={{ fontFamily: fontFamily[700], fontSize: 15, lineHeight: 19, color: c.bad }}>
          {label}
        </Txt>
        <Txt role="meta" tone="mut" numberOfLines={2}>
          {subtitle}
        </Txt>
      </View>
      <Icon name="chevronRight" size={20} color={c.badIcon} />
    </Pressable>
  );
}

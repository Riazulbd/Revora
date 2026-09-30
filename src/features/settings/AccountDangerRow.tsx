import React from 'react';
import { Pressable, View } from 'react-native';

import { Txt } from '@/components';
import { RowIcon } from '@/components/Rows';
import { fontFamily, useTheme } from '@/theme';

/**
 * The last row of the Settings board's Data & account card: a `--badS` icon
 * square, the label in `--bad`, a `500 12px` muted line under it, and — unlike
 * every other row in the card — no chevron. The board ends the list on the one
 * action it does not want mistaken for navigation.
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
        minHeight: 48,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <RowIcon icon="alertTriangle" tone="bad" />
      <View style={{ flexShrink: 1, flex: 1 }}>
        <Txt numberOfLines={2} style={{ fontFamily: fontFamily[700], fontSize: 14, color: c.bad }}>
          {label}
        </Txt>
        <Txt role="meta" tone="mut" numberOfLines={2}>
          {subtitle}
        </Txt>
      </View>
    </Pressable>
  );
}

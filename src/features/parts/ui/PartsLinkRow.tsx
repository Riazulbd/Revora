import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * "Link to a service · optional" — the field-shaped row the Add part board
 * draws under Cost: `height:48px; border-radius:13px`, a 16px muted glyph, a
 * `600 13px` label with a `500 11.5px` muted trailer, and the chevron.
 *
 * It is the one control on the form that decides where the part's cost is
 * counted: a linked part's cost belongs to the service, and appears in the
 * ledger once rather than twice.
 */
export function PartsLinkRow({
  value,
  onPress,
  disabled = false,
  style,
  testID,
}: {
  /** The linked service, or null for the board's default "· optional" state. */
  value: string | null;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Link this part to a service"
      accessibilityValue={{ text: value ?? 'Not linked' }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: Math.max(48, HIT_SIZE),
          height: 48,
          borderRadius: radius.input,
          backgroundColor: c.sur,
          borderWidth: 1,
          borderColor: c.brd,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          opacity: pressed ? 0.75 : disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Icon name="wrench" size={16} color={c.mut} strokeWidth={1.8} />
        <Txt role="mediumStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {value ?? 'Link to a service'}
        </Txt>
        {value === null ? (
          <Txt role="helper" tone="mut">
            · optional
          </Txt>
        ) : null}
      </View>
      <Icon name="chevronRight" size={16} color={c.mut} strokeWidth={2} />
    </Pressable>
  );
}

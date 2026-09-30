import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Divider, Eyebrow, Icon, Txt } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * The two shapes the Log-a-service board gives its optional sections.
 *
 * Closed, they are two rows inside one 13px-radius card — a `700 14px` title,
 * a `500 11.5px` muted line under it and a chevron, `padding:15px 0` with a
 * hairline between. Open, the section becomes a card of its own: 18px radius,
 * 16px padding, an accent eyebrow at the top and the chevron turned over.
 *
 * Both are drawn on the boards, so both are here, and a section moves between
 * them rather than one pretending to be the other.
 */

/** The 13px-radius card that holds the closed rows. */
export function ServiceDisclosureList({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { c, radius } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <View
      testID={testID}
      style={{
        borderRadius: radius.input,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        paddingHorizontal: 16,
      }}
    >
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

export function ServiceDisclosureRow({
  title,
  subtitle,
  onPress,
  testID,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: false }}
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint="Opens this section"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 15,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Txt role="rowTitle">{title}</Txt>
        <Txt role="metaSmall" tone="mut" style={{ marginTop: 2 }}>
          {subtitle}
        </Txt>
      </View>
      <Icon name="chevronDown" size={16} color={c.mut} strokeWidth={2} />
    </Pressable>
  );
}

/** The opened section: its own 18px card, accent eyebrow, chevron turned over. */
export function ServiceDisclosureCard({
  eyebrow,
  onClose,
  gap = 10,
  children,
  style,
  testID,
}: {
  eyebrow: string;
  onClose: () => void;
  gap?: number;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        {
          borderRadius: radius.card,
          backgroundColor: c.sur,
          borderWidth: 1,
          borderColor: c.brd,
          padding: 16,
          gap,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: true }}
        accessibilityLabel={eyebrow}
        accessibilityHint="Closes this section"
        onPress={onClose}
        testID={testID === undefined ? undefined : `${testID}-close`}
        style={({ pressed }) => ({
          minHeight: HIT_SIZE,
          marginVertical: -12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Eyebrow>{eyebrow}</Eyebrow>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Icon name="chevronDown" size={16} color={c.mut} strokeWidth={2} />
        </View>
      </Pressable>
      {children}
    </View>
  );
}

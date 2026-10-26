import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Card, Eyebrow, Icon, ListCard, Txt, type IconName } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * The two shapes the Log-a-service board gives its optional sections.
 *
 * Closed, they are 64px rows inside one white card (Figma `Sections` →
 * `Disclosure`): a 20px muted glyph, the `600 15px` title over a `400 12px`
 * line, and a plus on the right. Open, the section becomes a card of its own
 * (Figma `Items card`): `padding:8px 16px 16px`, the tracked eyebrow at the
 * top and a 48px close target beside it.
 *
 * Both are drawn on the board, so both are here, and a section moves between
 * them rather than one pretending to be the other.
 */

/** The white card that holds the closed rows. */
export function ServiceDisclosureList({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return <ListCard testID={testID}>{rows}</ListCard>;
}

export function ServiceDisclosureRow({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: IconName;
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
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={20} color={c.mut} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="rowTitleLarge">{title}</Txt>
        <Txt role="meta" tone="mut">
          {subtitle}
        </Txt>
      </View>
      <Icon name="plus" size={20} color={c.mut} />
    </Pressable>
  );
}

/** The opened section: its own card, the eyebrow and a 48px close target. */
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
  const { c } = useTheme();

  return (
    <Card style={[{ paddingTop: 8, gap }, style ?? {}]} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: HIT_SIZE }}>
        <Eyebrow style={{ flexShrink: 1 }}>{eyebrow}</Eyebrow>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${eyebrow.toLowerCase()}`}
          onPress={onClose}
          testID={testID === undefined ? undefined : `${testID}-close`}
          style={({ pressed }) => ({
            width: HIT_SIZE,
            height: HIT_SIZE,
            marginRight: -14,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="x" size={20} color={c.mut} />
        </Pressable>
      </View>
      {children}
    </Card>
  );
}

import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { HIT_SLOP, useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';
import { Eyebrow } from './Card';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * The dark-accent hero (Figma `Hero — dark accent`, `Preview — dark accent`):
 * `linear-gradient(135deg, #1E2227 0%, #101214 71.43%); border-radius:28px;
 * padding:20px; gap:18px`. In dark mode the page is nearly the same colour, so
 * the card picks up a hairline to keep its edge.
 *
 * The gradient is a native view, not an SVG: react-native-svg does not honour
 * percentage sizes on Android, which left the card half-painted on a phone.
 *
 * Children stack under the head row and the figure — stat tiles, a chart.
 */
export function HeroCard({
  children,
  gap = 18,
  padding = 20,
  style,
  testID,
}: {
  children: React.ReactNode;
  gap?: number;
  padding?: number;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          borderRadius: radius.hero,
          overflow: 'hidden',
          padding,
          gap,
          borderWidth: c.heroBrd === 'transparent' ? 0 : 1,
          borderColor: c.heroBrd,
        },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[c.heroFrom, c.heroTo]}
        locations={[0, 0.7143]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/**
 * The hero's first row: the `600 12px` tracked eyebrow ("ODOMETER") on the
 * left, a `#262A30` chip on the right ("Updated 3 days ago", or a tappable
 * "How it's calculated" with an info glyph).
 */
export function HeroHead({
  eyebrow,
  chip,
  chipIcon,
  onChipPress,
  chipAccent = false,
  chipTestID,
}: {
  eyebrow: string;
  chip?: string;
  chipIcon?: IconName;
  onChipPress?: () => void;
  chipTestID?: string;
  /** The orange PRO chip on the plan preview. */
  chipAccent?: boolean;
}) {
  const { c } = useTheme();
  const chipBody = chip ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: chipAccent ? c.heroAcc : c.heroChip,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      {chipIcon ? <Icon name={chipIcon} size={14} color={c.heroChipInk} /> : null}
      <Txt role={chipAccent ? 'pro' : 'micro'} color={chipAccent ? '#14171B' : c.heroChipInk} numberOfLines={1}>
        {chip}
      </Txt>
    </View>
  ) : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Eyebrow color={c.heroMut} style={{ flexShrink: 1 }}>
        {eyebrow}
      </Eyebrow>
      {chipBody && onChipPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={chip} onPress={onChipPress} hitSlop={HIT_SLOP} testID={chipTestID}>
          {({ pressed }) => <View style={{ opacity: pressed ? 0.7 : 1 }}>{chipBody}</View>}
        </Pressable>
      ) : (
        chipBody
      )}
    </View>
  );
}

/**
 * The hero figure: `700 48px −0.02em` white, the unit `500 18px #9AA1AA`
 * 6px after it on the baseline. An uncomputable figure prints as a muted dash.
 */
export function HeroFigure({ value, unit, testID }: { value: string | undefined; unit?: string; testID?: string }) {
  const { c } = useTheme();
  const printed = value ?? NO_VALUE;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }} testID={testID}>
      <Txt role="hero" color={printed === NO_VALUE ? c.heroMut : c.heroInk} numberOfLines={1} adjustsFontSizeToFit>
        {printed}
      </Txt>
      {unit ? (
        <Txt role="heroUnit" color={c.heroMut}>
          {unit}
        </Txt>
      ) : null}
    </View>
  );
}

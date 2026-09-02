import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * Empty, error and loading states.
 *
 * Every module has a real empty state (requirement 45) and every failure has a
 * recovery action (requirement 46) — nothing in Revora spins forever or shows a
 * blank list.
 */

export function EmptyState({
  icon = 'fuel',
  title,
  message,
  primaryAction,
  secondaryAction,
  variant = 'card',
  testID,
}: {
  icon?: IconName;
  title: string;
  message: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  /** `card` sits in the page flow; `page` fills the screen, as the Fuel tab does. */
  variant?: 'card' | 'page';
  testID?: string;
}) {
  const { c } = useTheme();

  const body = (
    <View style={{ alignItems: 'center', gap: 14 }} testID={testID}>
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: c.accS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={30} color={c.acc} />
      </View>
      <Txt role="cardTitle" align="center">
        {title}
      </Txt>
      <Txt role="body" tone="mut" align="center">
        {message}
      </Txt>
      {primaryAction ? (
        <Button
          label={primaryAction.label}
          onPress={primaryAction.onPress}
          size="medium"
          style={{ height: 48, marginTop: 4 }}
        />
      ) : null}
      {secondaryAction ? (
        <Button
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="secondary"
          size="small"
        />
      ) : null}
    </View>
  );

  if (variant === 'page') {
    return (
      <View style={{ flex: 1, minHeight: 380, justifyContent: 'center', paddingHorizontal: 24 }}>{body}</View>
    );
  }

  return <Card style={{ paddingVertical: 36, paddingHorizontal: 24 }}>{body}</Card>;
}

export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  variant = 'card',
  testID,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: 'card' | 'page';
  testID?: string;
}) {
  const { c } = useTheme();

  const body = (
    <View style={{ alignItems: 'center', gap: 14 }} testID={testID}>
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: c.badS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="alert" size={28} color={c.bad} strokeWidth={2.2} />
      </View>
      <Txt role="dialogTitle" align="center">
        {title}
      </Txt>
      <Txt role="body" tone="mut" align="center">
        {message}
      </Txt>
      {onRetry ? (
        <Button label="Try again" variant="secondary" size="medium" onPress={onRetry} style={{ height: 48 }} />
      ) : null}
    </View>
  );

  if (variant === 'page') {
    return (
      <View style={{ flex: 1, minHeight: 380, justifyContent: 'center', paddingHorizontal: 24 }}>{body}</View>
    );
  }

  return <Card style={{ paddingVertical: 36, paddingHorizontal: 24 }}>{body}</Card>;
}

/** The pulsing placeholder block from the design's loading state. */
export function Skeleton({ height = 72, radius: r, style }: { height?: number; radius?: number; style?: ViewStyle }) {
  const { c, radius } = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[{ height, borderRadius: r ?? radius.listCard, backgroundColor: c.sur2 }, animated, style]}
    />
  );
}

/** Three stacked skeleton rows — the list loading state. */
export function SkeletonList({ count = 3, height = 72 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={height} />
      ))}
    </View>
  );
}

/**
 * The "not enough data" panel the design uses in place of an empty chart:
 * a dashed box that says so plainly rather than drawing a flat zero line
 * (requirement 31).
 */
export function InsufficientData({
  title,
  message,
  style,
}: {
  title: string;
  message: string;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: c.brd,
          borderRadius: 13,
          paddingVertical: 22,
          paddingHorizontal: 18,
          alignItems: 'center',
          gap: 6,
        },
        style,
      ]}
    >
      <Txt role="mediumStrong" align="center">
        {title}
      </Txt>
      <Txt role="meta" tone="mut" align="center" style={{ lineHeight: 18 }}>
        {message}
      </Txt>
    </View>
  );
}

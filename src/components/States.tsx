import React, { useEffect } from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily, useTheme } from '@/theme';
import { Button, LinkButton } from './Button';
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

type Action = { label: string; onPress: () => void; testID?: string };

/**
 * The boards' empty state: a card (`padding:24px 20px`, centred, `gap:12px`),
 * a 52px tinted disc with a 24px accent glyph, a `700 17px` title, a
 * `500 13px / 1.55` muted body capped at 290px, and a 48px primary button.
 *
 * `size="compact"` is the filtered-to-empty shape ("No partial fills"): no
 * disc, a `700 15px` title, and the secondary action as an accent link.
 *
 * `badge` replaces the disc with a pill — the Analytics upsell opens on a PRO
 * marker where the other empty states open on a glyph.
 */
export function EmptyState({
  icon,
  iconTone = 'accent',
  badge,
  title,
  message,
  primaryAction,
  secondaryAction,
  variant = 'card',
  size = 'default',
  testID,
}: {
  /** Defaults to the fuel pump in the disc; `compact` shows a glyph only when one is given. */
  icon?: IconName;
  iconTone?: 'accent' | 'neutral' | 'good';
  /** Drawn in place of the icon disc — e.g. `<ProBadge wide />`. */
  badge?: React.ReactNode;
  title: string;
  message: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  /** `card` sits in the page flow; `page` fills the screen, as the Fuel tab does. */
  variant?: 'card' | 'page';
  size?: 'default' | 'compact';
  testID?: string;
}) {
  const { c } = useTheme();
  const compact = size === 'compact';
  const tint = iconTone === 'neutral' ? c.sur2 : iconTone === 'good' ? c.goodS : c.accS;
  const ink = iconTone === 'neutral' ? c.mut : iconTone === 'good' ? c.good : c.acc;

  const body = (
    <View style={{ alignItems: 'center', gap: compact ? 10 : 12 }} testID={testID}>
      {badge ?? (compact ? (
        icon ? <Icon name={icon} size={24} color={ink} strokeWidth={2} /> : null
      ) : (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon ?? 'fuelPump'} size={24} color={ink} strokeWidth={2} />
        </View>
      ))}
      <Txt align="center" style={{ fontFamily: fontFamily[700], fontSize: compact ? 15 : 17, color: c.ink }}>
        {title}
      </Txt>
      <Txt
        align="center"
        style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: compact ? 19.5 : 20.15, color: c.mut, maxWidth: 290 }}
      >
        {message}
      </Txt>
      {primaryAction ? (
        <Button
          label={primaryAction.label}
          onPress={primaryAction.onPress}
          size="medium"
          style={{ marginTop: 4, paddingHorizontal: 24 }}
          {...(primaryAction.testID === undefined ? {} : { testID: primaryAction.testID })}
        />
      ) : null}
      {secondaryAction ? (
        <LinkButton
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          size="large"
          {...(secondaryAction.testID === undefined ? {} : { testID: secondaryAction.testID })}
        />
      ) : null}
    </View>
  );

  if (variant === 'page') {
    return (
      <View style={{ flex: 1, minHeight: 380, justifyContent: 'center' }}>
        <Card style={{ paddingVertical: 24, paddingHorizontal: 20 }}>{body}</Card>
      </View>
    );
  }

  return <Card style={{ paddingVertical: 24, paddingHorizontal: 20 }}>{body}</Card>;
}

/**
 * The load-error card (Dashboard board 04): a neutral 52px disc with the red
 * alert glyph, "Couldn't load your records", the reassurance line, and a
 * 48px "Try again" (`padding:0 28px`).
 */
export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  retryLabel = 'Try again',
  variant = 'card',
  testID,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'card' | 'page';
  testID?: string;
}) {
  const { c } = useTheme();

  const body = (
    <View style={{ alignItems: 'center', gap: 12 }} testID={testID}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: c.sur2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="alertCircle" size={24} color={c.bad} strokeWidth={2} />
      </View>
      <Txt role="cardTitle" align="center">
        {title}
      </Txt>
      <Txt align="center" style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 20.15, color: c.mut, maxWidth: 280 }}>
        {message}
      </Txt>
      {onRetry ? (
        <Button
          label={retryLabel}
          size="medium"
          onPress={onRetry}
          style={{ marginTop: 4, paddingHorizontal: 28 }}
          {...(testID === undefined ? {} : { testID: `${testID}-retry` })}
        />
      ) : null}
    </View>
  );

  if (variant === 'page') {
    return (
      <View style={{ flex: 1, minHeight: 380, justifyContent: 'center' }}>
        <Card style={{ paddingVertical: 24, paddingHorizontal: 20 }}>{body}</Card>
      </View>
    );
  }

  return <Card style={{ paddingVertical: 24, paddingHorizontal: 20 }}>{body}</Card>;
}

/**
 * The in-progress state from the Proof Pack board: a 44px accent ring over a
 * `700 15px` title and a `500 12px` muted line, centred on the page.
 */
export function LoadingState({
  title,
  message,
  variant = 'page',
  testID,
}: {
  title: string;
  message?: string;
  variant?: 'card' | 'page';
  testID?: string;
}) {
  const { c } = useTheme();
  const body = (
    <View
      style={{ alignItems: 'center', gap: 12 }}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={message ? `${title} ${message}` : title}
    >
      <ActivityIndicator size="large" color={c.acc} />
      <Txt align="center" style={{ fontFamily: fontFamily[700], fontSize: 15, color: c.ink }}>
        {title}
      </Txt>
      {message ? (
        <Txt role="meta" tone="mut" align="center">
          {message}
        </Txt>
      ) : null}
    </View>
  );
  if (variant === 'card') return <Card style={{ paddingVertical: 24, paddingHorizontal: 20 }}>{body}</Card>;
  return <View style={{ flex: 1, minHeight: 240, justifyContent: 'center', paddingHorizontal: 24 }}>{body}</View>;
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

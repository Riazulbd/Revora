import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { HIT_SIZE, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Text';

/**
 * The screen shell.
 *
 * Three things every screen gets for free, because getting any of them wrong is
 * the classic mobile failure:
 *
 *  · Safe areas — content clears the status bar, the display cutout, the gesture
 *    bar and the navigation bar on every Android configuration (requirement 40).
 *  · Keyboard — the scroll view keeps the focused field and the Save button
 *    reachable, and a tap outside dismisses the keyboard (requirement 39).
 *  · Padding — the design's `6px 16px 100px` for tabs and `10px 20px 32px` for
 *    pushed screens, so 39 screens share one rhythm.
 */

export type ScreenProps = {
  children: React.ReactNode;
  /** `tab` reserves room for the bottom tab bar; `stack` is a pushed screen. */
  variant?: 'tab' | 'stack';
  /** Scrollable by default; `false` for a screen that manages its own list. */
  scroll?: boolean;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
  /** Extra bottom padding, e.g. for a pinned footer. */
  bottomInset?: number;
  contentStyle?: ViewStyle;
  scrollProps?: Partial<ScrollViewProps>;
  testID?: string;
};

export function Screen({
  children,
  variant = 'stack',
  scroll = true,
  onRefresh,
  refreshing = false,
  bottomInset = 0,
  contentStyle,
  scrollProps,
  testID,
}: ScreenProps) {
  const { c, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const padding: ViewStyle = {
    paddingHorizontal: variant === 'tab' ? spacing.screenX : spacing.stackX,
    paddingTop: variant === 'tab' ? 6 : 10,
    paddingBottom:
      (variant === 'tab' ? spacing.tabBarClearance : 32) + bottomInset + (variant === 'tab' ? 0 : insets.bottom),
  };

  const body = scroll ? (
    <ScrollView
      testID={testID}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[padding, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing || isRefreshing}
            onRefresh={handleRefresh}
            tintColor={c.acc}
            colors={[c.acc]}
            progressBackgroundColor={c.sur}
          />
        ) : undefined
      }
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View testID={testID} style={[{ flex: 1 }, padding, contentStyle]}>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The pushed-screen header: a 44×44 back target pulled 12px left so the glyph
 * lines up with the content edge, then the title.
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
  onBack,
  badge,
  style,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Defaults to `router.back()`. */
  onBack?: () => void;
  badge?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/dashboard');
  };

  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={handleBack}
            style={({ pressed }) => ({
              width: HIT_SIZE,
              height: HIT_SIZE,
              marginLeft: -12,
              alignItems: 'flex-start',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="chevronLeft" size={22} color={c.ink} strokeWidth={2.2} />
          </Pressable>
          <Txt role="screenTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Txt>
          {badge}
        </View>
        {action}
      </View>
      {subtitle ? (
        <Txt role="bodySmall" tone="mut" style={{ marginTop: 4 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

/** The root-tab header: a 24px title with an optional action on the right. */
export function TabHeader({
  title,
  action,
  style,
}: {
  title: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 14,
        },
        style,
      ]}
    >
      <Txt role="tabTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </Txt>
      {action}
    </View>
  );
}

/** Vertical rhythm between cards: the design's 16px section gap. */
export function Stack({
  children,
  gap = 16,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: ViewStyle;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

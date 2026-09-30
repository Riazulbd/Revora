import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { fontFamily, useTheme } from '@/theme';
import { IconSquareButton } from './IconButton';
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
 *  · Padding — the boards' `20px 20px 24px` for tabs and `20px 24px 24px` for
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

/** Horizontal gutters from the boards: tab screens 20px, pushed screens 24px. */
export const SCREEN_GUTTER = { tab: 20, stack: 24 } as const;

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
    paddingHorizontal: SCREEN_GUTTER[variant],
    paddingTop: variant === 'tab' ? 12 : 8,
    paddingBottom:
      (variant === 'tab' ? spacing.tabBarClearance : 24) + bottomInset + (variant === 'tab' ? 0 : insets.bottom),
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
 * The pushed-screen header from the boards: a 44px row pulled 10px left
 * (`margin-left:-10px; gap:8px`) so the 22px back chevron lines up with the
 * content edge, then the `700 20px` title with an optional `500 13px` muted
 * suffix ("Edit fill · 13 Sep"), and a `500 13px / 1.5` muted subtitle 6px under.
 */
export function ScreenHeader({
  title,
  titleSuffix,
  subtitle,
  action,
  onBack,
  badge,
  backTestID,
  style,
}: {
  title: string;
  titleSuffix?: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Defaults to `router.back()`. */
  onBack?: () => void;
  badge?: React.ReactNode;
  backTestID?: string;
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginLeft: -10, height: 44 }}>
          <IconSquareButton
            icon="chevronLeft"
            variant="plain"
            accessibilityLabel="Back"
            onPress={handleBack}
            {...(backTestID === undefined ? {} : { testID: backTestID })}
          />
          <Txt role="screenTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
            {titleSuffix ? (
              <Txt style={{ fontFamily: fontFamily[500], fontSize: 13, color: c.mut }}> {titleSuffix}</Txt>
            ) : null}
          </Txt>
          {badge}
        </View>
        {action}
      </View>
      {subtitle ? (
        <Txt role="body" tone="mut" style={{ marginTop: 6, lineHeight: 19.5 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * The root-tab header: `padding:4px 4px 0`, a `700 24px` title with an
 * optional `500 12px` muted line 2px under it (the Dashboard's bike and
 * date), and on the right either the accent action pill or the 44px icon
 * squares (`gap:8px`).
 */
export function TabHeader({
  title,
  subtitle,
  action,
  style,
  testID,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          alignItems: subtitle ? 'flex-end' : 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingHorizontal: 4,
          paddingTop: 4,
          marginBottom: 16,
        },
        style,
      ]}
    >
      <View style={{ flexShrink: 1 }}>
        <Txt role="tabTitle" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt role="meta" tone="mut" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {action ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>{action}</View> : null}
    </View>
  );
}

/** Vertical rhythm between cards: the boards' 12px within a section, 16px between. */
export function Stack({
  children,
  gap = 12,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: ViewStyle;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/**
 * The `500 11.5px / 1.5` muted footnote under a card or list
 * (`margin:10px 4px 0`) — "Status is recomputed from the current odometer…".
 */
export function Footnote({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <Txt role="helper" tone="mut" style={[{ marginTop: 10, marginHorizontal: 4 }, style]} testID={testID}>
      {children}
    </Txt>
  );
}

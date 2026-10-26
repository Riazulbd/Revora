import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { fontFamily, useTheme } from '@/theme';
import { IconSquareButton } from './IconButton';
import { Txt } from './Text';
import { useTransitioning } from './Transition';

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
 *  · Padding — Figma's `24px 16px 28px` on every frame, so 48 screens share
 *    one rhythm.
 *
 * Root and list screens also get the design's warm wash behind their cards
 * (`linear-gradient(180deg, #FFE6DA 0%, #F8F3F1 30%, #F5F6F8 100%)`); forms
 * and detail screens sit on the flat page colour.
 */

export type ScreenProps = {
  children: React.ReactNode;
  /** `tab` reserves room for the bottom tab bar; `stack` is a pushed screen. */
  variant?: 'tab' | 'stack';
  /** The warm top wash. On by default for tab screens; list screens opt in. */
  wash?: boolean;
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

/** Horizontal gutter: 16px on every Figma frame. */
export const SCREEN_GUTTER = { tab: 16, stack: 16 } as const;

/**
 * The warm wash, pinned behind the scroll view at the height of one screen —
 * the frame height the gradient is drawn over in Figma.
 */
export function PageWash() {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[c.washTop, c.washMid, c.bg]}
      locations={[0, 0.3, 1]}
      style={[StyleSheet.absoluteFill, { height }]}
    />
  );
}

export function Screen({
  children,
  variant = 'stack',
  wash,
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
  const transitioning = useTransitioning();
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
    paddingTop: 24,
    paddingBottom:
      (variant === 'tab' ? spacing.tabBarClearance : 28) + bottomInset + insets.bottom,
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
    <View
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}
      // One texture per frame while a transition runs; see `Transition.tsx`.
      renderToHardwareTextureAndroid={transitioning}
    >
      {(wash ?? variant === 'tab') ? <PageWash /> : null}
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
 * The pushed-screen top bar (Figma `Top bar`): a 48px round back button, the
 * `600 16px` title centred, and on the right an action or a 48px spacer so the
 * title stays centred. Forms close rather than go back (`icon="x"`). An
 * optional `400 13px` muted subtitle sits 12px under the bar.
 */
export function ScreenHeader({
  title,
  titleSuffix,
  titleNote,
  subtitle,
  action,
  onBack,
  icon = 'chevronLeft',
  badge,
  backTestID,
  style,
}: {
  title: string;
  titleSuffix?: string;
  /** A `400 12px` muted line centred under the title, inside the bar ("100 questions a month"). */
  titleNote?: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Defaults to `router.back()`. */
  onBack?: () => void;
  /** The leading glyph: `chevronLeft` for detail screens, `x` for forms. */
  icon?: 'chevronLeft' | 'x';
  badge?: React.ReactNode;
  backTestID?: string;
  style?: ViewStyle;
}) {
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
    <View style={[{ marginBottom: 16 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48 }}>
        <IconSquareButton
          icon={icon}
          accessibilityLabel={icon === 'x' ? 'Close' : 'Back'}
          onPress={handleBack}
          {...(backTestID === undefined ? {} : { testID: backTestID })}
        />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Txt role="screenTitle" numberOfLines={1} align="center" style={{ flexShrink: 1 }}>
              {title}
              {titleSuffix ? <Txt tone="mut" style={{ fontFamily: fontFamily[400], fontSize: 16 }}> {titleSuffix}</Txt> : null}
            </Txt>
            {badge}
          </View>
          {titleNote ? (
            <Txt role="meta" tone="mut" numberOfLines={1} align="center">
              {titleNote}
            </Txt>
          ) : null}
        </View>
        {action ? (
          <View style={{ minWidth: 48, alignItems: 'flex-end' }}>{action}</View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>
      {subtitle ? (
        <Txt role="bodySmall" tone="mut" style={{ marginTop: 12 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * The root-tab header: the `700 28px` title ("Fuel") with an optional
 * `400 13px` muted line under it ("The Red One · All time"), and on the right
 * 48px round buttons or a pill (`gap:8px`).
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
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
        style,
      ]}
    >
      <View style={{ flexShrink: 1 }}>
        <Txt role="tabTitle" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt role="subtitle" tone="mut" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {action ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>{action}</View> : null}
    </View>
  );
}

/** Vertical rhythm between blocks: Figma's `gap:16px` on every frame. */
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

/**
 * The `400 12px` muted footnote under a card (`padding:0 4px`, 8px below it)
 * — "All-in adds the purchase price to every total."
 */
export function Footnote({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <Txt role="helper" tone="mut" style={[{ marginTop: 8, marginHorizontal: 4 }, style]} testID={testID}>
      {children}
    </Txt>
  );
}

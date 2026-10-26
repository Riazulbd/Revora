import React from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, TransitioningProvider, Txt, useTransitionListeners, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useTheme } from '@/theme';

/**
 * The floating tab bar (Figma `Tab bar`): a white pill, `border:1px solid
 * #E9EBEF; border-radius:999px; padding:8px`, 16px in from the screen edges
 * and 12px above the gesture inset (requirement 40). The active tab is a
 * `#14171B` pill (`padding:0 16px; gap:6px; height:48px`) with a white glyph
 * and its `600 13px` label; the others are 56×48 icon-only targets in
 * `#878E98`, named for screen readers.
 *
 * It floats over the scene, so tab screens pad their scroll content to clear
 * it (`spacing.tabBarClearance`).
 */

/**
 * Five tabs, as the Figma redesign draws them. "Expenses" reads "Costs"
 * because riders read Expenses next to Garage and expected receipts, not the
 * running cost of the motorcycle.
 */
const TABS: readonly {
  name: string;
  label: string;
  icon: IconName;
  href: Href;
}[] = [
  {
    name: 'dashboard',
    label: 'Home',
    icon: 'house',
    href: '/(tabs)/dashboard',
  },
  { name: 'fuel', label: 'Fuel', icon: 'fuel', href: '/(tabs)/fuel' },
  {
    name: 'expenses',
    label: 'Costs',
    icon: 'wallet',
    href: '/(tabs)/expenses',
  },
  { name: 'garage', label: 'Garage', icon: 'bike', href: '/(tabs)/garage' },
  { name: 'more', label: 'More', icon: 'menu', href: '/(tabs)/more' },
];

export default function TabsLayout() {
  const { status } = useAuth();
  const { bikes, isPending } = useGarage();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const transition = useTransitionListeners();

  if (status === 'signed_out') return <Redirect href="/(auth)/welcome" />;
  if (!isPending && bikes.length === 0) return <Redirect href="/(onboarding)/add-bike" />;

  return (
    <TransitioningProvider active={transition.active}>
      <Tabs
        screenListeners={transition.listeners}
        screenOptions={{
          headerShown: false,
          // Tabs cross-fade rather than snap; the pill in the bar already slides.
          animation: 'shift',
          sceneStyle: { backgroundColor: c.bg },
        }}
        tabBar={({ state, navigation }) => (
          <View
            testID="tab-bar"
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 12 + insets.bottom,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: c.sur,
              borderWidth: 1,
              borderColor: c.brd,
              borderRadius: 999,
              padding: 8,
            }}
          >
            {TABS.map((tab) => {
              // Matched by name, never by position. The navigator's route order
              // comes from the router, not from TABS, so indexing one list with
              // the other's position silently highlights the wrong tab the
              // moment either list is reordered.
              const index = state.routes.findIndex((route) => route.name === tab.name);
              const focused = index >= 0 && state.index === index;
              return (
                <Pressable
                  key={tab.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={tab.label}
                  testID={`tab-${tab.name}`}
                  onPress={() => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: state.routes[index]?.key ?? '',
                      canPreventDefault: true,
                    });
                    if (!focused && !event.defaultPrevented) {
                      navigation.navigate(state.routes[index]?.name ?? tab.name);
                    }
                  }}
                  style={({ pressed }) => ({
                    height: 48,
                    minWidth: 56,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingHorizontal: focused ? 16 : 0,
                    borderRadius: 999,
                    backgroundColor: focused ? c.ink : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon name={tab.icon} size={20} color={focused ? c.sur : c.faint} />
                  {focused ? (
                    <Txt role="tabLabel" color={c.sur} numberOfLines={1}>
                      {tab.label}
                    </Txt>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      >
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
      </Tabs>
    </TransitioningProvider>
  );
}

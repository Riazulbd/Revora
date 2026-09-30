import React from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Txt, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { fontFamily, useTheme } from '@/theme';

/**
 * The bottom tab bar, transcribed from the Dashboard board's bottom band:
 * `background:var(--sur); border-top:1px solid var(--brd); padding:8px 10px 12px`,
 * each tab `gap:3px; padding:6px 0` with a 20px glyph over a 10.5px label —
 * `700` in `--acc` when active, `500` in `--mut` otherwise.
 *
 * The 12px bottom padding in the design becomes 12px plus the device's own
 * gesture inset, so the labels clear the navigation bar on every Android
 * configuration (requirement 40).
 */

/**
 * Four tabs, in the order the redesign settled on.
 *
 * "More" is gone. Twenty-three identical rows was the weakest screen in the
 * app, and the fifth tab existed only to hold it. What it reached now arrives
 * three ways instead: the Dashboard's attention list brings anything wrong to
 * the rider, search finds the rest by name, and the overflow carries the
 * handful of screens opened a few times in a bike's life.
 *
 * "Expenses" is "Costs" because riders read Expenses next to Garage and
 * expected receipts, not the running cost of the motorcycle.
 */
const TABS: readonly { name: string; label: string; icon: IconName; href: Href }[] = [
  { name: 'dashboard', label: 'Dashboard', icon: 'home', href: '/(tabs)/dashboard' },
  { name: 'fuel', label: 'Fuel', icon: 'fuelPump', href: '/(tabs)/fuel' },
  { name: 'expenses', label: 'Costs', icon: 'wallet', href: '/(tabs)/expenses' },
  { name: 'garage', label: 'Garage', icon: 'garageTab', href: '/(tabs)/garage' },
];

export default function TabsLayout() {
  const { status } = useAuth();
  const { bikes, isPending } = useGarage();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  if (status === 'signed_out') return <Redirect href="/(auth)/welcome" />;
  if (!isPending && bikes.length === 0) return <Redirect href="/(onboarding)/add-bike" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
      tabBar={({ state, navigation }) => (
        <View
          testID="tab-bar"
          style={{
            flexDirection: 'row',
            backgroundColor: c.sur,
            borderTopWidth: 1,
            borderTopColor: c.brd,
            paddingTop: 8,
            paddingHorizontal: 10,
            paddingBottom: 12 + insets.bottom,
          }}
        >
          {TABS.map((tab) => {
            // Matched by name, never by position. The navigator's route order
            // comes from the router, not from TABS, so indexing one list with
            // the other's position silently highlights the wrong tab the
            // moment either list is reordered — which is exactly what
            // happened when the fifth tab was retired.
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
                  flex: 1,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  paddingVertical: 6,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon name={tab.icon} size={20} color={focused ? c.acc : c.mut} strokeWidth={focused ? 2 : 1.8} />
                <Txt
                  numberOfLines={1}
                  style={{ fontFamily: fontFamily[focused ? 700 : 500], fontSize: 10.5, color: focused ? c.acc : c.mut }}
                >
                  {tab.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {/* Still registered so an existing deep link into it resolves. */}
      <Tabs.Screen name="more" options={{ title: 'More', href: null }} />
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

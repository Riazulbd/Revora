import React from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Txt, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useTheme } from '@/theme';

/**
 * The bottom tab bar, transcribed from the design:
 * `background:var(--sur); border-top:1px solid var(--brd); padding:6px 8px 18px`,
 * a 22px icon over a 10px bold label, active in `--acc` and inactive in `--mut`.
 *
 * The 18px bottom padding in the design becomes 18px plus the device's own
 * gesture inset, so the labels clear the navigation bar on every Android
 * configuration (requirement 40).
 */

const TABS: readonly { name: string; label: string; icon: IconName; href: Href }[] = [
  { name: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/(tabs)/dashboard' },
  { name: 'fuel', label: 'Fuel', icon: 'fuelTab', href: '/(tabs)/fuel' },
  { name: 'garage', label: 'Garage', icon: 'garage', href: '/(tabs)/garage' },
  { name: 'expenses', label: 'Expenses', icon: 'expenses', href: '/(tabs)/expenses' },
  { name: 'more', label: 'More', icon: 'more', href: '/(tabs)/more' },
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
          style={{
            flexDirection: 'row',
            backgroundColor: c.sur,
            borderTopWidth: 1,
            borderTopColor: c.brd,
            paddingTop: 6,
            paddingHorizontal: 8,
            paddingBottom: 18 + insets.bottom,
          }}
        >
          {TABS.map((tab, index) => {
            const focused = state.index === index;
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
                <Icon name={tab.icon} size={22} color={focused ? c.acc : c.mut} strokeWidth={1.9} />
                <Txt role="tabLabel" color={focused ? c.acc : c.mut}>
                  {tab.label}
                </Txt>
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
  );
}

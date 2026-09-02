import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Icon, Logo, Screen, Txt, type IconName } from '@/components';
import { useTheme } from '@/theme';

/**
 * Welcome — the approved first screen.
 *
 * Layout is the design's: the lockup centred in a flexed column, three benefit
 * rows with 30px accent-soft icon plates, then the two 52px actions pinned to the
 * bottom with the reassurance line beneath.
 */
const BENEFITS: readonly { icon: IconName; label: string }[] = [
  { icon: 'fuel', label: 'Accurate km/L from real fill-ups' },
  { icon: 'wrench', label: 'Never miss a service interval' },
  { icon: 'shield', label: "Prove your bike's history at resale" },
];

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <Screen
      contentStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}
      testID="screen-welcome"
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
        <Logo width={230} style={{ alignSelf: 'center' }} />

        <View style={{ gap: 8 }}>
          <Txt role="heroLine">Know your bike.</Txt>
          <Txt role="subtitle" tone="mut" style={{ lineHeight: 21 }}>
            Fuel, mileage, maintenance and every taka your motorcycle costs — tracked properly, and it keeps
            working with no signal.
          </Txt>
        </View>

        <View style={{ gap: 12 }}>
          {BENEFITS.map((benefit) => (
            <View key={benefit.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  backgroundColor: c.accS,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={benefit.icon} size={15} color={c.acc} strokeWidth={2.2} />
              </View>
              <Txt role="bullet" style={{ flex: 1 }}>
                {benefit.label}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Button label="Create account" onPress={() => router.push('/(auth)/signup')} testID="cta-signup" />
        <Button
          label="Sign in"
          variant="secondary"
          onPress={() => router.push('/(auth)/signin')}
          testID="cta-signin"
        />
        <Txt role="metaSmall" tone="mut" align="center" style={{ marginTop: 2 }}>
          Works fully offline. Everything syncs to your account when you reconnect.
        </Txt>
      </View>
    </Screen>
  );
}

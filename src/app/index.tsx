import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useTheme } from '@/theme';

/**
 * The routing gate.
 *
 * Three states, in order:
 *  · restoring — the previous session is still being read from the keystore, so
 *    hold rather than flashing the welcome screen at a signed-in rider;
 *  · signed out — Welcome;
 *  · signed in with no motorcycle — onboarding;
 *  · signed in with a motorcycle — Dashboard.
 */
export default function Index() {
  const { status } = useAuth();
  const { bikes, isPending } = useGarage();
  const { c } = useTheme();

  if (status === 'restoring') return <Holding color={c.acc} background={c.bg} />;
  if (status === 'signed_out') return <Redirect href="/(auth)/welcome" />;
  if (isPending) return <Holding color={c.acc} background={c.bg} />;
  if (bikes.length === 0) return <Redirect href="/(onboarding)/add-bike" />;
  return <Redirect href="/(tabs)/dashboard" />;
}

function Holding({ color, background }: { color: string; background: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={color} />
    </View>
  );
}

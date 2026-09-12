import React from 'react';
import { Redirect } from 'expo-router';

import { Splash } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';

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

  if (status === 'restoring') return <Splash />;
  if (status === 'signed_out') return <Redirect href="/(auth)/welcome" />;
  if (isPending) return <Splash />;
  if (bikes.length === 0) return <Redirect href="/(onboarding)/add-bike" />;
  return <Redirect href="/(tabs)/dashboard" />;
}

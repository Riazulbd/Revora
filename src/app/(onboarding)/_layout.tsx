import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme';

/** Onboarding requires a session — it is where the first motorcycle is added. */
export default function OnboardingLayout() {
  const { status } = useAuth();
  const { c } = useTheme();

  if (status === 'signed_out') return <Redirect href="/(auth)/welcome" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}

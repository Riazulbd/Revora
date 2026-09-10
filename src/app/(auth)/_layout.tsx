import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { StatusBar } from 'expo-status-bar';

import { useAuth } from '@/features/auth/AuthProvider';
import { ForceDarkTheme, useTheme } from '@/theme';

/**
 * Auth screens are unreachable once a session exists, and are always dark.
 *
 * The lockup on the welcome screen is artwork on a black field, so these
 * screens do not follow the system theme — see `ForceDarkTheme`.
 */
export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'signed_in') return <Redirect href="/" />;

  return (
    <ForceDarkTheme>
      <StatusBar style="light" />
      <AuthStack />
    </ForceDarkTheme>
  );
}

function AuthStack() {
  const { c } = useTheme();
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

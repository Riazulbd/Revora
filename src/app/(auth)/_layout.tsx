import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme';

/**
 * Auth screens are unreachable once a session exists.
 *
 * They used to be pinned to the dark palette, because the old lockup was
 * artwork on a black field. The redesign draws every entry screen in both
 * palettes — the dark Welcome board seats the mark on a light plate instead —
 * so these screens follow the theme like the rest of the app.
 */
export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'signed_in') return <Redirect href="/" />;

  return <AuthStack />;
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

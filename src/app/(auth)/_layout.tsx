import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme';

/** Auth screens are unreachable once a session exists. */
export default function AuthLayout() {
  const { status } = useAuth();
  const { c } = useTheme();

  if (status === 'signed_in') return <Redirect href="/" />;

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

import React from 'react';
import { useRouter } from 'expo-router';

import { EmptyState, Screen, ScreenHeader } from '@/components';

export default function NotFound() {
  const router = useRouter();

  return (
    <Screen testID="screen-not-found">
      <ScreenHeader title="" onBack={() => router.replace('/')} />
      <EmptyState
        icon="alert"
        title="That screen doesn't exist"
        message="The link you followed goes nowhere in this version of Revora."
        primaryAction={{ label: 'Back to dashboard', onPress: () => router.replace('/') }}
        variant="page"
      />
    </Screen>
  );
}

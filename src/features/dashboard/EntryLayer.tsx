import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, IconSquareButton } from '@/components';

/**
 * The Dashboard's entry points: the notification bell in the header, and the
 * action row under the hero.
 *
 * The row is chosen by the conditions each screen is used in, not by
 * importance. Add fuel is the most-used action in the app, so it is the wide
 * primary pill. Fast Capture is opened standing at a pump with gloves on; the
 * document vault at a traffic stop, one-handed, on whatever signal is left —
 * both are a single tap from here. Everything else is a tab away in More, or
 * arrives by itself in the attention list.
 */

/**
 * The 48px bell. Its dot tracks the same list the attention card renders, so
 * the two can never disagree — a bell lit above an empty card is the kind of
 * thing that makes a rider stop believing both.
 */
export function AttentionBell({ count }: { count: number }) {
  const router = useRouter();

  return (
    <IconSquareButton
      icon="bell"
      count={count}
      accessibilityLabel={count === 0 ? 'Notifications, nothing pending' : 'Notifications'}
      onPress={() => router.push('/notifications')}
      testID="cta-notifications"
    />
  );
}

/**
 * Figma `Actions`: the `#D2400F` "Add fuel" pill filling the row (56px), then
 * two 56px round buttons — Scan (Fast Capture) and Docs (the vault). Docs grows
 * the red dot when a document expires inside 30 days, the one case where the
 * vault is worth opening before anything else on the screen.
 *
 * `variant="degraded"` is the load-error state: Add fuel is dropped, leaving
 * the two screens that still work without the server.
 */
export function DashboardActions({
  documentsExpiring = false,
  variant = 'default',
}: {
  documentsExpiring?: boolean;
  variant?: 'default' | 'degraded';
}) {
  const router = useRouter();

  if (variant === 'degraded') {
    return (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          label="Fast Capture"
          icon="camera"
          variant="secondary"
          size="xlarge"
          flex
          onPress={() => router.push('/capture')}
          testID="quick-capture"
        />
        <Button
          label="Documents"
          icon="fileText"
          variant="secondary"
          size="xlarge"
          flex
          onPress={() => router.push('/records/vault')}
          testID="quick-documents"
        />
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Button
        label="Add fuel"
        icon="fuel"
        size="xlarge"
        flex
        onPress={() => router.push('/fuel/add')}
        testID="quick-add-fuel"
      />
      <IconSquareButton
        icon="camera"
        size={56}
        accessibilityLabel="Fast Capture"
        onPress={() => router.push('/capture')}
        testID="quick-capture"
      />
      <IconSquareButton
        icon="file"
        size={56}
        count={documentsExpiring ? 1 : 0}
        accessibilityLabel={documentsExpiring ? 'Documents, one expires within 30 days' : 'Documents'}
        onPress={() => router.push('/records/vault')}
        testID="quick-documents"
      />
    </View>
  );
}

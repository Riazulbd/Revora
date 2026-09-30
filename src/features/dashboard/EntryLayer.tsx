import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { ActionTile, ActionTileRow, IconSquareButton, SearchBar } from '@/components';

/**
 * The band above the Dashboard: a notification bell, an overflow, a search
 * field, and the destinations that have to be reachable in one tap.
 *
 * Those are not chosen by importance. They are chosen by the conditions they
 * are used in. Fast Capture is opened standing at a pump with gloves on; the
 * document vault is opened at a traffic stop, one-handed, on whatever signal is
 * left. Both were three taps deep behind a menu, which is a reasonable depth
 * for a screen you browse to and the wrong depth for one you need right now.
 * Add fuel is here because it is simply the most-used action in the app.
 *
 * Everything else the old fifth tab reached is found through search or arrives
 * by itself in the attention list.
 */

/**
 * The 44px rounded square with the board's red count badge. The badge counts
 * the same list the attention card renders, so the two can never disagree — a
 * bell reading 3 above an empty card is the kind of thing that makes a rider
 * stop believing both.
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

/** The ⋮ square. Four rows live behind it, opened a few times a year. */
export function OverflowButton({ onPress }: { onPress: () => void }) {
  return (
    <IconSquareButton
      icon="dotsVertical"
      accessibilityLabel="More"
      onPress={onPress}
      testID="cta-overflow"
    />
  );
}

/**
 * Not a text input. Tapping it opens the search screen, where the real field
 * lives — a live input here would need the Dashboard to hold search state it
 * has no other use for, and would put a keyboard over the odometer.
 */
export function DashboardSearchBar() {
  const router = useRouter();
  return <SearchBar onPress={() => router.push('/search')} testID="cta-search" />;
}

/**
 * The three tiles. Documents turns accent and grows an amber dot when a
 * document expires inside 30 days — the one case where the vault is worth
 * opening before anything else on the screen.
 *
 * `variant="degraded"` is the load-error board: only the two glove-and-signal
 * screens, because they are the two that still work without the server.
 */
export function QuickTiles({
  documentsExpiring = false,
  variant = 'default',
}: {
  documentsExpiring?: boolean;
  variant?: 'default' | 'degraded';
}) {
  const router = useRouter();

  return (
    <ActionTileRow>
      <ActionTile
        label="Fast Capture"
        icon="camera"
        emphasis="solid"
        onPress={() => router.push('/capture')}
        testID="quick-capture"
      />
      <ActionTile
        label="Documents"
        icon="documents"
        emphasis={documentsExpiring ? 'accent' : 'default'}
        dot={documentsExpiring}
        {...(documentsExpiring ? { accessibilityHint: 'A document expires within 30 days' } : {})}
        onPress={() => router.push('/records/vault')}
        testID="quick-documents"
      />
      {variant === 'degraded' ? null : (
        <ActionTile
          label="Add fuel"
          icon="fuelPump"
          onPress={() => router.push('/fuel/add')}
          testID="quick-add-fuel"
        />
      )}
    </ActionTileRow>
  );
}

/** Bell and overflow together, in the tab header's action slot. */
export function EntryActions({ count, onOverflow }: { count: number; onOverflow: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <AttentionBell count={count} />
      <OverflowButton onPress={onOverflow} />
    </View>
  );
}

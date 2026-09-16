import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon, Txt, type IconName } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * The band above the Dashboard: a notification bell, an overflow, a search
 * field, and three destinations that have to be reachable in one tap.
 *
 * Those three are not chosen by importance. They are chosen by the conditions
 * they are used in. Fast Capture is opened standing at a pump with gloves on;
 * the document vault is opened at a traffic stop, one-handed, on whatever
 * signal is left. Both were three taps deep behind a menu, which is a
 * reasonable depth for a screen you browse to and the wrong depth for one you
 * need right now. Add fuel is here because it is simply the most-used action in
 * the app.
 *
 * Everything else the old fifth tab reached is found through search or arrives
 * by itself in the attention list.
 */
export function AttentionBell({ count }: { count: number }) {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        count === 0 ? 'Notifications, nothing pending' : `Notifications, ${count} needing attention`
      }
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      style={({ pressed }) => ({
        width: HIT_SIZE - 4,
        height: HIT_SIZE - 4,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
      testID="cta-notifications"
    >
      <Icon name="bell" size={20} color={c.ink} strokeWidth={2} />
      {/* The badge counts the same list the attention card renders, so the two
          can never disagree — a bell reading 3 above an empty card is the kind
          of thing that makes a rider stop believing both. */}
      {count > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 17,
            height: 17,
            paddingHorizontal: 4,
            borderRadius: 999,
            backgroundColor: c.acc,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: c.bg,
          }}
        >
          <Txt role="pro" style={{ color: '#FFFFFF' }} numberOfLines={1}>
            {count > 9 ? '9+' : String(count)}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

export function OverflowButton({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="More"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: HIT_SIZE - 4,
        height: HIT_SIZE - 4,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
      testID="cta-overflow"
    >
      <View style={{ gap: 3, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 3.5, height: 3.5, borderRadius: 999, backgroundColor: c.ink }} />
        ))}
      </View>
    </Pressable>
  );
}

/**
 * Not a text input. Tapping it opens the search screen, where the real field
 * lives — a live input here would need the Dashboard to hold search state it
 * has no other use for, and would put a keyboard over the odometer.
 */
export function SearchBar() {
  const router = useRouter();
  const { c, radius } = useTheme();

  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel="Search records, documents and workshops"
      onPress={() => router.push('/search')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        minHeight: HIT_SIZE,
        paddingHorizontal: 14,
        borderRadius: radius.input,
        backgroundColor: pressed ? c.sur2 : c.sur,
        borderWidth: 1,
        borderColor: c.brd,
      })}
      testID="cta-search"
    >
      <Icon name="search" size={16} color={c.mut} strokeWidth={2} />
      <Txt role="input" tone="mut" numberOfLines={1}>
        Search records, documents, workshops…
      </Txt>
    </Pressable>
  );
}

export function QuickTiles() {
  const router = useRouter();
  const { c, radius } = useTheme();

  const tiles: { label: string; icon: IconName; route: string; testID: string }[] = [
    { label: 'Fast Capture', icon: 'camera', route: '/capture', testID: 'quick-capture' },
    { label: 'Documents', icon: 'document', route: '/records/vault', testID: 'quick-documents' },
    { label: 'Add fuel', icon: 'fuel', route: '/fuel/add', testID: 'quick-add-fuel' },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {tiles.map((tile) => (
        <Pressable
          key={tile.route}
          accessibilityRole="button"
          accessibilityLabel={tile.label}
          onPress={() => router.push(tile.route as never)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 62,
            gap: 6,
            paddingVertical: 11,
            paddingHorizontal: 10,
            borderRadius: radius.input,
            backgroundColor: pressed ? c.sur2 : c.sur,
            borderWidth: 1,
            borderColor: c.brd,
            alignItems: 'flex-start',
            justifyContent: 'center',
          })}
          testID={tile.testID}
        >
          <Icon name={tile.icon} size={17} color={c.acc} strokeWidth={2} />
          <Txt role="micro" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {tile.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

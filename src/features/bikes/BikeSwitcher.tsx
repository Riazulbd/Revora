import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Divider, Icon, ProBadge, Sheet, Txt } from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useTheme } from '@/theme';

/**
 * The bike switcher pill and its sheet, from the design's `switcher` sheet.
 *
 * Selecting a bike writes the choice to the profile document; every screen reads
 * the active bike from that one place, so the whole app changes together and
 * nothing is left showing the previous motorcycle (requirement 11).
 */
export function BikeSwitcherButton({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  const { activeBike } = useGarage();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch motorcycle. Current: ${activeBike?.nickname ?? 'none'}`}
      onPress={onPress}
      testID="bike-switcher"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingLeft: 12,
        paddingRight: 14,
        borderWidth: 1,
        borderColor: c.brd,
        borderRadius: 22,
        backgroundColor: c.sur,
        maxWidth: 220,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.acc }} />
      <Txt role="rowTitleDense" numberOfLines={1} style={{ flexShrink: 1 }}>
        {activeBike?.nickname ?? 'Add a bike'}
      </Txt>
      <Icon name="chevronDown" size={14} color={c.ink} strokeWidth={2.4} />
    </Pressable>
  );
}

export function BikeSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c, radius } = useTheme();
  const router = useRouter();
  const { bikes, activeBikeId, setActiveBike, isPro } = useGarage();

  return (
    <Sheet visible={visible} onClose={onClose} title="Your garage" testID="sheet-switcher">
      <View style={{ gap: 4 }}>
        {bikes.map((bike) => {
          const active = bike.id === activeBikeId;
          return (
            <Pressable
              key={bike.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={async () => {
                await setActiveBike(bike.id);
                onClose();
              }}
              testID={`switch-bike-${bike.id}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 60,
                paddingHorizontal: 14,
                borderRadius: radius.listCard,
                backgroundColor: active ? c.accS : 'transparent',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: active ? c.acc : c.brd,
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt role="rowTitle">{bike.nickname}</Txt>
                <Txt role="metaSmall" tone="mut" numberOfLines={1}>
                  {[bike.model, bike.year ? String(bike.year) : null].filter(Boolean).join(' · ') ||
                    'Tap to select'}
                </Txt>
              </View>
              {active ? <Icon name="check" size={18} color={c.acc} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Divider />

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onClose();
          if (isPro) router.push('/(onboarding)/add-bike');
          else router.push('/plan');
        }}
        testID="switcher-add-bike"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 60,
          paddingHorizontal: 14,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon name="plus" size={18} color={c.mut} strokeWidth={2.4} />
        <Txt role="rowTitle" style={{ flex: 1 }}>
          Add motorcycle
        </Txt>
        {isPro ? null : <ProBadge />}
      </Pressable>

      {!isPro && bikes.length >= 1 ? (
        <Txt role="helper" tone="mut" style={{ paddingHorizontal: 14, paddingTop: 4 }}>
          The Free plan tracks one motorcycle with full history.
        </Txt>
      ) : null}
    </Sheet>
  );
}

/** Small helper so a screen only needs one line of state for the sheet. */
export function useBikeSwitcher() {
  const [visible, setVisible] = useState(false);
  return {
    visible,
    open: () => setVisible(true),
    close: () => setVisible(false),
  };
}

import React, { useEffect } from 'react';
import { BackHandler, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Badge, Divider, Icon, ProBadge, Txt, type IconName } from '@/components';
import { ASSISTANT_COMING_SOON, COMING_SOON_LABEL } from '@/features/premium/comingSoon';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * The rare destinations, behind the ⋮ in the Dashboard header.
 *
 * The board draws a 240px card pinned under the button rather than a bottom
 * sheet, and the difference is not decoration: four rows opened a few times a
 * year should not take over the screen, and landing beside the control that
 * opened it keeps the rider's place on the Dashboard.
 *
 * Rendered in a `Modal`, so Android's back gesture closes the menu rather than
 * navigating away underneath it (requirement 41).
 */

type Row = {
  label: string;
  icon?: IconName;
  leading?: React.ReactNode;
  route: string;
  testID: string;
};

export function OverflowMenu({
  visible,
  onClose,
  isPro,
}: {
  visible: boolean;
  onClose: () => void;
  isPro: boolean;
}) {
  const router = useRouter();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  // The board's `9.5px / 0.57px / padding:2px 7px` marker.
  const proPill = <ProBadge small />;

  const rows: Row[] = [
    { label: 'Settings', icon: 'settings', route: '/settings', testID: 'overflow-settings' },
    { label: 'Your plan', leading: proPill, route: '/plan', testID: 'overflow-plan' },
    // Both live only here: the fifth tab that used to reach them is gone.
    {
      label: 'Assistant',
      icon: 'sparkle',
      route: '/assistant',
      testID: 'overflow-assistant',
      // A feature that is announced but not yet usable says so here rather
      // than letting a rider tap through and find out.
      ...(ASSISTANT_COMING_SOON
        ? { leading: <Badge label={COMING_SOON_LABEL} tone="neutral" size="chip" /> }
        : isPro
          ? {}
          : { leading: proPill }),
    },
    { label: 'Analytics', icon: 'odometer', route: '/analytics', testID: 'overflow-analytics' },
    { label: 'Feedback & support', icon: 'send', route: '/feedback', testID: 'overflow-feedback' },
    { label: 'Privacy & terms', icon: 'file', route: '/legal/privacy', testID: 'overflow-legal' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }} testID="sheet-overflow">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }}
        />
        <View
          style={{
            position: 'absolute',
            top: insets.top + 64,
            right: 16,
            width: 240,
            backgroundColor: c.sur,
            borderWidth: 1,
            borderColor: c.brd,
            borderRadius: radius.listCard,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 48,
            shadowOffset: { width: 0, height: 16 },
            elevation: 24,
          }}
        >
          {rows.map((row, index) => (
            <View key={row.testID}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={row.label}
                onPress={() => {
                  onClose();
                  router.push(row.route as never);
                }}
                testID={row.testID}
                style={({ pressed }) => ({
                  height: Math.max(50, HIT_SIZE),
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  backgroundColor: pressed ? c.sur2 : 'transparent',
                })}
              >
                {row.leading ?? (row.icon ? <Icon name={row.icon} size={17} color={c.mut} strokeWidth={1.8} /> : null)}
                <Txt
                  numberOfLines={1}
                  style={{ fontFamily: fontFamily[600], fontSize: 13.5, color: c.ink, flexShrink: 1 }}
                >
                  {row.label}
                </Txt>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

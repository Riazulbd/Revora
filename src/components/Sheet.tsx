import React, { useEffect } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Txt } from './Text';

/**
 * The bottom sheet from the Garage "Pro upgrade" and Maintenance "completion"
 * boards: `border-radius:22px 22px 0 0; padding:12px 24px 24px` over the scrim,
 * a `36×4` grab handle (`margin:0 auto 18px`), a `700 20px` title and a
 * `500 13px / 1.5` muted subtitle 6px under it. The Maintenance completion
 * sheet sets its subtitle a size smaller and tighter (`500 12px`, 4px under) —
 * that is `subtitleSize="small"`.
 *
 * Rendered in a `Modal`, so Android's back gesture closes the sheet rather than
 * navigating away underneath it (requirement 41).
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  subtitleSize = 'default',
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** `small` is the completion sheet's `500 12px`, 4px under the title. */
  subtitleSize?: 'default' | 'small';
  children: React.ReactNode;
  testID?: string;
}) {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }} testID={testID}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }}
        />
        <View
          style={{
            backgroundColor: c.sur,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingTop: 12,
            paddingHorizontal: 24,
            paddingBottom: 24 + insets.bottom,
            maxHeight: '88%',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: -12 },
            elevation: 24,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.brd,
              alignSelf: 'center',
              marginBottom: 18,
            }}
          />
          {title ? (
            <Txt role="screenTitle" style={{ marginBottom: subtitle ? 0 : 16 }}>
              {title}
            </Txt>
          ) : null}
          {subtitle ? (
            <Txt
              role={subtitleSize === 'small' ? 'meta' : 'body'}
              tone="mut"
              style={
                subtitleSize === 'small'
                  ? { marginTop: 4, marginBottom: 16 }
                  : { marginTop: 6, marginBottom: 16, lineHeight: 19.5 }
              }
            >
              {subtitle}
            </Txt>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

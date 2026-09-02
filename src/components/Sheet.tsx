import React, { useEffect } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Txt } from './Text';

/**
 * The bottom sheet:
 * `border-radius:22px 22px 0 0; padding:10px 20px 28px` over a `--scrim` backdrop,
 * with the design's 40×4 grab handle.
 *
 * Rendered in a `Modal`, so Android's back gesture closes the sheet rather than
 * navigating away underneath it (requirement 41).
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
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
            paddingTop: 10,
            paddingHorizontal: 20,
            paddingBottom: 28 + insets.bottom,
            maxHeight: '85%',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: -10 },
            elevation: 24,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.brd,
              alignSelf: 'center',
              marginBottom: 14,
            }}
          />
          {title ? (
            <Txt role="cardTitle" style={{ marginBottom: 14 }}>
              {title}
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

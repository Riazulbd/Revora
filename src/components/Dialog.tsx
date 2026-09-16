import React, { useEffect } from 'react';
import { BackHandler, Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button, ButtonRow } from './Button';
import { Txt } from './Text';

/**
 * The centred confirmation dialog:
 * `left:24; right:24; border-radius:20px; padding:22px 20px` over the scrim.
 *
 * Android back closes the dialog and goes no further, so a confirm step can
 * never bounce the rider out of a nested flow (requirement 41).
 */
export function Dialog({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
  busy = false,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => unknown;
  destructive?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  const { c, radius } = useTheme();

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose, busy]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'center' }} testID={testID}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={busy ? undefined : onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }}
        />
        <View
          accessibilityViewIsModal
          style={{
            marginHorizontal: 24,
            backgroundColor: c.sur,
            borderRadius: radius.dialog,
            paddingHorizontal: 20,
            paddingVertical: 22,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 60,
            shadowOffset: { width: 0, height: 20 },
            elevation: 24,
          }}
        >
          <Txt role="dialogTitle" style={{ marginBottom: 8 }}>
            {title}
          </Txt>
          <Txt role="body" tone="mut" style={{ marginBottom: 16 }}>
            {message}
          </Txt>
          <ButtonRow>
            <Button
              label={cancelLabel}
              variant="secondary"
              size="medium"
              onPress={onClose}
              disabled={busy}
              style={{ flex: 1, height: 48, borderRadius: 12 }}
              testID={testID === undefined ? undefined : `${testID}-cancel`}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              size="medium"
              onPress={onConfirm}
              loading={busy}
              style={{ flex: 1, height: 48, borderRadius: 12 }}
              testID={testID === undefined ? undefined : `${testID}-confirm`}
            />
          </ButtonRow>
        </View>
      </View>
    </Modal>
  );
}

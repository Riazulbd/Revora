import React, { useEffect } from 'react';
import { BackHandler, Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button, ButtonRow } from './Button';
import { Txt } from './Text';

/**
 * The centred confirmation dialog from the Parts boards ("Remove tail box?",
 * "Move to accessories?"): `left:20; right:20; border-radius:20px; padding:20px`
 * over the scrim, a `700 17px` title, a `500 13px / 1.55` muted message 8px
 * under it, then two 48px buttons 16px below — the confirming action first
 * (`--bad` for a destructive one, `--acc` otherwise) and the keep/cancel
 * action beside it on `--sur2`.
 *
 * Android back closes the dialog and goes no further, so a confirm step can
 * never bounce the rider out of a nested flow (requirement 41).
 */
export function Dialog({
  visible,
  onClose,
  title,
  message,
  children,
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
  /** Extra content between the message and the buttons — the "discarded" bullet list. */
  children?: React.ReactNode;
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
            marginHorizontal: 20,
            backgroundColor: c.sur,
            borderWidth: 1,
            borderColor: c.brd,
            borderRadius: radius.dialog,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 48,
            shadowOffset: { width: 0, height: 16 },
            elevation: 24,
          }}
        >
          <Txt role="cardTitle">{title}</Txt>
          <Txt role="body" tone="mut" style={{ marginTop: 8, lineHeight: 20 }}>
            {message}
          </Txt>
          {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
          <ButtonRow style={{ marginTop: 16 }}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              size="medium"
              flex
              onPress={onConfirm}
              loading={busy}
              testID={testID === undefined ? undefined : `${testID}-confirm`}
            />
            <Button
              label={cancelLabel}
              variant="subtle"
              size="medium"
              flex
              onPress={onClose}
              disabled={busy}
              testID={testID === undefined ? undefined : `${testID}-cancel`}
            />
          </ButtonRow>
        </View>
      </View>
    </Modal>
  );
}

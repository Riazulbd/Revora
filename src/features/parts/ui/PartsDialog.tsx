import React, { useEffect } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button, ButtonRow, Txt } from '@/components';
import { useTheme } from '@/theme';

/**
 * The two conversion dialogs on the Parts boards.
 *
 * They share the shared `Dialog`'s chrome exactly — `left:20; right:20;
 * border-radius:20px; padding:20px` over the scrim, a `700 17px` title, two
 * 48px buttons 16–18px under the body — but their body is not one muted
 * sentence. "Move to accessories?" lists, in the rider's words and with their
 * own figures, each thing the move throws away; "Make this a part?" asks for
 * the one reading a part cannot exist without. Neither fits a `message`
 * string, so the body is a slot.
 *
 * Android back closes the dialog and goes no further, so agreeing to a
 * conversion can never bounce the rider out of the editor behind it.
 */
export function PartsDialog({
  visible,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmDisabled = false,
  busy = false,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The body: the board's bullet list, or its required field. */
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => unknown;
  confirmDisabled?: boolean;
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12 }}
          >
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
              {children}
              <ButtonRow style={{ marginTop: 16 }}>
                <Button
                  label={confirmLabel}
                  size="medium"
                  flex
                  disabled={confirmDisabled}
                  loading={busy}
                  onPress={onConfirm}
                  testID={testID === undefined ? undefined : `${testID}-confirm`}
                />
                <Button
                  label={cancelLabel}
                  variant="subtle"
                  size="medium"
                  flex
                  disabled={busy}
                  onPress={onClose}
                  testID={testID === undefined ? undefined : `${testID}-cancel`}
                />
              </ButtonRow>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

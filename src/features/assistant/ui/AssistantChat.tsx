import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { HIT_SIZE, MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';

/**
 * The Assistant conversation (Figma `E4b More — Assistant (conversation)`).
 *
 * The rider's question is an ink bubble squared off at the bottom-right
 * (`border-radius:20px 20px 6px 20px`, `500 14px` white); the answer is a
 * white bubble squared off at the bottom-left, with the provenance line under
 * a hairline inside it — because an answer that quotes a figure has to say
 * which calculation it read it from.
 */

export type ChatRole = 'user' | 'assistant';

export function ChatBubble({
  role,
  text,
  source,
  testID,
}: {
  role: ChatRole;
  text: string;
  /** The `400 12px` muted provenance line inside an answer bubble. */
  source?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const mine = role === 'user';

  return (
    <View
      testID={testID}
      accessibilityLabel={`${mine ? 'You asked' : 'Assistant answered'}: ${text}`}
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: mine ? '80%' : '85%',
        backgroundColor: mine ? c.ink : c.sur,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomRightRadius: mine ? 6 : 20,
        borderBottomLeftRadius: mine ? 20 : 6,
        paddingHorizontal: 14,
        paddingVertical: mine ? 10 : 14,
        gap: 10,
      }}
    >
      <Txt role={mine ? 'bullet' : 'body'} color={mine ? c.sur : c.ink}>
        {text}
      </Txt>
      {source ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.div }}>
          <Icon name="info" size={16} color={c.mut} />
          <Txt role="meta" tone="mut" style={{ flex: 1 }}>
            {source}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Figma `Suggestion` under TRY ASKING: a 56px white pill-cornered row,
 * `padding:0 14px 0 16px`, the `500 14px` question and an accent arrow.
 */
export function SuggestionRow({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Asks the assistant this question"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: 18,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 16,
        paddingRight: 14,
        paddingVertical: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt role="bullet" numberOfLines={2} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Icon name="arrowUpRight" size={20} color={c.accBright} />
    </Pressable>
  );
}

/**
 * Figma `Composer`: a 60px white pill (`padding:0 6px 0 20px`) holding the
 * `400 15px` field and a 48px accent disc with an up arrow.
 */
export function AssistantComposer({
  value,
  onChangeText,
  onSend,
  busy = false,
  inputTestID,
  sendTestID,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSend: () => void;
  busy?: boolean;
  inputTestID: string;
  sendTestID: string;
}) {
  const { c, dark } = useTheme();

  return (
    <View
      style={{
        height: 60,
        borderRadius: 999,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 20,
        paddingRight: 6,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Ask about your bike…"
        placeholderTextColor={c.faint}
        selectionColor={c.acc}
        cursorColor={c.acc}
        returnKeyType="send"
        onSubmitEditing={onSend}
        editable={!busy}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityLabel="Ask about your bike"
        testID={inputTestID}
        style={{ flex: 1, minWidth: 0, height: '100%', paddingVertical: 0, fontFamily: fontFamily[400], fontSize: 15, color: c.ink }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send question"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onSend}
        testID={sendTestID}
        style={({ pressed }) => ({
          width: HIT_SIZE,
          height: HIT_SIZE,
          borderRadius: HIT_SIZE / 2,
          backgroundColor: c.acc,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.55 : pressed ? 0.85 : 1,
        })}
      >
        <Icon name="arrowUp" size={22} color={dark ? c.bg : '#FFFFFF'} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

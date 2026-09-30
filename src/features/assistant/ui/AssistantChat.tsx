import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Input, Txt } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';

/**
 * The Assistant conversation, drawn from the redesign's two dark boards.
 *
 * The rider's question is an accent bubble squared off at the bottom-right; the
 * answer is a bordered surface bubble squared off at the bottom-left, with the
 * provenance line under it in 11px muted — because an answer that quotes a
 * figure has to say which calculation it read it from.
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
  /** The `500 11px` muted provenance line inside an answer bubble. */
  source?: string;
  testID?: string;
}) {
  const { c, dark } = useTheme();
  const mine = role === 'user';

  return (
    <View
      testID={testID}
      accessibilityLabel={`${mine ? 'You asked' : 'Assistant answered'}: ${text}`}
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: mine ? '80%' : '88%',
        backgroundColor: mine ? c.acc : c.sur,
        borderWidth: mine ? 0 : 1,
        borderColor: c.brd,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: mine ? 4 : 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        paddingHorizontal: 14,
        paddingVertical: mine ? 12 : 14,
      }}
    >
      <Txt
        role="body"
        color={mine ? (dark ? c.bg : '#FFFFFF') : c.ink}
        style={mine ? { lineHeight: 19.5 } : undefined}
      >
        {text}
      </Txt>
      {source ? (
        <Txt role="micro" tone="mut" style={{ marginTop: 10 }}>
          {source}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * A "Try asking" row: `height:44px; border-radius:11px; background:var(--sur);
 * border:1px solid var(--brd); padding:0 14px; font:600 13px`.
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
  const { c, radius } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Asks the assistant this question"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        height: HIT_SIZE,
        borderRadius: radius.tile,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        justifyContent: 'center',
        paddingHorizontal: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt role="bullet" numberOfLines={2}>
        {label}
      </Txt>
    </Pressable>
  );
}

/**
 * The composer: a 52px field beside a 52px accent square, both on the 13px
 * input radius, exactly as both Assistant boards draw it.
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
  const { c, radius, dark } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder="Ask about your bike…"
        size="standard"
        returnKeyType="send"
        onSubmitEditing={onSend}
        editable={!busy}
        style={{ flex: 1 }}
        testID={inputTestID}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send question"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onSend}
        testID={sendTestID}
        style={({ pressed }) => ({
          width: 52,
          height: 52,
          borderRadius: radius.input,
          backgroundColor: c.acc,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.55 : pressed ? 0.85 : 1,
        })}
      >
        <Icon name="send" size={20} color={dark ? c.bg : '#FFFFFF'} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

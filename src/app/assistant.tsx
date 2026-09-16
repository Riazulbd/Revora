import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View , KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Icon, Input, ScreenHeader, Txt } from '@/components';
import { SUGGESTED_QUESTIONS } from '@/features/assistant/answerQuestion';
import { useAssistant } from '@/features/assistant/useAssistant';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useExpiringDocuments } from '@/features/records/useRecordQueries';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { useTheme } from '@/theme';

type Message = { id: string; role: 'assistant' | 'user'; text: string };

/**
 * The assistant.
 *
 * Every figure it quotes is read from the same deterministic calculations the
 * rest of the app shows — it never estimates a number, and it says so. That is
 * also why it works with no connection.
 */
export default function Assistant() {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { analytics } = useGarageData();
  const { profile, activeBike } = useGarage();
  const expiring = useExpiringDocuments();
  const proGate = useProGate();
  const assistant = useAssistant();
  const scrollRef = useRef<ScrollView>(null);
  // A counter rather than a clock: message ids only have to be unique within
  // this conversation, and `Date.now()` is not pure enough for the lint rule.
  const nextId = useRef(0);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'assistant',
      text: `Hi${profile?.displayName ? ` ${profile.displayName}` : ''} — ask me anything about your ${
        activeBike?.nickname ?? 'bike'
      }'s records. Every number I give comes straight from what you logged.`,
    },
  ]);
  const [draft, setDraft] = useState('');

  const send = async (question: string) => {
    const text = question.trim();
    if (text === '' || assistant.pending) return;

    const stamp = (nextId.current += 1);
    setMessages((prev) => [...prev, { id: `u${stamp}`, role: 'user', text }]);
    setDraft('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    const reply = await assistant.ask(text, analytics, { documents: expiring }, []);
    setMessages((prev) => [
      ...prev,
      { id: `a${stamp}`, role: 'assistant', text: reply.notice ? `${reply.notice}\n\n${reply.text}` : reply.text },
    ]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }} testID="screen-assistant">
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <ScreenHeader
          title="Assistant"
          badge={proGate.isPro ? undefined : <Badge label="PRO" tone="accent" />}
          style={{ marginBottom: 8 }}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                backgroundColor: message.role === 'user' ? c.acc : c.sur,
                borderWidth: message.role === 'user' ? 0 : 1,
                borderColor: c.brd,
                borderRadius: radius.card,
                paddingHorizontal: 15,
                paddingVertical: 12,
              }}
            >
              <Txt role="body" color={message.role === 'user' ? '#FFFFFF' : c.ink}>
                {message.text}
              </Txt>
            </View>
          ))}

          <View style={{ gap: 8, marginTop: 4 }}>
            <Txt role="micro" tone="mut">
              Try asking
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTED_QUESTIONS.map((question) => (
                <Pressable
                  key={question}
                  accessibilityRole="button"
                  onPress={() => void send(question)}
                  testID={`suggest-${question.slice(0, 12)}`}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    justifyContent: 'center',
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: c.brd,
                    backgroundColor: c.sur,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Txt role="metaSmall" tone="mut">
                    {question}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 12 + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: c.brd,
            backgroundColor: c.sur,
          }}
        >
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your bike…"
            size="compact"
            returnKeyType="send"
            onSubmitEditing={() => void send(draft)}
            style={{ flex: 1 }}
            testID="input-assistant"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => void send(draft)}
            testID="cta-assistant-send"
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.acc,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Icon name="send" size={19} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ProUpsellSheet gate={proGate} />
    </View>
  );
}

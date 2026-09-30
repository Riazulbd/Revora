import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Banner, SectionEyebrow, TabHeader, Txt } from '@/components';
import { ASSISTANT_MONTHLY_QUOTA, nextQuotaResetIso } from '@/calculations/assistantQuota';
import {
  AssistantComposer,
  ChatBubble,
  SuggestionRow,
} from '@/features/assistant/ui/AssistantChat';
import {
  AssistantFreeNotice,
  AssistantOfflineNotice,
  QuotaExhaustedNotice,
} from '@/features/assistant/ui/AssistantNotices';
import { useAssistant } from '@/features/assistant/useAssistant';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useExpiringDocuments } from '@/features/records/useRecordQueries';
import { ASSISTANT_COMING_SOON } from '@/features/premium/comingSoon';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { useConnectivity } from '@/services/connectivity';
import { formatShortDate, todayIso } from '@/utils/date';
import { useTheme } from '@/theme';

type Message = { id: string; role: 'assistant' | 'user'; text: string; source?: string };

/**
 * The assistant.
 *
 * Every figure it quotes is read from the same deterministic calculations the
 * rest of the app shows — it never estimates a number, and the answer bubble
 * says so underneath itself. That is also why it still works with no connection.
 */
export default function Assistant() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { analytics } = useGarageData();
  const { activeBike } = useGarage();
  const expiring = useExpiringDocuments();
  const connectivity = useConnectivity();
  const proGate = useProGate();
  const assistant = useAssistant();
  const scrollRef = useRef<ScrollView>(null);
  // A counter rather than a clock: message ids only have to be unique within
  // this conversation, and `Date.now()` is not pure enough for the lint rule.
  const nextId = useRef(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

  const bikeLabel = activeBike ? activeBike.nickname.trim() || activeBike.model.trim() || null : null;

  // Board "Try asking", with the sample bike's name replaced by the rider's own.
  const suggestions: readonly string[] = [
    'What does my bike cost per month?',
    'When is the next service due?',
    bikeLabel === null ? 'Is my mileage normal?' : `Is my mileage normal for my ${bikeLabel}?`,
  ];

  const quotaLabel =
    assistant.remaining === null
      ? `${ASSISTANT_MONTHLY_QUOTA} questions a month`
      : `${assistant.remaining} questions left this month`;

  const send = async (question: string) => {
    const text = question.trim();
    if (text === '' || assistant.pending) return;

    const stamp = (nextId.current += 1);
    setMessages((prev) => [...prev, { id: `u${stamp}`, role: 'user', text }]);
    setDraft('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    const reply = await assistant.ask(text, analytics, { documents: expiring }, []);
    const measured = analytics?.mileage.count ?? 0;
    setMessages((prev) => [
      ...prev,
      {
        id: `a${stamp}`,
        role: 'assistant',
        text: reply.text,
        source:
          reply.notice ??
          `Figures come from the same calculations as your Dashboard — ${measured} measured interval${
            measured === 1 ? '' : 's'
          }.`,
      },
    ]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const notices = (
    <>
      {assistant.remaining === 0 ? (
        <QuotaExhaustedNotice
          quota={ASSISTANT_MONTHLY_QUOTA}
          resetLabel={formatShortDate(nextQuotaResetIso(todayIso()))}
        />
      ) : null}
      {connectivity.isOnline ? null : <AssistantOfflineNotice />}
      {/* Announced, not shipped. The on-device answerer below still works — it
          reads figures the app already computed — so the notice says what the
          rider is getting rather than blocking a screen that does something. */}
      {ASSISTANT_COMING_SOON ? (
        <Banner
          tone="neutral"
          icon="sparkle"
          message="The full Assistant is coming soon. Until then this answers from the figures Revora has already worked out, on your phone."
          testID="banner-assistant-coming-soon"
        />
      ) : proGate.isPro ? null : (
        <AssistantFreeNotice onPress={() => router.push('/plan')} testID="cta-assistant-plan" />
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }} testID="screen-assistant">
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <TabHeader
          title="Assistant"
          action={
            <Txt role="meta" tone="mut" numberOfLines={1} testID="label-assistant-quota">
              {quotaLabel}
            </Txt>
          }
          style={{ marginBottom: 10 }}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {notices}

          {messages.length === 0 ? (
            <View testID="assistant-first-use">
              <Txt role="body" tone="mut" style={{ lineHeight: 19.5 }}>
                Answers come from your own records — the same calculations as every screen. Not enough data? It
                says so.
              </Txt>

              <SectionEyebrow top={18} style={{ marginHorizontal: 4 }}>
                Try asking
              </SectionEyebrow>

              <View style={{ gap: 8 }}>
                {suggestions.map((question, index) => (
                  <SuggestionRow
                    key={question}
                    label={question}
                    onPress={() => void send(question)}
                    testID={`suggest-${index + 1}`}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  role={message.role}
                  text={message.text}
                  {...(message.source === undefined ? {} : { source: message.source })}
                  testID={`bubble-${message.id}`}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom }}>
          <AssistantComposer
            value={draft}
            onChangeText={setDraft}
            onSend={() => void send(draft)}
            busy={assistant.pending}
            inputTestID="input-assistant"
            sendTestID="cta-assistant-send"
          />
        </View>
      </KeyboardAvoidingView>

      <ProUpsellSheet gate={proGate} />
    </View>
  );
}

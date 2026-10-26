import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Banner, HeroCard, Icon, ScreenHeader, SectionEyebrow, Txt, type IconName } from '@/components';
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
import { fontFamily, useTheme } from '@/theme';

type Message = { id: string; role: 'assistant' | 'user'; text: string; source?: string };

/**
 * The assistant (Figma `E4 More — Assistant (coming soon)`, `E4b … (conversation)`).
 *
 * Every figure it quotes is read from the same deterministic calculations the
 * rest of the app shows — it never estimates a number, and the answer bubble
 * says so underneath itself. That is also why it still works with no connection.
 *
 * The screen owns its scroll view because the composer is pinned under it;
 * the padding matches `Screen` (24 / 16 / 28) so it sits like every other frame.
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

  const firstUse = messages.length === 0;

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
          rider is getting rather than blocking a screen that does something.
          First use gets the board's dark card; a conversation keeps the short
          note so the answers have the room. */}
      {ASSISTANT_COMING_SOON ? (
        firstUse ? (
          <ComingSoonCard />
        ) : (
          <Banner
            variant="soft"
            tone="accent"
            icon="sparkles"
            compact
            message="The full Assistant is coming soon. Until then this answers from the figures Revora has already worked out, on your phone."
            testID="banner-assistant-coming-soon"
          />
        )
      ) : proGate.isPro ? null : (
        <AssistantFreeNotice onPress={() => router.push('/plan')} testID="cta-assistant-plan" />
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 24 }} testID="screen-assistant">
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader title="Assistant" titleNote={quotaLabel} style={{ marginBottom: 0 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: firstUse ? 16 : 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {notices}

          {firstUse ? (
            <View style={{ gap: 16 }} testID="assistant-first-use">
              {/* Figma `Intro`. */}
              <Txt role="body" tone="mut" style={{ paddingHorizontal: 4 }}>
                Answers come from your own records — the same calculations as every screen. Not enough data? It
                says so.
              </Txt>

              {/* Figma `Try asking`: the eyebrow 2px over the first row, rows 8px apart. */}
              <View style={{ gap: 8 }}>
                <SectionEyebrow first style={{ marginBottom: 2 }}>
                  Try asking
                </SectionEyebrow>
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
            messages.map((message) => (
              <ChatBubble
                key={message.id}
                role={message.role}
                text={message.text}
                {...(message.source === undefined ? {} : { source: message.source })}
                testID={`bubble-${message.id}`}
              />
            ))
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 + insets.bottom }}>
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

/**
 * Figma `Coming soon — dark accent`: the 44px `#23272C` tile with the sparkles,
 * the `COMING SOON` chip, a `700 20px` line, `400 14px` body and two fact
 * chips — works offline, never estimates — each with a green glyph.
 */
function ComingSoonCard() {
  const { c } = useTheme();
  return (
    <HeroCard gap={12} testID="banner-assistant-coming-soon">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.heroTile, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={20} color={c.heroAcc} />
        </View>
        <View style={{ backgroundColor: c.heroAcc, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Txt style={{ fontFamily: fontFamily[700], fontSize: 12, lineHeight: 15, letterSpacing: 0.48, color: '#14171B' }}>
            COMING SOON
          </Txt>
        </View>
      </View>
      <Txt role="dialogTitle" color={c.heroInk}>
        The full Assistant is coming soon
      </Txt>
      <Txt role="body" color={c.heroMut}>
        Until then this answers from the figures Revora has already worked out, on your phone.
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <FactChip icon="wifiOff" label="Works offline" />
        <FactChip icon="shieldCheck" label="Never estimates" />
      </View>
    </HeroCard>
  );
}

/** Figma `Fact`: `padding:6px 12px 6px 10px; gap:6px` on `#262A30`, a 16px green glyph and `600 12px #C9CED4`. */
function FactChip({ icon, label }: { icon: IconName; label: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 10,
        paddingRight: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: c.heroChip,
      }}
    >
      <Icon name={icon} size={16} color={c.heroGood} />
      <Txt role="smallStrong" color={c.heroChipInk}>
        {label}
      </Txt>
    </View>
  );
}

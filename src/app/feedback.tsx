import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import * as Application from 'expo-application';

import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
  Stack,
  TextArea,
  Txt,
  type SegmentedOption,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useSubmitFeedback } from '@/features/feedback/useFeedbackMutations';
import type { FeedbackKind } from '@/types';

const KINDS: readonly SegmentedOption<FeedbackKind>[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'problem', label: 'Problem' },
  { value: 'question', label: 'Question' },
];

const PROMPT: Record<FeedbackKind, string> = {
  idea: 'What would make Revora more useful for you?',
  problem: 'What happened, and what did you expect instead? If it involves a particular record, say which.',
  question: 'What would you like to know?',
};

const MAX = 4000;

/**
 * React Native exposes the handset's own identifiers on Android, which saves a
 * dependency for the one platform Revora ships on.
 */
function androidModel(): string {
  const constants = Platform.constants as { Manufacturer?: string; Model?: string } | undefined;
  const made = [constants?.Manufacturer, constants?.Model].filter(Boolean).join(' ').trim();
  return made === '' ? 'unknown' : made;
}

/**
 * Feedback, problems and questions — open to every rider, on any plan.
 *
 * The plan and the device details ride along with the message because "it
 * crashes on my phone" is unanswerable without them, and asking afterwards
 * almost never gets a reply.
 */
export default function FeedbackScreen() {
  const { user } = useAuth();
  const { isPro } = useGarage();
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useSubmitFeedback({ onSent: () => { setSent(true); setMessage(''); } });
  const trimmed = message.trim();

  const send = () => {
    if (trimmed.length === 0) {
      setError('Write a message first.');
      return;
    }
    setError(null);
    setSent(false);
    void submit.submit({
      kind,
      message: trimmed,
      contactEmail: email.trim() || null,
      tier: isPro ? 'pro' : 'free',
      appVersion: Application.nativeApplicationVersion ?? 'unknown',
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      deviceModel: androidModel(),
    });
  };

  return (
    <Screen testID="screen-feedback">
      <ScreenHeader title="Feedback & support" />

      <Stack>
        <Txt role="helper" tone="mut">
          Every message reaches the people who build Revora. Tell us what is wrong, what is missing, or what you
          would like to see next.
        </Txt>

        {sent ? (
          <Banner
            tone="good"
            icon="check"
            message="Thanks — your message is on its way. If you left an email address we will reply to it."
            testID="banner-feedback-sent"
          />
        ) : null}

        <Card>
          <Field label="What is this about?">
            <Segmented options={KINDS} value={kind} onChange={setKind} testID="segmented-feedback-kind" />
          </Field>

          <Field
            label="Your message"
            error={error ?? undefined}
            helper={`${trimmed.length} / ${MAX}`}
            style={{ marginTop: 16 }}
          >
            <TextArea
              value={message}
              onChangeText={(next) => setMessage(next.slice(0, MAX))}
              placeholder={PROMPT[kind]}
              rows={6}
              invalid={Boolean(error)}
              testID="input-feedback-message"
            />
          </Field>

          <Field
            label="Email for a reply"
            helper="Optional. Without it we cannot answer, only read."
            style={{ marginTop: 16 }}
          >
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="input-feedback-email"
            />
          </Field>

          <Button
            label="Send"
            onPress={send}
            loading={submit.isPending}
            disabled={trimmed.length === 0}
            style={{ marginTop: 18 }}
            testID="cta-send-feedback"
          />
        </Card>

        <View>
          <Txt role="micro" tone="mut">
            Sent with your Revora account, app version and device model so we can reproduce problems. Your fuel
            logs, documents and photos are never attached.
          </Txt>
        </View>
      </Stack>
    </Screen>
  );
}

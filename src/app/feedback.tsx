import React, { useState } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';

import {
  Banner,
  Button,
  ChipGroup,
  Field,
  Screen,
  ScreenHeader,
  TextArea,
  Txt,
  type SegmentedOption,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useSubmitFeedback } from '@/features/feedback/useFeedbackMutations';
import type { FeedbackKind } from '@/types';

/** Board order: Problem first, because that is what most messages are. */
const KINDS: readonly SegmentedOption<FeedbackKind>[] = [
  { value: 'problem', label: 'Problem' },
  { value: 'idea', label: 'Feature request' },
  { value: 'question', label: 'Question' },
];

const PROMPT: Record<FeedbackKind, string> = {
  problem: 'What happened, and what did you expect instead?',
  idea: 'What would make Revora more useful for you?',
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
 * Feedback & support — account--04.
 *
 * Three chips, one box, one button, and a line that names everything that
 * travels with the message. The board writes that line out in full rather than
 * linking to a policy, because "what else are you sending?" is the question
 * that stops people writing in.
 */
export default function FeedbackScreen() {
  const { user } = useAuth();
  const { isPro } = useGarage();
  const [kind, setKind] = useState<FeedbackKind>('problem');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useSubmitFeedback({ onSent: () => { setSent(true); setMessage(''); } });
  const trimmed = message.trim();

  const version = Application.nativeApplicationVersion ?? 'unknown';
  const model = androidModel();

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
      // The board shows no address field: a signed-in rider already has one,
      // and an anonymous account has none to offer.
      contactEmail: user?.email ?? null,
      tier: isPro ? 'pro' : 'free',
      appVersion: version,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      deviceModel: model,
    });
  };

  return (
    <Screen testID="screen-feedback">
      <ScreenHeader title="Feedback & support" />

      {sent ? (
        <Banner
          tone="good"
          message="Thanks — your message is on its way. If your account has an email address we will reply to it."
          style={{ marginBottom: 12 }}
          testID="banner-feedback-sent"
        />
      ) : null}

      <ChipGroup
        options={KINDS}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setError(null);
        }}
        wrap={false}
        testID="segmented-feedback-kind"
      />

      <Field error={error ?? undefined} style={{ marginTop: 12 }}>
        <TextArea
          value={message}
          onChangeText={(next) => setMessage(next.slice(0, MAX))}
          placeholder={PROMPT[kind]}
          rows={4}
          invalid={Boolean(error)}
          testID="input-feedback-message"
        />
      </Field>

      <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
        Sent with your report: app version {version} and device model ({model}). Nothing else — no records, no
        location.
      </Txt>

      <Button
        label="Send"
        onPress={send}
        loading={submit.isPending}
        style={{ marginTop: 12 }}
        testID="cta-send-feedback"
      />

      <Txt role="helper" tone="mut" align="center" style={{ marginTop: 10 }}>
        We read everything. We reply when there&rsquo;s something to say — usually within a week. Offline? It
        queues and sends itself.
      </Txt>
    </Screen>
  );
}

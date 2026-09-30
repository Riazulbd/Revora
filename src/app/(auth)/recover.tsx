import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Input, LinkButton, Screen, ScreenHeader, Txt, useToast } from '@/components';
import { RESEND_COOLDOWN_SECONDS, cooldownRemaining, resendLabel } from '@/calculations/resendCooldown';
import { AuthMailCard } from '@/features/auth/ui/AuthMailCard';
import { AuthNotice } from '@/features/auth/ui/AuthNotice';
import { authService } from '@/services/auth';
import { messageFor } from '@/services/errors';
import { useConnectivity } from '@/services/connectivity';
import { recoverSchema } from '@/validation/schemas';

/**
 * Reset password.
 *
 * A reset link is the one thing in Revora that genuinely cannot be queued:
 * Firebase has to reach the account and the link can only arrive by email. So
 * offline this screen says so and goes inert, rather than accepting a tap it
 * cannot honour.
 *
 * Once the link is away the screen becomes the board's confirmation panel, with
 * the resend button counting itself out — four taps in ten seconds earn four
 * links and a rate limit, and the wait is better shown than hidden.
 */
export default function Recover() {
  const toast = useToast();
  const { isOnline } = useConnectivity();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  // The clock is started where the link is sent; this only keeps it ticking.
  useEffect(() => {
    if (sentAt === null) return;
    const tick = setInterval(() => setSecondsLeft(cooldownRemaining(sentAt, Date.now())), 1000);
    return () => clearInterval(tick);
  }, [sentAt]);

  const send = async () => {
    const parsed = recoverSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Enter your email address.');
      return;
    }
    setError(null);

    if (!isOnline) {
      toast.show('A reset link needs a connection. Reconnect and try again.', 'error');
      return;
    }

    setBusy(true);
    try {
      await authService.sendPasswordReset(parsed.data.email);
      setSentTo(parsed.data.email);
      setSentAt(Date.now());
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.show(messageFor(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const useAnotherEmail = () => {
    setSentTo(null);
    setSentAt(null);
    setEmail('');
  };

  const sent = sentTo !== null;

  return (
    <Screen contentStyle={{ paddingTop: 12 }} testID="screen-recover">
      <ScreenHeader title="Reset password" style={{ marginBottom: 0 }} />

      {!isOnline ? (
        <AuthNotice
          tone="warn"
          lead="You’re offline."
          message="A password reset needs a connection — the link can only arrive by email."
          style={{ marginTop: 8 }}
          testID="banner-offline"
        />
      ) : sent ? null : (
        <Txt role="body" tone="mut" style={{ marginTop: 8, lineHeight: 19.5 }}>
          Enter your account email and we&rsquo;ll send a link to set a new password.
        </Txt>
      )}

      {sent ? (
        <>
          <AuthMailCard email={sentTo} style={{ marginTop: 16 }} testID="card-sent" />
          <Button
            label={resendLabel(secondsLeft)}
            onPress={send}
            loading={busy}
            loadingLabel="Sending…"
            disabled={secondsLeft > 0 || !isOnline}
            style={{ marginTop: 16 }}
            testID="cta-resend"
          />
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            <LinkButton
              label="Use a different email"
              size="large"
              onPress={useAnotherEmail}
              testID="cta-different-email"
            />
          </View>
        </>
      ) : (
        <>
          <View
            pointerEvents={busy ? 'none' : 'auto'}
            style={{ marginTop: !isOnline ? 20 : 24, opacity: busy ? 0.6 : 1 }}
          >
            <Field label="Email" error={error}>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={send}
                editable={isOnline}
                invalid={Boolean(error)}
                testID="input-email"
              />
            </Field>
          </View>

          <Button
            label="Send reset link"
            loadingLabel="Sending…"
            onPress={send}
            loading={busy}
            disabled={!isOnline}
            style={{ marginTop: 20 }}
            testID="cta-submit"
          />
        </>
      )}
    </Screen>
  );
}

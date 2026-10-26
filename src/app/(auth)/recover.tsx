import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Card, Field, Icon, Input, LinkButton, Screen, ScreenHeader, Txt, useToast } from '@/components';
import { RESEND_COOLDOWN_SECONDS, cooldownRemaining, resendLabel } from '@/calculations/resendCooldown';
import { AuthSwitchLine } from '@/features/auth/ui/AuthChrome';
import { AuthMailCard } from '@/features/auth/ui/AuthMailCard';
import { AuthNotice } from '@/features/auth/ui/AuthNotice';
import { authService } from '@/services/auth';
import { messageFor } from '@/services/errors';
import { useConnectivity } from '@/services/connectivity';
import { recoverSchema } from '@/validation/schemas';
import { fontFamily, useTheme } from '@/theme';

/**
 * Reset password (Figma `A4 Auth — Recover password`).
 *
 * A reset link is the one thing in Revora that genuinely cannot be queued:
 * Firebase has to reach the account and the link can only arrive by email. So
 * offline this screen says so and goes inert, rather than accepting a tap it
 * cannot honour.
 *
 * Once the link is away the screen becomes the confirmation panel, with the
 * resend button counting itself out — four taps in ten seconds earn four links
 * and a rate limit, and the wait is better shown than hidden.
 */
export default function Recover() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
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

  const backToSignIn = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/signin');
  };

  const sent = sentTo !== null;

  return (
    <Screen contentStyle={{ flexGrow: 1, gap: 16 }} testID="screen-recover">
      <ScreenHeader title="Reset password" style={{ marginBottom: 0 }} />

      {!isOnline ? (
        <AuthNotice
          tone="warn"
          lead="You’re offline."
          message="A password reset needs a connection — the link can only arrive by email."
          testID="banner-offline"
        />
      ) : null}

      {sent ? (
        <>
          <AuthMailCard email={sentTo} testID="card-sent" />
          <Button
            label={resendLabel(secondsLeft)}
            size="xlarge"
            onPress={send}
            loading={busy}
            loadingLabel="Sending…"
            disabled={secondsLeft > 0 || !isOnline}
            testID="cta-resend"
          />
          <View style={{ alignItems: 'center', height: 48, justifyContent: 'center' }}>
            <LinkButton label="Use a different email" size="large" onPress={useAnotherEmail} testID="cta-different-email" />
          </View>
        </>
      ) : (
        <>
          {/* Figma `Hero`: the key in a soft disc, the question, the one-line answer. */}
          <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 8, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accS, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="keyRound" size={28} color={c.accBright} />
            </View>
            <Txt align="center" style={{ fontFamily: fontFamily[700], fontSize: 24, lineHeight: 30, letterSpacing: -0.24, color: c.ink }}>
              Forgot your password?
            </Txt>
            <Txt role="body" tone="mut" align="center">
              Enter your account email and we&rsquo;ll send a link to set a new password.
            </Txt>
          </View>

          <Card pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 12, opacity: busy ? 0.6 : 1 }} testID="card-fields">
            <Field label="Email" error={error}>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                leadingIcon="mail"
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
            {/* The sentence is deliberately conditional — "If that address has
                a Revora account" — because confirming which addresses are
                registered would hand an attacker a list of riders. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.sur2 }}>
              <Icon name="info" size={20} color={c.mut} />
              <Txt role="helper" tone="mut" style={{ flex: 1 }}>
                If that address has a Revora account, a reset link is on its way. It can take a minute or two.
              </Txt>
            </View>
          </Card>

          <Button
            label="Send reset link"
            icon="send"
            loadingLabel="Sending…"
            size="xlarge"
            onPress={send}
            loading={busy}
            disabled={!isOnline}
            testID="cta-submit"
          />

          <View style={{ flex: 1, minHeight: 24 }} />

          <AuthSwitchLine prompt="Remembered it?" action="Sign in" onPress={backToSignIn} testID="cta-back-to-signin" />
        </>
      )}
    </Screen>
  );
}

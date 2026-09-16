import React, { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Field, Input, Screen, ScreenHeader, Txt, useToast } from '@/components';
import { authService } from '@/services/auth';
import { messageFor } from '@/services/errors';
import { useConnectivity } from '@/services/connectivity';
import { recoverSchema } from '@/validation/schemas';

export default function Recover() {
  const toast = useToast();
  const { isOnline } = useConnectivity();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const parsed = recoverSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Enter your email address.');
      return;
    }
    setError(null);

    if (!isOnline) {
      // Password reset is the one action that genuinely cannot be queued —
      // Firebase has to reach the account. Say so rather than pretending.
      toast.show('A reset link needs a connection. Reconnect and try again.', 'error');
      return;
    }

    setBusy(true);
    try {
      await authService.sendPasswordReset(parsed.data.email);
      setSent(true);
      toast.show('Reset link sent — check your email');
    } catch (err) {
      toast.show(messageFor(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="screen-recover">
      <ScreenHeader title="" style={{ marginBottom: 0 }} />
      <View style={{ gap: 6, marginTop: 8, marginBottom: 24 }}>
        <Txt role="authTitle">Reset password</Txt>
        <Txt role="subtitle" tone="mut" style={{ lineHeight: 20 }}>
          Enter your account email and we&apos;ll send a link to set a new password.
        </Txt>
      </View>

      <View style={{ gap: 14 }}>
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
            onSubmitEditing={submit}
            invalid={Boolean(error)}
            testID="input-email"
          />
        </Field>

        <Button
          label={sent ? 'Send again' : 'Send reset link'}
          onPress={submit}
          loading={busy}
          testID="cta-submit"
        />

        {!isOnline ? (
          <Banner
            label="OFFLINE"
            message="A reset link has to reach your inbox, so this one step needs a connection. Everything else in Revora works offline."
            testID="banner-offline"
          />
        ) : null}

        {sent ? (
          <Banner
            tone="good"
            icon="check"
            message="If that address has a Revora account, a reset link is on its way. It can take a minute or two. Not seeing it? Check spam."
          />
        ) : null}
      </View>
    </Screen>
  );
}

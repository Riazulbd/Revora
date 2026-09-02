import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Field, Input, LinkButton, Screen, ScreenHeader, Txt, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { messageFor } from '@/services/errors';
import { signInSchema } from '@/validation/schemas';
import { useTheme } from '@/theme';

export default function SignIn() {
  const router = useRouter();
  const toast = useToast();
  const { signIn, continueWithoutAccount, signInWithGoogle } = useAuth();
  const { c } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data);
      router.replace('/');
    } catch (error) {
      toast.show(messageFor(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) router.replace('/');
    } catch (error) {
      toast.show(messageFor(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const continueOffline = async () => {
    setBusy(true);
    try {
      await continueWithoutAccount();
      router.replace('/');
    } catch (error) {
      toast.show(messageFor(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="screen-signin">
      <ScreenHeader title="" style={{ marginBottom: 0 }} />
      <View style={{ gap: 6, marginTop: 8, marginBottom: 24 }}>
        <Txt role="authTitle">Sign in</Txt>
        <Txt role="subtitle" tone="mut">
          Welcome back to the garage.
        </Txt>
      </View>

      <View style={{ gap: 14 }}>
        <Field label="Email" error={errors.email ?? null}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            returnKeyType="next"
            invalid={Boolean(errors.email)}
            testID="input-email"
          />
        </Field>

        <Field label="Password" error={errors.password ?? null}>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            invalid={Boolean(errors.password)}
            testID="input-password"
          />
        </Field>

        <LinkButton label="Forgot password?" size="large" onPress={() => router.push('/(auth)/recover')} />

        <Button label="Sign in" onPress={submit} loading={busy} style={{ marginTop: 6 }} testID="cta-submit" />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.brd }} />
          <Txt role="smallStrong" tone="mut">
            OR
          </Txt>
          <View style={{ flex: 1, height: 1, backgroundColor: c.brd }} />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          onPress={googleSignIn}
          disabled={busy}
          testID="cta-google"
        />
        <Button
          label="Continue offline — no account"
          variant="secondary"
          onPress={continueOffline}
          disabled={busy}
          testID="cta-anonymous"
        />
        <Txt role="helper" tone="mut" align="center">
          An offline account keeps everything on this phone. Add an email later in Settings and it all syncs to
          the web.
        </Txt>
      </View>
    </Screen>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Field, Input, LinkButton, Screen, ScreenHeader, Txt, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthOrDivider, AuthSwitchLine } from '@/features/auth/ui/AuthChrome';
import { AuthGoogleButton } from '@/features/auth/ui/AuthGoogleButton';
import { AuthNotice } from '@/features/auth/ui/AuthNotice';
import { AuthPasswordField } from '@/features/auth/ui/AuthPasswordField';
import { authFailure } from '@/features/auth/ui/authFailure';
import { useKeyboardOpen } from '@/features/auth/ui/useKeyboardOpen';
import { messageFor } from '@/services/errors';
import { useConnectivity } from '@/services/connectivity';
import { signInSchema } from '@/validation/schemas';
import { fontFamily, useTheme } from '@/theme';

/**
 * Sign in.
 *
 * Four states live on the board and all four are here: idle, wrong credentials
 * (both fields red under one sentence that does not say *which* was wrong —
 * that is an account-enumeration leak), offline (the whole form inert, because
 * signing in genuinely cannot be queued), and keyboard-open while submitting,
 * where the reassurance line steps aside so the fields and the button stay
 * above the keyboard.
 */
export default function SignIn() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { isOnline } = useConnectivity();
  const keyboardOpen = useKeyboardOpen();
  const { signIn, continueWithoutAccount, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);

  const locked = !isOnline;

  const submit = async () => {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      setRefused(false);
      return;
    }
    setErrors({});
    setRefused(false);
    setBusy(true);
    try {
      await signIn(parsed.data);
      router.replace('/');
    } catch (error) {
      const failure = authFailure(error);
      if (failure === 'credentials') setRefused(true);
      else toast.show(messageFor(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const withGoogle = async () => {
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

  const fieldSize = keyboardOpen ? 'compact' : 'standard';

  return (
    <Screen contentStyle={{ flexGrow: 1, paddingTop: 12 }} testID="screen-signin">
      <ScreenHeader title="Sign in" style={{ marginBottom: 0 }} />

      {locked ? (
        <AuthNotice
          tone="warn"
          lead="You’re offline."
          message="Signing in needs a connection. Anything already saved on this phone is safe and will sync when you’re back."
          style={{ marginTop: 8 }}
          testID="banner-offline"
        />
      ) : keyboardOpen ? null : (
        <Txt
          style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 19.5, color: c.mut, marginTop: 8 }}
        >
          Your logbook lives on your account, not this phone. Sign in and it comes back — even on a new
          phone.
        </Txt>
      )}

      <View
        pointerEvents={busy ? 'none' : 'auto'}
        style={{
          gap: keyboardOpen ? 12 : 16,
          marginTop: locked ? 20 : keyboardOpen ? 12 : 24,
          opacity: busy ? 0.6 : 1,
        }}
      >
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
            size={fieldSize}
            editable={!locked}
            invalid={Boolean(errors.email) || refused}
            testID="input-email"
          />
        </Field>

        <Field label="Password" error={errors.password ?? null}>
          <AuthPasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            size={fieldSize}
            editable={!locked}
            invalid={Boolean(errors.password) || refused}
            testID="input-password"
            toggleTestID="toggle-password"
          />
          {locked ? null : (
            <View style={{ alignItems: 'flex-end', marginTop: 2 }}>
              <LinkButton
                label="Forgot password?"
                size="large"
                onPress={() => router.push('/(auth)/recover')}
                testID="cta-forgot"
              />
            </View>
          )}
        </Field>
      </View>

      {refused ? (
        <AuthNotice
          tone="bad"
          lead="That email and password don’t match."
          message="Check both, or "
          link={{
            label: 'reset your password',
            onPress: () => router.push('/(auth)/recover'),
            testID: 'link-reset',
          }}
          tail="."
          style={{ marginTop: 4 }}
          testID="banner-credentials"
        />
      ) : null}

      <Button
        label="Sign in"
        loadingLabel="Signing in…"
        onPress={submit}
        loading={busy}
        disabled={locked}
        style={{ marginTop: locked ? 20 : 12 }}
        testID="cta-submit"
      />

      <AuthOrDivider style={{ marginVertical: 20 }} />

      <AuthGoogleButton onPress={withGoogle} disabled={locked || busy} testID="cta-google" />

      <View style={{ flex: 1, minHeight: 24 }} />

      <View style={{ alignItems: 'center', gap: 2 }}>
        <LinkButton
          label="Continue offline — no account"
          size="large"
          tone="mut"
          onPress={continueOffline}
          testID="cta-anonymous"
        />
        <AuthSwitchLine
          prompt="New to Revora?"
          action="Create account"
          onPress={() => router.replace('/(auth)/signup')}
          testID="cta-create-account"
        />
      </View>
    </Screen>
  );
}

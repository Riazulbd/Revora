import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Field, Input, Screen, ScreenHeader, Txt, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { messageFor } from '@/services/errors';
import { signUpSchema } from '@/validation/schemas';

export default function SignUp() {
  const router = useRouter();
  const toast = useToast();
  const { user, signUp, signInWithGoogle, linkEmailAccount, linkGoogleAccount } = useAuth();
  // A rider who chose "Continue offline" already owns records under an
  // anonymous uid. Creating a fresh account here would orphan every one of
  // them; linking keeps the uid and the data with it.
  const claiming = user?.isAnonymous === true;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ displayName?: string; email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = signUpSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        displayName: flat.displayName?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (claiming) await linkEmailAccount(parsed.data);
      else await signUp(parsed.data);
      // The router gate sends a rider with no motorcycle straight to onboarding.
      router.replace('/');
    } catch (error) {
      toast.show(messageFor(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="screen-signup">
      <ScreenHeader title="" style={{ marginBottom: 0 }} />
      <View style={{ gap: 6, marginTop: 8, marginBottom: 24 }}>
        <Txt role="authTitle">{claiming ? 'Keep your records' : 'Create account'}</Txt>
        {claiming ? (
          <Txt role="subtitle" tone="mut">
            Your bikes and logs stay exactly as they are — this just adds an email so they follow you to
            another phone.
          </Txt>
        ) : null}
        <Txt role="subtitle" tone="mut">
          One account, all your bikes.
        </Txt>
      </View>

      <View style={{ gap: 14 }}>
        <Field label="Display name" error={errors.displayName ?? null}>
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Riaz"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            invalid={Boolean(errors.displayName)}
            testID="input-name"
          />
        </Field>

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

        <Field label="Password" helper="At least 8 characters." error={errors.password ?? null}>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="8+ characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            invalid={Boolean(errors.password)}
            testID="input-password"
          />
        </Field>

        <Button label="Continue" onPress={submit} loading={busy} style={{ marginTop: 6 }} testID="cta-submit" />

        <Button
          label="Continue with Google"
          variant="secondary"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const signedIn = claiming ? await linkGoogleAccount() : await signInWithGoogle();
              if (signedIn) router.replace('/');
            } catch (error) {
              toast.show(messageFor(error), 'error');
            } finally {
              setBusy(false);
            }
          }}
          testID="cta-google"
        />

        <Txt role="helper" tone="mut" align="center">
          Your records sync to your Revora account so the web and this phone always agree. We send a
          verification email — you can start logging straight away.
        </Txt>
      </View>
    </Screen>
  );
}

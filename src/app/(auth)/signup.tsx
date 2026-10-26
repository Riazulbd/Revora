import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Card, Field, Input, Screen, ScreenHeader, Txt, useToast } from '@/components';
import { passwordMeetsRules } from '@/calculations/passwordRules';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLegalLine, AuthSwitchLine } from '@/features/auth/ui/AuthChrome';
import { AuthGoogleButton } from '@/features/auth/ui/AuthGoogleButton';
import { AuthNotice } from '@/features/auth/ui/AuthNotice';
import { AuthPasswordField, AuthPasswordRules } from '@/features/auth/ui/AuthPasswordField';
import { authFailure } from '@/features/auth/ui/authFailure';
import { messageFor } from '@/services/errors';
import { signUpSchema } from '@/validation/schemas';

/**
 * Create account (Figma `A3 Auth — Sign up`).
 *
 * The password rules sit up front rather than waiting for a rejection, so the
 * three chips are always on screen and only turn red once a submit has
 * actually been refused.
 *
 * A rider who chose "Continue offline" already owns records under an anonymous
 * uid. Creating a fresh account here would orphan every one of them; linking
 * keeps the uid and the data with it.
 */
export default function SignUp() {
  const router = useRouter();
  const toast = useToast();
  const { user, signUp, signInWithGoogle, linkEmailAccount, linkGoogleAccount } = useAuth();
  const claiming = user?.isAnonymous === true;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<'offline' | 'email-in-use' | null>(null);
  const [busy, setBusy] = useState(false);

  const offline = failure === 'offline';

  const submit = async () => {
    setAttempted(true);

    // The rules under the field are the password contract; nothing reaches the
    // auth layer until every one of them is met.
    const rulesMet = passwordMeetsRules(password);

    // Display name is optional. A rider who leaves it blank still needs a name
    // on the account, so the address they just typed supplies one.
    const named = displayName.trim() !== '' ? displayName.trim() : (email.split('@')[0] ?? '').trim();
    const parsed = signUpSchema.safeParse({ displayName: named, email, password });

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setEmailError(flat.email?.[0] ?? null);
      return;
    }
    setEmailError(null);
    if (!rulesMet) return;

    setBusy(true);
    try {
      if (claiming) await linkEmailAccount(parsed.data);
      else await signUp(parsed.data);
      setFailure(null);
      // The router gate sends a rider with no motorcycle straight to onboarding.
      router.replace('/');
    } catch (error) {
      const kind = authFailure(error);
      setFailure(kind === 'offline' ? 'offline' : kind === 'email-in-use' ? 'email-in-use' : null);
      toast.show(messageFor(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const withGoogle = async () => {
    setBusy(true);
    try {
      const signedIn = claiming ? await linkGoogleAccount() : await signInWithGoogle();
      if (signedIn) router.replace('/');
    } catch (error) {
      setFailure(authFailure(error) === 'offline' ? 'offline' : null);
      toast.show(messageFor(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const retryAfterOffline = () => {
    setFailure(null);
    void submit();
  };

  return (
    <Screen contentStyle={{ flexGrow: 1, gap: 16 }} testID="screen-signup">
      <ScreenHeader title="Create account" style={{ marginBottom: 0 }} />

      {offline ? (
        <AuthNotice
          tone="warn"
          lead="You’re offline."
          message="Creating an account needs a connection — "
          link={{ label: 'try again', onPress: retryAfterOffline, testID: 'link-retry' }}
          tail=" when you’re back."
          testID="banner-offline"
        />
      ) : (
        <View style={{ paddingTop: 8, gap: 8 }}>
          <Txt role="tabTitle" style={{ letterSpacing: -0.28 }}>
            {claiming ? 'Keep your records' : 'Start your logbook'}
          </Txt>
          <Txt role="body" tone="mut">
            {claiming
              ? 'Your bikes and logs stay exactly as they are — this just adds an email so they follow you to another phone.'
              : 'An account keeps your logbook safe if this phone is ever lost or replaced.'}
          </Txt>
        </View>
      )}

      <Card style={{ gap: 16 }} testID="card-fields">
        <Field>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Txt role="fieldLabel" tone="mut">
              Display name
            </Txt>
            <Txt role="meta" tone="faint">
              Optional
            </Txt>
          </View>
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="What should we call you?"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            editable={!offline}
            testID="input-name"
          />
        </Field>

        <Field label="Email" error={emailError}>
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
            editable={!offline}
            invalid={Boolean(emailError) || failure === 'email-in-use'}
            testID="input-email"
          />
        </Field>

        <Field label="Password">
          <AuthPasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!offline}
            invalid={attempted && !passwordMeetsRules(password)}
            testID="input-password"
            toggleTestID="toggle-password"
          />
          <AuthPasswordRules password={password} attempted={attempted} disabled={offline} />
        </Field>
      </Card>

      {failure === 'email-in-use' ? (
        <AuthNotice
          tone="bad"
          lead="That email already has a Revora account."
          message=""
          link={{ label: 'Sign in', onPress: () => router.replace('/(auth)/signin'), testID: 'link-signin' }}
          tail=" instead — your logbook will be there."
          testID="banner-email-in-use"
        />
      ) : null}

      <Button
        label="Create account"
        loadingLabel="Creating account…"
        size="xlarge"
        onPress={submit}
        loading={busy}
        disabled={offline}
        testID="cta-submit"
      />

      <AuthLegalLine
        prompt="By creating an account you agree to the"
        onTerms={() => router.push('/legal/terms')}
        onPrivacy={() => router.push('/legal/privacy')}
      />

      <AuthGoogleButton onPress={withGoogle} disabled={offline || busy} testID="cta-google" />

      <View style={{ flex: 1, minHeight: 24 }} />

      <AuthSwitchLine prompt="Already have an account?" action="Sign in" onPress={() => router.replace('/(auth)/signin')} testID="cta-signin-link" />
    </Screen>
  );
}

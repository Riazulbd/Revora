import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Screen, Txt, useToast } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthGoogleButton, AuthGoogleOfflineNote } from '@/features/auth/ui/AuthGoogleButton';
import { AuthLegalLine } from '@/features/auth/ui/AuthChrome';
import { AuthLockup } from '@/features/auth/ui/AuthLockup';
import { messageFor } from '@/services/errors';
import { useConnectivity } from '@/services/connectivity';
import { fontFamily, useTheme } from '@/theme';

/**
 * Welcome — the first screen a rider ever sees.
 *
 * The board is one centred lockup block over three pinned actions: create,
 * sign in, and Google. Offline the Google button greys out and says why, rather
 * than failing silently on a tap — it is the one action here that cannot work
 * without a connection.
 */
export default function Welcome() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { isOnline } = useConnectivity();
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const continueWithGoogle = async () => {
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

  return (
    <Screen
      scroll={false}
      contentStyle={{ paddingTop: 32, paddingHorizontal: 24 }}
      testID="screen-welcome"
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <AuthLockup caption="The motorcycle logbook." />

        <View style={{ alignItems: 'center', gap: 14 }}>
          <Txt
            align="center"
            style={{ fontFamily: fontFamily[700], fontSize: 22, lineHeight: 29.7, color: c.ink, maxWidth: 300 }}
          >
            Know what your bike really costs — and how it&rsquo;s really running.
          </Txt>
          <Txt role="eyebrow" tone="acc" uppercase align="center">
            Fuel · Service · Documents · Resale
          </Txt>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Button label="Create account" onPress={() => router.push('/(auth)/signup')} testID="cta-signup" />
        <Button
          label="Sign in"
          variant="secondary"
          onPress={() => router.push('/(auth)/signin')}
          testID="cta-signin"
        />

        {isOnline ? (
          <AuthGoogleButton onPress={continueWithGoogle} loading={busy} testID="cta-google" />
        ) : (
          <View style={{ gap: 8 }}>
            <AuthGoogleButton onPress={continueWithGoogle} disabled testID="cta-google" />
            <AuthGoogleOfflineNote />
          </View>
        )}

        <AuthLegalLine
          prompt="By continuing you agree to the"
          onTerms={() => router.push('/legal/terms')}
          onPrivacy={() => router.push('/legal/privacy')}
          style={{ marginTop: 4 }}
        />
      </View>
    </Screen>
  );
}

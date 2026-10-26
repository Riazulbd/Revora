import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Eyebrow, RowIcon, Screen, Txt, useToast, type IconName, type RowTone } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthGoogleButton, AuthGoogleOfflineNote } from '@/features/auth/ui/AuthGoogleButton';
import { AuthLegalLine } from '@/features/auth/ui/AuthChrome';
import { AuthLockup } from '@/features/auth/ui/AuthLockup';
import { messageFor } from '@/services/errors';
import { useConnectivity } from '@/services/connectivity';
import { fontFamily, useTheme } from '@/theme';

/**
 * Welcome (Figma `A1 Auth — Welcome`) — the first screen a rider ever sees.
 *
 * The brand, the one sentence that says what the app is for, three cards for
 * what it does, and three pinned actions: create, sign in, and Google. Offline
 * the Google button greys out and says why, rather than failing silently on a
 * tap — it is the one action here that cannot work without a connection.
 *
 * The cards name what the app measures rather than printing sample figures:
 * a number on this screen would be one the rider never logged.
 */
const FEATURES: readonly { icon: IconName; tone: RowTone; title: string; caption: string }[] = [
  { icon: 'fuel', tone: 'accent', title: 'Real mileage', caption: 'Measured from every fill' },
  { icon: 'wrench', tone: 'info', title: 'True cost / km', caption: 'Service and parts included' },
  { icon: 'fileCheck', tone: 'good', title: 'Papers on time', caption: 'Tax token & renewals' },
];

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
    <Screen wash scroll={false} contentStyle={{ flexGrow: 1 }} testID="screen-welcome">
      <AuthLockup caption="The motorcycle logbook." style={{ paddingTop: 8 }} />

      <View style={{ paddingTop: 40, gap: 14 }}>
        <Txt style={{ fontFamily: fontFamily[700], fontSize: 34, lineHeight: 42, letterSpacing: -0.68, color: c.ink }}>
          Know what your bike really costs — and how it&rsquo;s really running.
        </Txt>
        <Eyebrow tone="acc">Fuel · Service · Documents · Resale</Eyebrow>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 24 }}>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={{ flex: 1, backgroundColor: c.sur, borderRadius: 20, padding: 14, gap: 10 }}>
            <RowIcon icon={feature.icon} tone={feature.tone} size={36} />
            <View style={{ gap: 2 }}>
              <Txt role="rowTitleLarge">{feature.title}</Txt>
              <Txt role="meta" tone="mut">
                {feature.caption}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 22 }} />

      <View style={{ gap: 12 }}>
        <Button
          label="Create account"
          icon="arrowRight"
          iconPosition="right"
          size="xlarge"
          onPress={() => router.push('/(auth)/signup')}
          testID="cta-signup"
        />
        <Button label="Sign in" variant="secondary" size="xlarge" onPress={() => router.push('/(auth)/signin')} testID="cta-signin" />

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

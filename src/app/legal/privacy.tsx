import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components';
import { AccountDocHeader, AccountDocSection, AccountDocSummary } from '@/features/settings/AccountDoc';

/**
 * Privacy — account--05.
 *
 * The board's four sections come first, verbatim. The ones after them are not
 * drawn on the board and are not optional either: Google Play requires the
 * policy reachable from inside the app to describe what this build actually
 * does, and this build shows AdMob ads, relays support messages to Slack and
 * sends a figure summary to a language model on Pro. Every sentence below is
 * true of the code in this repository.
 */
const SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: 'What is stored',
    body: 'The records you enter — fuel, services, parts, documents, photos — and your account email and display name. Every figure Revora shows is calculated from what you logged; nothing derived is stored.',
  },
  {
    title: 'Where',
    body: 'On your Revora account (Firebase, Google Cloud), and on this phone while offline or when you keep an offline copy of a document. The Proof Pack PDF is rendered on the device and never uploaded.',
  },
  {
    title: 'How figures are made',
    body: 'Consumption is measured between two full-tank fills; where there is not enough data, Revora says so rather than estimating. Incorrect entries produce incorrect figures — you can edit or delete any record and everything derived from it is recalculated.',
  },
  {
    title: 'How to delete it',
    body: 'Settings › Delete account removes your records, photos and account irreversibly. The dialog lists exactly what goes before you confirm.',
  },
  {
    title: 'What Revora does not do',
    body: 'Revora does not sell your data, does not share it with advertisers, and does not use your records to train anything. On the Free plan the assistant runs entirely on your device and nothing leaves it.',
  },
  {
    title: 'Permissions',
    body: 'Notifications are asked for only when you turn reminders on. The camera is asked for only when you choose to take a photo. Choosing an existing photo goes through the system picker and needs no permission at all. Revora does not request location or contacts.',
  },
  {
    title: 'The Pro assistant',
    body: 'On Revora Pro, a question you type into the assistant is sent to Revora’s server together with a summary of that motorcycle’s figures — its odometer, mileage, running costs, service status and recent fill-ups — and passed to a language model (Google Gemini, via OpenRouter) to phrase the answer. Only the summary is sent, never your documents, photos, registration or chassis numbers, and never your name or email. Your question and the answer are not stored: only the date, the model used and the number of tokens, so usage can be reconciled.',
  },
  {
    title: 'Ads on the free plan',
    body: 'The free plan shows ads supplied by Google AdMob. To do that, Google receives your device’s advertising ID and standard ad-request information such as your device model, language and approximate region derived from your connection. It never receives your motorcycles, fuel logs, documents or photos. You can reset or delete the advertising ID in Android Settings → Privacy → Ads, and Revora Pro removes ads entirely.',
  },
  {
    title: 'Feedback and support',
    body: 'A message you send from Feedback & support is relayed to Revora’s support workspace on Slack so it reaches a person. What is sent is the message itself, your account email address, your plan, your app version, your device model and your account identifier. Your motorcycles, fuel logs, documents and photos are never attached.',
  },
  {
    title: 'What is kept after deletion',
    body: 'Two things survive Delete account: support messages you have already sent, because they have been delivered and cannot be recalled, and the record of any subscription payment, which Google and applicable accounting law require to be retained.',
  },
  {
    title: 'Contact',
    body: 'Questions about your data can be sent to the support address published on the Revora website.',
  },
];

export default function Privacy() {
  const router = useRouter();

  return (
    <Screen testID="screen-privacy">
      <AccountDocHeader
        title={'What Revora stores, where,\nand how to delete it'}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/dashboard');
        }}
        testID="cta-privacy-back"
      />

      <AccountDocSummary testID="card-privacy-summary">
        Your records live on your account. Documents marked offline also stay on this phone. We never sell
        data. Delete account removes everything, permanently.
      </AccountDocSummary>

      {SECTIONS.map((section, index) => (
        <View key={section.title} style={{ marginTop: index === 0 ? 20 : 18, paddingHorizontal: 4 }}>
          <AccountDocSection title={section.title} body={section.body} />
        </View>
      ))}
    </Screen>
  );
}

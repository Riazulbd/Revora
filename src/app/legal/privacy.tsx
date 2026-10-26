import React from 'react';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components';
import {
  AccountDocSection,
  AccountDocSections,
  AccountDocSummary,
  AccountDocTitle,
} from '@/features/settings/AccountDoc';
import type { IsoDate } from '@/types';

/** The day this text last changed — shown on the board's "Last updated" chip. */
const LAST_UPDATED: IsoDate = '2026-10-12';

/**
 * The board's sections, verbatim. Every sentence here is a promise the code
 * elsewhere keeps — nothing derived is stored, consumption is never estimated,
 * the Proof Pack never leaves the device — so a change to one must be a change
 * to the other.
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

/** Privacy (Figma `E6 Legal — Privacy`). */
export default function Privacy() {
  const router = useRouter();

  return (
    <Screen testID="screen-privacy" contentStyle={{ gap: 16 }}>
      <ScreenHeader
        title="Privacy"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/dashboard');
        }}
        backTestID="cta-privacy-back"
        style={{ marginBottom: 0 }}
      />

      <AccountDocTitle title={'What Revora stores, where,\nand how to delete it'} updatedOn={LAST_UPDATED} />

      <AccountDocSummary testID="card-privacy-summary">
        Your records live on your account. Documents marked offline also stay on this phone. We never sell
        data. Delete account removes everything, permanently.
      </AccountDocSummary>

      <AccountDocSections>
        {SECTIONS.map((section) => (
          <AccountDocSection key={section.title} title={section.title} body={section.body} />
        ))}
      </AccountDocSections>
    </Screen>
  );
}

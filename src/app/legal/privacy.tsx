import React from 'react';
import { View } from 'react-native';

import { Card, Screen, ScreenHeader, Stack, Txt } from '@/components';

/**
 * Privacy policy.
 *
 * Google Play requires a privacy policy that is reachable from inside the app,
 * and it has to describe what this build actually does. Everything below is true
 * of the code in this repository.
 */
const SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: 'What Revora stores',
    body: 'The motorcycles you add and everything you log against them: fuel fill-ups, odometer readings, maintenance rules and completions, services, parts, accessories, expenses, documents, warranties and condition checks. Your display name, your email address if you signed up with one, and your unit and currency preferences.',
  },
  {
    title: 'Where it is stored',
    body: 'On your device, and in your own private area of Revora’s Firebase project so the same records appear on the web. Access is enforced on the server: only your signed-in account can read or write your records. Photos you attach are stored in the same private area.',
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
    title: 'Working offline',
    body: 'Revora keeps a full copy of your records on your device so it works with no connection. Anything you log offline is saved locally and uploaded automatically when a connection returns.',
  },
  {
    title: 'The Pro assistant',
    body: 'On Revora Pro, a question you type into the assistant is sent to Revora’s server together with a summary of that motorcycle’s figures — its odometer, mileage, running costs, service status and recent fill-ups — and passed to a language model (Google Gemini, via OpenRouter) to phrase the answer. Only the summary is sent, never your documents, photos, registration or chassis numbers, and never your name or email. Your question and the answer are not stored: only the date, the model used and the number of tokens, so usage can be reconciled. The assistant is instructed to quote figures Revora has already calculated and never to compute its own. If you would rather nothing left your device, the Free assistant answers the same questions offline.',
  },
  {
    title: 'Ads on the free plan',
    body: 'The free plan shows ads supplied by Google AdMob. To do that, Google receives your device’s advertising ID and standard ad-request information such as your device model, language and approximate region derived from your connection. It never receives your motorcycles, fuel logs, documents or photos. You can reset or delete the advertising ID in Android Settings → Privacy → Ads, and Revora Pro removes ads entirely.',
  },
  {
    title: 'Feedback and support',
    body: 'If you send a message from More → Feedback & support, that message is relayed to Revora’s support workspace on Slack so it reaches a person. What is sent is the message itself, the email address you chose to include, your plan, your app version, your device model and your account identifier. Your motorcycles, fuel logs, documents and photos are never attached.',
  },
  {
    title: 'Deleting your data',
    body: 'Settings → Delete account permanently removes every motorcycle, log, service, part, expense, document and photo in your account, along with the account itself. There is no recovery afterwards. You can also export your fuel history at any time. Two things are deliberately kept: support messages you have already sent, because they have been delivered and cannot be recalled, and the record of any subscription payment, which Google and applicable accounting law require to be retained.',
  },
  {
    title: 'Contact',
    body: 'Questions about your data can be sent to the support address published on the Revora website.',
  },
];

export default function Privacy() {
  return (
    <Screen testID="screen-privacy">
      <ScreenHeader title="Privacy policy" subtitle="What Revora stores, where, and how to delete it" />
      <Stack gap={14}>
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <Txt role="rowTitle" style={{ marginBottom: 6 }}>
              {section.title}
            </Txt>
            <Txt role="body" tone="mut">
              {section.body}
            </Txt>
          </Card>
        ))}
        <View style={{ height: 8 }} />
      </Stack>
    </Screen>
  );
}

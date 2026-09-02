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
    body: 'Revora does not sell your data, does not share it with advertisers, and does not use your records to train anything. The in-app assistant runs entirely on your device and answers only from figures the app has already calculated — your records are not sent to any language model.',
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
    title: 'Deleting your data',
    body: 'Settings → Delete account permanently removes every motorcycle, log, service, part, expense, document and photo in your account, along with the account itself. There is no recovery afterwards. You can also export your fuel history at any time.',
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

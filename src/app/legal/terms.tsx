import React from 'react';
import { View } from 'react-native';

import { Card, Screen, ScreenHeader, Stack, Txt } from '@/components';

const SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: 'What Revora is',
    body: 'A record-keeping app for motorcycle owners. It calculates fuel consumption, running cost and maintenance timing from the records you enter.',
  },
  {
    title: 'What Revora is not',
    body: 'It is not a mechanical diagnosis and not a substitute for a qualified mechanic. Maintenance reminders are based on the intervals you set, not on the condition of your motorcycle. Ride safely and get anything you are unsure about checked properly.',
  },
  {
    title: 'Accuracy',
    body: 'Every figure Revora shows is calculated from what you logged. Consumption is measured between two full-tank fills; where there is not enough data, Revora says so rather than estimating. Incorrect entries produce incorrect figures — you can edit or delete any record and everything derived from it is recalculated.',
  },
  {
    title: 'Your account',
    body: 'You are responsible for keeping your sign-in details secure. An offline account keeps records on one device only until you add an email address.',
  },
  {
    title: 'Plans',
    body: 'The Free plan tracks one motorcycle with full history and no time limit. Pro adds multiple motorcycles, advanced statistics, CSV export and the assistant. Your plan is held on your account.',
  },
  {
    title: 'Changes',
    body: 'These terms may be updated as Revora develops. Material changes will be shown in the app.',
  },
];

export default function Terms() {
  return (
    <Screen testID="screen-terms">
      <ScreenHeader title="Terms of use" />
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

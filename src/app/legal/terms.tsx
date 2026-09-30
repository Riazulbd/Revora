import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Screen } from '@/components';
import {
  AccountDocHeader,
  AccountDocSection,
  AccountDocSummary,
  AccountDocTabs,
} from '@/features/settings/AccountDoc';

type Anchor = 'figures' | 'subscriptions' | 'warranty' | 'proof';

/** The board's four anchor chips, in board order. */
const TABS: readonly { value: Anchor; label: string }[] = [
  { value: 'figures', label: 'Your figures' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'warranty', label: 'No warranty' },
  { value: 'proof', label: 'Proof Pack' },
];

/**
 * The board's four sections first, verbatim, then the two the board does not
 * draw but the terms still need: who is responsible for the sign-in, and the
 * fact that these terms can change.
 */
const SECTIONS: readonly { id: Anchor | string; title: string; body: string }[] = [
  {
    id: 'figures',
    title: 'Your figures',
    body: 'Every figure Revora shows is calculated from what you logged. Consumption is measured between two full-tank fills; where there is not enough data, Revora says so rather than estimating. Incorrect entries produce incorrect figures — you can edit or delete any record and everything derived from it is recalculated.',
  },
  {
    id: 'subscriptions',
    title: 'Subscriptions',
    body: 'Pro is billed by Google Play. Renewal, cancellation and refunds happen in Play, not in the app. If Pro lapses, your records stay — screens that need Pro say so instead of showing them.',
  },
  {
    id: 'warranty',
    title: 'What Revora does not warrant',
    body: 'Revora is a logbook. It is not a mechanical inspection, not a diagnosis, and not advice about whether a motorcycle is safe to ride. Maintenance reminders repeat what you told them; they do not replace a mechanic’s judgement.',
  },
  {
    id: 'proof',
    title: 'Limits of the Proof Pack',
    body: 'The stamp certifies that Revora generated the document from the owner’s records at that moment — record count, dates covered, and a reference that fingerprints exactly those records. It says nothing about the motorcycle itself.',
  },
  {
    id: 'account',
    title: 'Your account',
    body: 'You are responsible for keeping your sign-in details secure. An offline account keeps records on one device only until you add an email address.',
  },
  {
    id: 'changes',
    title: 'Changes',
    body: 'These terms may be updated as Revora develops. Material changes will be shown in the app.',
  },
];

/**
 * Terms of use — account--06.
 *
 * The chips are anchors, not filters: the board draws every section on screen
 * with one chip lit, so tapping a chip jumps to its section rather than hiding
 * the others. That needs the scroll view itself, which is why this screen owns
 * one instead of letting `Screen` supply it.
 */
export default function Terms() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<string, number>>>({});
  const [anchor, setAnchor] = useState<Anchor>('figures');

  const jumpTo = (next: Anchor) => {
    setAnchor(next);
    const y = offsets.current[next];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
  };

  return (
    <Screen
      testID="screen-terms"
      scroll={false}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
    >
      <ScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 28 + insets.bottom,
        }}
      >
        <AccountDocHeader
          title={'What Revora promises,\nand what it doesn’t'}
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/dashboard');
          }}
          testID="cta-terms-back"
        />

        <AccountDocSummary testID="card-terms-summary">
          Revora calculates from what you log. Billing lives in Google Play. It is a logbook, not an
          inspection, and the Proof Pack certifies its own provenance — not the motorcycle.
        </AccountDocSummary>

        <AccountDocTabs options={TABS} value={anchor} onChange={jumpTo} testID="tabs-terms" />

        {SECTIONS.map((section, index) => (
          <View
            key={section.id}
            onLayout={(event) => {
              offsets.current[section.id] = event.nativeEvent.layout.y;
            }}
            style={{ marginTop: index === 0 ? 20 : 18, paddingHorizontal: 4 }}
          >
            <AccountDocSection title={section.title} body={section.body} />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

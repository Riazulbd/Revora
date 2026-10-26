import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ChipGroup, LinkButton, Screen, ScreenHeader, type SegmentedOption } from '@/components';
import {
  AccountDocSection,
  AccountDocSections,
  AccountDocSummary,
  AccountDocTitle,
} from '@/features/settings/AccountDoc';
import type { IsoDate } from '@/types';

/** The day this text last changed — shown on the board's "Last updated" chip. */
const LAST_UPDATED: IsoDate = '2026-10-12';

type Anchor = 'figures' | 'subscriptions' | 'warranty' | 'proof';

/** The board's four anchor chips, in board order. */
const TABS: readonly SegmentedOption<Anchor>[] = [
  { value: 'figures', label: 'Your figures' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'warranty', label: 'No warranty' },
  { value: 'proof', label: 'Proof Pack' },
];

/**
 * The board's four sections first, verbatim, then the two the board also
 * draws under them: who is responsible for the sign-in, and the fact that
 * these terms can change.
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
 * Terms of use (Figma `E7 Legal — Terms`).
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
          paddingHorizontal: 16,
          paddingBottom: 28 + insets.bottom,
          gap: 16,
        }}
      >
        <ScreenHeader
          title="Terms of use"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/dashboard');
          }}
          backTestID="cta-terms-back"
          style={{ marginBottom: 0 }}
        />

        <AccountDocTitle title={'What Revora promises,\nand what it doesn’t'} updatedOn={LAST_UPDATED} />

        <AccountDocSummary testID="card-terms-summary">
          Revora calculates from what you log. Billing lives in Google Play. It is a logbook, not an
          inspection, and the Proof Pack certifies its own provenance — not the motorcycle.
        </AccountDocSummary>

        <ChipGroup options={TABS} value={anchor} onChange={jumpTo} size="large" testID="tabs-terms" />

        <AccountDocSections>
          {SECTIONS.map((section) => (
            <View
              key={section.id}
              onLayout={(event) => {
                offsets.current[section.id] = event.nativeEvent.layout.y;
              }}
            >
              <AccountDocSection title={section.title} body={section.body} />
            </View>
          ))}
        </AccountDocSections>

        {/* Play requires the privacy policy to be reachable in-app, and this is
            the one legal screen a signed-in rider can open from the plan. */}
        <View style={{ alignItems: 'center' }}>
          <LinkButton label="Privacy policy" tone="acc" size="medium" onPress={() => router.push('/legal/privacy')} testID="link-privacy" />
        </View>
      </ScrollView>
    </Screen>
  );
}

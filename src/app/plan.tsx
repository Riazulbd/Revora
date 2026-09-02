import React from 'react';
import { View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  Icon,
  Screen,
  ScreenHeader,
  Stack,
  Txt,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { FREE_PLAN_BIKE_LIMIT } from '@/repositories';
import { formatLongDate , dateToIso } from '@/utils/date';
import { useTheme } from '@/theme';

const FREE_FEATURES = [
  `${FREE_PLAN_BIKE_LIMIT} motorcycle`,
  'Ad-supported',
  'Fuel tracking & full-to-full mileage',
  'Maintenance rules and reminders',
  'Expense ledger and standard charts',
  'Document vault, warranties and safety log',
  'Proof Pack export',
];

const PRO_FEATURES = [
  'Multiple motorcycles',
  'Advanced statistics & consumption charts',
  'CSV export of your fuel history',
  'Assistant',
  'No ads',
];

/**
 * Free / Pro.
 *
 * Billing is not connected — there is no payment provider wired into this build —
 * and the screen says exactly that rather than offering a button that cannot work
 * (requirement 83). Entitlement is read from the account, so the moment billing
 * grants Pro server-side, this screen reflects it with no app change.
 */
export default function Plan() {
  const { isPro, profile, bikes } = useGarage();

  const expiry = profile?.entitlement.expiresAt ?? null;

  return (
    <Screen testID="screen-plan">
      <ScreenHeader title="Free / Pro" />

      <Stack>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Txt role="cardTitle">Free</Txt>
            {isPro ? null : <Badge label="CURRENT PLAN" tone="neutral" />}
          </View>
          <FeatureList features={FREE_FEATURES} />
          <Txt role="micro" tone="mut" style={{ marginTop: 10 }}>
            You have {bikes.length} motorcycle{bikes.length === 1 ? '' : 's'} in your garage.
          </Txt>
        </Card>

        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Txt role="cardTitle">Pro</Txt>
            {isPro ? <Badge label="CURRENT PLAN" tone="accent" /> : null}
          </View>
          <FeatureList features={PRO_FEATURES} accent />

          {isPro ? (
            <Banner
              tone="good"
              icon="check"
              message={
                expiry === null
                  ? 'Pro is active on your account.'
                  : `Pro is active until ${formatLongDate(dateToIso(new Date(expiry)))}.`
              }
              style={{ marginTop: 14 }}
            />
          ) : (
            <>
              <Button
                label="Upgrade — billing not connected yet"
                disabled
                style={{ marginTop: 14 }}
                onPress={() => undefined}
                testID="cta-upgrade"
              />
              <Txt role="helper" tone="mut" style={{ marginTop: 10 }}>
                Revora has no payment provider connected in this build, so there is nothing to buy here yet. Pro
                is granted on your account, which means whichever store or web checkout is connected later
                unlocks it everywhere at once.
              </Txt>
            </>
          )}
        </Card>

        <Txt role="helper" tone="mut">
          Your plan lives on your Revora account, not on this phone — so it follows you to the web and to a new
          device, and no amount of reinstalling changes it either way.
        </Txt>
      </Stack>
    </Screen>
  );
}

function FeatureList({ features, accent = false }: { features: readonly string[]; accent?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 9 }}>
      {features.map((feature) => (
        <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Icon name="checkLarge" size={15} color={accent ? c.acc : c.good} strokeWidth={2.4} />
          <Txt role="smallStrong" style={{ flex: 1 }}>
            {feature}
          </Txt>
        </View>
      ))}
    </View>
  );
}

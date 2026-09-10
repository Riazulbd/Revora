import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

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
import { useBilling } from '@/features/billing/BillingProvider';
import { billingAvailable } from '@/features/billing/googlePlay';
import { offerPrice } from '@/features/billing/presentation';

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

/** Prices come from Play; the current plan comes from the server entitlement. */
export default function Plan() {
  const { isPro, profile, bikes, isPending } = useGarage();
  const billing = useBilling();
  const router = useRouter();
  const { c } = useTheme();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const offers = billing.product?.offers ?? [];
  const selected = offers.find(offer => offer.offerToken === selectedToken) ?? offers[0];
  const expiry = profile?.entitlement.expiresAt ?? null;
  const status = profile?.entitlement.subscriptionStatus;
  const googleSubscriber = profile?.entitlement.source === 'google_play';
  const subscriptionMessage = status === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
    ? 'There is a payment problem. Pro remains available during your grace period. Update your payment method in Google Play.'
    : status === 'SUBSCRIPTION_STATE_ON_HOLD'
      ? 'Your subscription is on hold. Update your payment method in Google Play to restore Pro.'
      : status === 'SUBSCRIPTION_STATE_PAUSED' ? 'Your subscription is paused. Resume it in Google Play to restore Pro.'
        : status === 'SUBSCRIPTION_STATE_CANCELED' && isPro ? 'Renewal is canceled. Pro remains available until the date shown.'
          : null;

  return (
    <Screen testID="screen-plan">
      <ScreenHeader title="Free / Pro" />

      <Stack>
        {isPending ? <Txt role="helper" tone="mut">Loading your account plan…</Txt> : null}
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
            {isPro || isPending ? null : <Badge label="CURRENT PLAN" tone="neutral" />}
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
            <Txt role="cardTitle">{billing.product?.title ?? 'Revora Pro'}</Txt>
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
              {billing.product?.description ? <Txt role="helper" tone="mut" style={{ marginTop: 14 }}>{billing.product.description}</Txt> : null}
              {billing.loading ? <Txt role="helper" tone="mut" style={{ marginTop: 14 }}>Loading Google Play plans and prices…</Txt> : null}
              {offers.map(offer => (
                <Pressable
                  key={offer.offerToken}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: offer.offerToken === selected?.offerToken }}
                  accessibilityLabel={offerPrice(offer)}
                  onPress={() => setSelectedToken(offer.offerToken)}
                  style={{ padding: 14, marginTop: 12, borderWidth: 1, borderRadius: 12,
                    borderColor: offer.offerToken === selected?.offerToken ? c.acc : c.brd }}
                >
                  <Txt role="smallStrong">{offerPrice(offer)}</Txt>
                  <Txt role="micro" tone="mut">
                    {offer.phases.at(-1)?.recurrenceMode === 1 ? 'Automatically renews. Cancel in Google Play.' : 'Prepaid access. Does not automatically renew.'}
                  </Txt>
                </Pressable>
              ))}
              <Button
                label={billing.pending ? 'Payment pending' : 'Upgrade to Pro'}
                loading={billing.busy}
                disabled={!billing.canPurchase || !selected || billing.loading || billing.pending || isPending}
                style={{ marginTop: 14 }}
                onPress={() => selected ? billing.upgrade(selected.offerToken) : undefined}
                testID="cta-upgrade"
              />
              {!billingAvailable ? <Txt role="helper" tone="mut" style={{ marginTop: 10 }}>Subscribe using the Revora Android app from Google Play.</Txt>
                : !billing.canPurchase ? <Button label="Sign in or create an account" variant="secondary" style={{ marginTop: 10 }} onPress={() => router.push('/settings')} /> : null}
            </>
          )}
          {subscriptionMessage ? <Txt role="helper" style={{ marginTop: 12 }}>{subscriptionMessage}</Txt> : null}
          {googleSubscriber ? <Button label="Manage Subscription" variant="secondary" onPress={billing.manage} style={{ marginTop: 12 }} testID="cta-manage-subscription" /> : null}
          {billing.message ? <Txt role="helper" style={{ marginTop: 12 }} testID="billing-status">{billing.message}</Txt> : null}
          {billing.error ? <Txt role="helper" style={{ marginTop: 12 }} testID="billing-error">{billing.error}</Txt> : null}
          {billing.canPurchase ? <Button label="Restore purchases" variant="secondary" onPress={billing.restore} loading={billing.busy} style={{ marginTop: 12 }} testID="cta-restore-purchases" /> : null}
          {billingAvailable && !isPro ? <Button label="Reload plans and prices" variant="ghost" onPress={billing.reload} disabled={billing.loading || billing.busy} style={{ marginTop: 10 }} /> : null}
          <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>Payment is handled by Google Play. Review the price and billing terms in checkout before confirming.</Txt>
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

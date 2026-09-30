import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Banner,
  Button,
  Card,
  Eyebrow,
  Icon,
  LinkButton,
  ProBadge,
  Screen,
  ScreenHeader,
  Txt,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { formatLongDate, dateToIso } from '@/utils/date';
import { NO_VALUE } from '@/utils/format';
import { fontFamily, useTheme } from '@/theme';
import { useBilling } from '@/features/billing/BillingProvider';
import { ASSISTANT_COMING_SOON, proFeatureLabel } from '@/features/premium/comingSoon';
import { billingAvailable } from '@/features/billing/googlePlay';
import {
  offerHasIntroductoryPhase,
  offerHeadlinePrice,
  offerPrice,
  offerTermLabel,
  planNotice,
} from '@/features/billing/presentation';
import type { PlayOffer } from '@/features/billing/googlePlay';

/**
 * Your plan (`money---expense-allowance-pro--03` and `--04`).
 *
 * Two rules the whole screen is built around:
 *  · Pro comes from `entitlements/{uid}` — the screen reflects the entitlement,
 *    it never decides it. Nothing here writes a Pro flag.
 *  · Every amount is Google's own `formattedPrice`. We never format, convert or
 *    hardcode a price, and a plan whose price Play has not sent yet shows `—`
 *    rather than a number we made up.
 *
 * The three failures the board draws all render in one Banner slot above the
 * plan cards, in the order `planNotice()` ranks them.
 */
const PRO_FEATURES = [
  'Multiple motorcycles',
  'Advanced statistics and consumption charts',
  'CSV export of fuel history',
  'No ads',
  // Named, but honestly: a rider deciding whether to subscribe must not be
  // sold something they cannot use today.
  proFeatureLabel('The Assistant', ASSISTANT_COMING_SOON),
];

export default function Plan() {
  const { isPro, profile, isPending } = useGarage();
  const billing = useBilling();
  const router = useRouter();
  const { c } = useTheme();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const offers = billing.product?.offers ?? [];
  const selected = offers.find((offer) => offer.offerToken === selectedToken) ?? offers[0];
  const expiry = profile?.entitlement.expiresAt ?? null;
  const status = profile?.entitlement.subscriptionStatus;
  const googleSubscriber = profile?.entitlement.source === 'google_play';

  const subscriptionMessage =
    status === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
      ? 'There is a payment problem. Pro remains available during your grace period. Update your payment method in Google Play.'
      : status === 'SUBSCRIPTION_STATE_ON_HOLD'
        ? 'Your subscription is on hold. Update your payment method in Google Play to restore Pro.'
        : status === 'SUBSCRIPTION_STATE_PAUSED'
          ? 'Your subscription is paused. Resume it in Google Play to restore Pro.'
          : status === 'SUBSCRIPTION_STATE_CANCELED' && isPro
            ? 'Renewal is canceled. Pro remains available until the date shown.'
            : null;

  const notice = planNotice({ pending: billing.pending, error: billing.error });
  const noticeText = { fontFamily: fontFamily[500], fontSize: 12.5, lineHeight: 18.75, color: c.ink };

  return (
    <Screen testID="screen-plan">
      <ScreenHeader title="Your plan" />

      {notice ? (
        <Banner
          tone={notice.kind === 'account_mismatch' ? 'bad' : 'warn'}
          icon={notice.kind === 'account_mismatch' ? 'alertCircle' : notice.kind === 'pending' ? 'clock' : 'alertTriangle'}
          compact
          lead={notice.lead}
          message={notice.message}
          style={{ marginBottom: 12 }}
          testID={notice.kind === 'pending' ? 'banner-payment-pending' : 'billing-error'}
          {...(notice.retry
            ? {
                action: (
                  <>
                    <Txt
                      accessibilityRole="link"
                      onPress={billing.reload}
                      testID="link-play-retry"
                      style={{ ...noticeText, fontFamily: fontFamily[700], color: c.acc }}
                    >
                      try again
                    </Txt>
                    <Txt style={noticeText}>. Your current plan is unaffected.</Txt>
                  </>
                ),
              }
            : {})}
        />
      ) : null}

      {billing.message ? (
        <Banner
          variant="plain"
          message={billing.message}
          style={{ marginBottom: 12 }}
          testID="billing-status"
        />
      ) : null}

      {!billingAvailable ? (
        <Banner
          variant="plain"
          message="Subscribe using the Revora Android app from Google Play."
          style={{ marginBottom: 12 }}
          testID="banner-play-unavailable"
        />
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexShrink: 1 }}>
            <Eyebrow>Current plan</Eyebrow>
            <Txt role="cardTitle" style={{ marginTop: 4 }} testID="text-current-plan">
              {isPro ? 'Pro · every motorcycle' : 'Free · one motorcycle'}
            </Txt>
            {isPro && expiry !== null ? (
              <Txt role="meta" tone="mut" style={{ marginTop: 2 }}>
                Active until {formatLongDate(dateToIso(new Date(expiry)))}
              </Txt>
            ) : null}
          </View>
          {isPro ? <ProBadge wide /> : <Badge label="FREE" tone="neutral" size="wide" />}
        </View>
      </Card>

      {subscriptionMessage ? (
        <Banner tone="warn" compact message={subscriptionMessage} style={{ marginTop: 12 }} testID="banner-subscription-state" />
      ) : null}

      <Card style={{ marginTop: 12, gap: 11 }}>
        <Eyebrow>Pro adds</Eyebrow>
        {PRO_FEATURES.map((feature) => (
          <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 15,
                height: 15,
                borderRadius: 7.5,
                backgroundColor: c.accS,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={9} color={c.acc} strokeWidth={3} />
            </View>
            <Txt role="body" style={{ flex: 1 }}>
              {feature}
            </Txt>
          </View>
        ))}
      </Card>

      {isPro ? (
        <>
          <Banner
            tone="good"
            compact
            message={
              expiry === null
                ? 'Pro is active on your account.'
                : `Pro is active until ${formatLongDate(dateToIso(new Date(expiry)))}.`
            }
            style={{ marginTop: 12 }}
            testID="banner-pro-active"
          />
          {googleSubscriber ? (
            <Button
              label="Manage subscription"
              variant="secondary"
              onPress={billing.manage}
              style={{ marginTop: 12 }}
              testID="cta-manage-subscription"
            />
          ) : null}
        </>
      ) : (
        <>
          {billing.loading ? (
            <Txt role="meta" tone="mut" align="center" style={{ marginTop: 16 }} testID="text-prices-loading">
              Loading Google Play plans and prices…
            </Txt>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              {offers.map((offer) => (
                <OfferCard
                  key={offer.offerToken}
                  offer={offer}
                  selected={offer.offerToken === selected?.offerToken}
                  onPress={() => setSelectedToken(offer.offerToken)}
                />
              ))}
            </View>
          )}

          <Button
            label={billing.pending ? 'Payment pending' : 'Upgrade to Pro'}
            loading={billing.busy}
            disabled={!billing.canPurchase || !selected || billing.loading || billing.pending || isPending}
            style={{ marginTop: 14 }}
            onPress={() => (selected ? billing.upgrade(selected.offerToken) : undefined)}
            testID="cta-upgrade"
          />

          {billingAvailable && !billing.canPurchase ? (
            <Button
              label="Sign in or create an account"
              variant="secondary"
              style={{ marginTop: 10 }}
              onPress={() => router.push('/settings')}
              testID="cta-sign-in-to-subscribe"
            />
          ) : null}
        </>
      )}

      <Txt role="meta" tone="mut" align="center" style={{ marginTop: 12 }}>
        Your plan lives on your Revora account, not this phone.
      </Txt>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 10 }}>
        {billing.canPurchase ? (
          <LinkButton label="Restore purchases" size="large" onPress={billing.restore} testID="cta-restore-purchases" />
        ) : null}
        {billingAvailable && !isPro ? (
          <LinkButton label="Reload prices" size="large" onPress={billing.reload} testID="cta-reload-prices" />
        ) : null}
      </View>

      <Txt role="helper" tone="mut" align="center" style={{ marginTop: 12 }}>
        Payment is handled by Google Play. Review the price and billing terms in checkout before confirming.
      </Txt>
    </Screen>
  );
}

/** One price tile from the board: 16px radius, 14px padding, the chosen one outlined in the accent at 1.5px. */
function OfferCard({ offer, selected: isSelected, onPress }: { offer: PlayOffer; selected: boolean; onPress: () => void }) {
  const { c, radius } = useTheme();
  const term = offerTermLabel(offer);
  const price = offerHeadlinePrice(offer);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${term}, ${offerPrice(offer)}`}
      onPress={onPress}
      testID={`offer-${offer.basePlanId}`}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        borderRadius: radius.listCard,
        backgroundColor: c.sur,
        borderWidth: isSelected ? 1.5 : 1,
        borderColor: isSelected ? c.acc : c.brd,
        padding: 14,
        alignItems: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt role="linkLarge" align="center">
        {term}
      </Txt>
      <Txt role="cardTitle" align="center" style={{ marginTop: 4 }}>
        {price ?? NO_VALUE}
      </Txt>
      <Txt role="micro" tone="mut" align="center" style={{ marginTop: 2 }}>
        {offerHasIntroductoryPhase(offer) ? offerPrice(offer) : 'from Google Play'}
      </Txt>
    </Pressable>
  );
}

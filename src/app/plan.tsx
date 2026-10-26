import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Banner,
  Button,
  Card,
  HeroCard,
  HeroHead,
  Icon,
  LinkButton,
  Screen,
  ScreenHeader,
  Sparkline,
  Txt,
} from '@/components';
import { mileageSparkline } from '@/calculations/dashboard';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatLongDate, dateToIso } from '@/utils/date';
import { formatMileage, NO_VALUE } from '@/utils/format';
import { fontFamily, useTheme } from '@/theme';
import { useBilling } from '@/features/billing/BillingProvider';
import { ASSISTANT_COMING_SOON } from '@/features/premium/comingSoon';
import { billingAvailable } from '@/features/billing/googlePlay';
import { offerHeadlinePrice, offerPrice, offerTermLabel, planNotice } from '@/features/billing/presentation';
import type { PlayOffer } from '@/features/billing/googlePlay';

/**
 * Your plan (Figma `02 Your plan — Pro paywall`).
 *
 * Two rules the whole screen is built around:
 *  · Pro comes from `entitlements/{uid}` — the screen reflects the entitlement,
 *    it never decides it. Nothing here writes a Pro flag.
 *  · Every amount is Google's own `formattedPrice`. We never format, convert or
 *    hardcode a price, and a plan whose price Play has not sent yet shows `—`
 *    rather than a number we made up.
 *
 * The failures the store can have all render in one Banner slot under the
 * header, in the order `planNotice()` ranks them.
 */
const PRO_FEATURES: readonly { label: string; soon?: boolean }[] = [
  { label: 'Multiple motorcycles' },
  { label: 'Advanced statistics and charts' },
  { label: 'CSV export of fuel history' },
  { label: 'No ads' },
  // Named, but honestly: a rider deciding whether to subscribe must not be
  // sold something they cannot use today.
  { label: 'The Assistant', soon: ASSISTANT_COMING_SOON },
];

export default function Plan() {
  const { isPro, profile, isPending, bikes, activeBike, units } = useGarage();
  const { analytics } = useGarageData();
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
  const trend = analytics ? mileageSparkline(analytics.mileage.intervals, units.mileage, 12) : [];
  const otherBike = bikes.find((bike) => bike.id !== activeBike?.id) ?? null;

  return (
    <Screen wash testID="screen-plan" contentStyle={{ gap: 16 }}>
      <ScreenHeader title="Your plan" icon="x" style={{ marginBottom: 0 }} />

      {notice ? (
        <Banner
          tone={notice.kind === 'account_mismatch' ? 'bad' : 'warn'}
          icon={notice.kind === 'account_mismatch' ? 'circleAlert' : notice.kind === 'pending' ? 'clock' : 'triangleAlert'}
          compact
          lead={notice.lead}
          message={notice.retry ? `${notice.message} try again below. Your current plan is unaffected.` : notice.message}
          {...(notice.retry ? { link: { label: 'Reload', onPress: billing.reload, testID: 'link-play-retry' } } : {})}
          testID={notice.kind === 'pending' ? 'banner-payment-pending' : 'billing-error'}
        />
      ) : null}

      {billing.message ? <Banner variant="plain" message={billing.message} testID="billing-status" /> : null}

      {!billingAvailable ? (
        <Banner variant="plain" message="Subscribe using the Revora Android app from Google Play." testID="banner-play-unavailable" />
      ) : null}

      {/* Figma `Hero`: the Pro badge, the headline, where the rider stands. */}
      <View style={{ alignItems: 'center', paddingTop: 8, gap: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: c.sur,
            borderWidth: 1,
            borderColor: c.accBrd,
          }}
        >
          <Icon name="sparkle" size={16} color={c.accText} />
          <Txt role="smallStrong" tone="acc">
            Revora Pro
          </Txt>
        </View>
        <Txt role="display" align="center">
          Every bike. Every number.
        </Txt>
        <Txt role="body" tone="mut" align="center" testID="text-current-plan">
          {isPro ? 'You’re on Pro · every motorcycle' : 'You’re on Free · one motorcycle'}
          {isPro && expiry !== null ? ` · until ${formatLongDate(dateToIso(new Date(expiry)))}` : ''}
        </Txt>
      </View>

      {subscriptionMessage ? <Banner tone="warn" compact message={subscriptionMessage} testID="banner-subscription-state" /> : null}

      {/* Figma `Preview — dark accent`: what the Pro charts look like, drawn
          from the rider's own log, and a tile per bike. */}
      <HeroCard padding={18} gap={14} testID="card-pro-preview">
        <HeroHead eyebrow="Consumption · 6 months" chip="PRO" chipAccent />
        {trend.length >= 2 ? (
          <Sparkline values={trend} height={72} color={c.heroAcc} dotFill={c.heroTo} testID="chart-pro-preview" />
        ) : (
          <View style={{ height: 72, justifyContent: 'center' }}>
            <Txt role="meta" color={c.heroMut}>
              Your consumption trend draws here once two full-tank fills measure it.
            </Txt>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BikeTile
            name={activeBike?.nickname ?? 'Your bike'}
            figure={analytics?.mileage.average ? formatMileage(analytics.mileage.average, units.mileage) : NO_VALUE}
          />
          <BikeTile
            name={otherBike?.nickname ?? 'Your next bike'}
            figure={otherBike ? 'tracked with Pro' : 'add it with Pro'}
            muted
          />
        </View>
      </HeroCard>

      {/* Figma `Features`. */}
      <Card style={{ gap: 12 }}>
        <Txt role="cardTitle">What you get</Txt>
        {PRO_FEATURES.map((feature) => (
          <View key={feature.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: feature.soon ? c.sur2 : c.goodS,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={feature.soon ? 'clock' : 'check'} size={16} color={feature.soon ? c.mut : c.good} />
            </View>
            <Txt role="bullet" style={{ flex: 1 }}>
              {feature.label}
            </Txt>
            {feature.soon ? <Badge label="Coming soon" tone="neutral" size="chip" /> : null}
          </View>
        ))}
      </Card>

      {isPro ? (
        <>
          <Banner
            tone="good"
            compact
            message={expiry === null ? 'Pro is active on your account.' : `Pro is active until ${formatLongDate(dateToIso(new Date(expiry)))}.`}
            testID="banner-pro-active"
          />
          {googleSubscriber ? (
            <Button label="Manage subscription" variant="secondary" size="large" onPress={billing.manage} testID="cta-manage-subscription" />
          ) : null}
        </>
      ) : (
        <>
          {billing.loading ? (
            <Txt role="meta" tone="mut" align="center" testID="text-prices-loading">
              Loading Google Play plans and prices…
            </Txt>
          ) : offers.length > 0 ? (
            <View style={{ gap: 10 }}>
              {offers.map((offer) => (
                <OfferCard
                  key={offer.offerToken}
                  offer={offer}
                  selected={offer.offerToken === selected?.offerToken}
                  onPress={() => setSelectedToken(offer.offerToken)}
                />
              ))}
            </View>
          ) : null}

          <View style={{ alignItems: 'center', gap: 10 }}>
            <Button
              label={billing.pending ? 'Payment pending' : 'Upgrade to Pro'}
              {...(selected && !billing.pending
                ? { subLabel: `${offerTermLabel(selected)} · ${offerHeadlinePrice(selected) ?? NO_VALUE}` }
                : {})}
              size="xlarge"
              loading={billing.busy}
              disabled={!billing.canPurchase || !selected || billing.loading || billing.pending || isPending}
              style={{ alignSelf: 'stretch', height: 60 }}
              onPress={() => (selected ? billing.upgrade(selected.offerToken) : undefined)}
              testID="cta-upgrade"
            />
            <Txt role="helper" tone="mut" align="center">
              Billed by Google Play. Cancel anytime in Play Store.
            </Txt>
          </View>

          {billingAvailable && !billing.canPurchase ? (
            <Button
              label="Sign in or create an account"
              variant="secondary"
              size="large"
              onPress={() => router.push('/settings')}
              testID="cta-sign-in-to-subscribe"
            />
          ) : null}
        </>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        {billing.canPurchase ? (
          <>
            <LinkButton label="Restore purchase" tone="ink" onPress={billing.restore} testID="cta-restore-purchases" />
            <Txt role="link" color={c.brdStrong}>
              ·
            </Txt>
          </>
        ) : null}
        <LinkButton label="Terms & privacy" tone="ink" onPress={() => router.push('/legal/terms')} testID="link-terms" />
      </View>
    </Screen>
  );
}

/** Figma `Bike`: a `#23272C` tile with the bike's name over its mileage in green. */
function BikeTile({ name, figure, muted = false }: { name: string; figure: string; muted?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.heroTile, borderRadius: 16, padding: 12, gap: 2 }}>
      <Txt role="mediumStrong" color={c.heroInk} numberOfLines={1}>
        {name}
      </Txt>
      <Txt role="micro" color={muted ? c.heroMut : c.heroGood} numberOfLines={1}>
        {figure}
      </Txt>
    </View>
  );
}

/**
 * Figma `Offer`: a radio card. The chosen one sits on `#FFF7F3` inside a 2px
 * accent border with a filled radio; the others are white with a hairline.
 * The term (`600 16px`), Google's own price ladder under it (`400 13px`),
 * and the recurring price on the right (`700 18px`).
 */
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: radius.smallCard,
        backgroundColor: isSelected ? c.accSel : c.sur,
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? c.acc : c.brd,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: isSelected ? c.acc : 'transparent',
          borderWidth: isSelected ? 0 : 2,
          borderColor: c.brdStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isSelected ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.5} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="cardTitle">{term}</Txt>
        <Txt role="bodySmall" tone="mut" numberOfLines={2}>
          {offerPrice(offer)}
        </Txt>
      </View>
      <Txt style={{ fontFamily: fontFamily[700], fontSize: 18, lineHeight: 23, color: c.ink }}>{price ?? NO_VALUE}</Txt>
    </Pressable>
  );
}

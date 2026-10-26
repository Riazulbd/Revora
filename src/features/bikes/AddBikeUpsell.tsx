import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Icon, Sheet, Txt } from '@/components';
import { useBilling } from '@/features/billing/BillingProvider';
import { ASSISTANT_COMING_SOON, proFeatureLabel } from '@/features/premium/comingSoon';
import { fontFamily, useTheme } from '@/theme';

/**
 * The offer a rider meets when they try to add a second motorcycle.
 *
 * It sits between the tap and the plan screen deliberately. Sending someone
 * straight to a price list answers a question they did not ask; this answers
 * the one they did — "can I track my other bike?" — and then offers the plan.
 *
 * Two rules it must not break. The price is whatever Google Play returned for
 * the cheapest offer, formatted by Play, never by us and never hardcoded; when
 * Play has not answered yet the line is simply absent, because inventing a
 * figure here would be inventing a price. And the plan lives on the account,
 * not the phone — riders ask, and the answer belongs where they are asking.
 */
const BENEFITS = [
  'Every motorcycle you own, switchable anywhere',
  'Advanced statistics and consumption charts',
  'CSV export of your fuel history',
  'No ads',
  proFeatureLabel('The Assistant', ASSISTANT_COMING_SOON),
];

/** The plan screen's tick: a 28px soft-green disc with the green check. */
function BenefitTick() {
  const { c } = useTheme();
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.goodS, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="check" size={16} color={c.good} />
    </View>
  );
}

export function AddBikeUpsell({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const billing = useBilling();

  /**
   * The cheapest advertised price across the offers Play returned, taken
   * verbatim. `formattedPrice` already carries the currency and the locale's
   * digits — Bengali numerals in Bangladesh — so it is never reformatted.
   */
  const fromPrice =
    billing.product?.offers
      .flatMap((offer) => offer.phases)
      .filter((phase) => phase.recurrenceMode === 1)
      .map((phase) => phase.formattedPrice)
      .at(0) ?? null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Ride more than one?"
      subtitle="Pro puts every bike on one account:"
      testID="sheet-add-bike-pro"
    >
      <View style={{ gap: 12 }}>
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BenefitTick />
            <Txt role="bullet" style={{ flex: 1 }}>
              {benefit}
            </Txt>
          </View>
        ))}
      </View>

      {fromPrice === null ? null : (
        <Txt role="meta" tone="mut" style={{ marginTop: 16, lineHeight: 18 }} testID="upsell-price">
          From{' '}
          <Txt role="meta" style={{ fontFamily: fontFamily[600], color: c.ink }}>
            {fromPrice}
          </Txt>{' '}
          · price from Google Play · lives on your Revora account, not this phone
        </Txt>
      )}

      <Button
        label="See Pro plans"
        size="xlarge"
        onPress={() => {
          onClose();
          router.push('/plan');
        }}
        style={{ marginTop: 16 }}
        testID="cta-see-plans"
      />
      <Button
        label="Not now"
        variant="ghost"
        tone="mut"
        size="small"
        onPress={onClose}
        style={{ marginTop: 4 }}
        testID="cta-not-now"
      />
    </Sheet>
  );
}

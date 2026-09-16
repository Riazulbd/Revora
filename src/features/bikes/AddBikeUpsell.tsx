import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Icon, Sheet, Txt } from '@/components';
import { useBilling } from '@/features/billing/BillingProvider';
import { useTheme } from '@/theme';

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
  'The Assistant, and no ads',
];

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
    <Sheet visible={visible} onClose={onClose} title="Ride more than one?" testID="sheet-add-bike-pro">
      <Txt role="body" tone="mut" style={{ marginBottom: 14 }}>
        Pro puts every bike on one account:
      </Txt>

      <View style={{ gap: 11, marginBottom: 18 }}>
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="check" size={16} color={c.acc} strokeWidth={2.6} />
            <Txt role="bullet" style={{ flex: 1 }}>
              {benefit}
            </Txt>
          </View>
        ))}
      </View>

      {fromPrice === null ? null : (
        <Txt role="metaSmall" tone="mut" style={{ marginBottom: 16 }} testID="upsell-price">
          From <Txt role="smallStrong">{fromPrice}</Txt> · price from Google Play · lives on your Revora
          account, not this phone
        </Txt>
      )}

      <Button
        label="See Pro plans"
        onPress={() => {
          onClose();
          router.push('/plan');
        }}
        testID="cta-see-plans"
      />
      <Button
        label="Not now"
        variant="ghost"
        size="medium"
        onPress={onClose}
        style={{ marginTop: 8 }}
        testID="cta-not-now"
      />
    </Sheet>
  );
}

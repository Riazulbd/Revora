import React, { useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useRouter } from 'expo-router';

import { LinkButton, Txt } from '@/components';
import { useTheme } from '@/theme';
import { DASHBOARD_BANNER_UNIT_ID, useAds } from './useAds';

/**
 * The design's Free-plan ad slot, backed by a real AdMob banner.
 *
 * The frame is the approved card: dashed border, the AD chip, "Sponsored ·
 * Revora Free" and the "Remove ads" link to the plan screen. The creative
 * itself comes from AdMob. Pro riders never render this component, and a banner
 * that fails to load collapses the card entirely rather than leaving a hole —
 * an ad may never cost the rider layout or attention it hasn't earned.
 *
 * On emulators and registered test devices AdMob serves test creatives
 * automatically, which keeps development inside AdMob policy.
 */
export function DashboardAdCard() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const { ready } = useAds(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!ready || failed) return null;

  return (
    <View
      style={{
        backgroundColor: c.sur,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.brd,
        borderRadius: radius.card,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
        // Collapsed until the creative arrives, so nothing jumps.
        display: loaded ? 'flex' : 'none',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            borderWidth: 1,
            borderColor: c.brd,
            borderRadius: 5,
            paddingHorizontal: 5,
            paddingVertical: 3,
          }}
        >
          <Txt role="pro" tone="mut">
            AD
          </Txt>
        </View>
        <Txt role="micro" tone="mut" style={{ flex: 1, opacity: 0.75 }}>
          Sponsored · Revora Free
        </Txt>
        <LinkButton label="Remove ads" onPress={() => router.push('/plan')} testID="link-remove-ads" />
      </View>

      <View style={{ alignItems: 'center', overflow: 'hidden', borderRadius: radius.tile }}>
        <BannerAd
          unitId={DASHBOARD_BANNER_UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    </View>
  );
}

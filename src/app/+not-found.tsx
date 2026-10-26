import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Icon, Screen, Txt } from '@/components';
import { fontFamily, useTheme } from '@/theme';

/**
 * Not found (Figma `A6 System — Not found`).
 *
 * No header and no card: the whole thing sits centred on the page, names the
 * likeliest cause rather than the link, and offers the two places the rider
 * was probably trying to reach.
 */
export default function NotFound() {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <Screen testID="screen-not-found" scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accS, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mapPinOff" size={28} color={c.accBright} />
        </View>
        <Txt align="center" style={{ fontFamily: fontFamily[600], fontSize: 18, lineHeight: 23, color: c.ink }}>
          That screen doesn&rsquo;t exist
        </Txt>
        <Txt role="body" tone="mut" align="center">
          Usually a deleted record. If it was a fill you were after, the fuel list has everything that&rsquo;s left.
        </Txt>
        <View style={{ alignSelf: 'stretch', gap: 10, paddingTop: 12 }}>
          <Button
            label="Go to Dashboard"
            icon="house"
            size="xlarge"
            onPress={() => router.replace('/(tabs)/dashboard')}
            testID="cta-not-found-dashboard"
          />
          <Button
            label="Fuel list"
            icon="fuel"
            variant="secondary"
            size="xlarge"
            onPress={() => router.replace('/(tabs)/fuel')}
            testID="cta-not-found-fuel"
          />
        </View>
      </View>
    </Screen>
  );
}

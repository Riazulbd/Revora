import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Screen, Txt } from '@/components';
import { fontFamily, useTheme } from '@/theme';

/**
 * Not found — account--04, lower board.
 *
 * No header and no card: the board centres the whole thing on the page, names
 * the likeliest cause rather than the link, and offers the two places the
 * rider was probably trying to reach.
 */
export default function NotFound() {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <Screen testID="screen-not-found" scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <Txt align="center" style={{ fontFamily: fontFamily[700], fontSize: 17, color: c.ink }}>
          That screen doesn&rsquo;t exist
        </Txt>
        <Txt
          align="center"
          style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 20.15, color: c.mut, maxWidth: 280 }}
        >
          Usually a deleted record. If it was a fill you were after, the fuel list has everything that&rsquo;s
          left.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label="Go to Dashboard"
            size="medium"
            onPress={() => router.replace('/(tabs)/dashboard')}
            style={{ paddingHorizontal: 20 }}
            testID="cta-not-found-dashboard"
          />
          <Button
            label="Fuel list"
            variant="secondary"
            size="medium"
            onPress={() => router.replace('/(tabs)/fuel')}
            style={{ paddingHorizontal: 20 }}
            testID="cta-not-found-fuel"
          />
        </View>
      </View>
    </Screen>
  );
}

import React from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Divider,
  EmptyState,
  ErrorState,
  Screen,
  ScreenHeader,
  SkeletonList,
  Txt,
} from '@/components';
import { odometerSourceLabel } from '@/calculations/odometer';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatShortDate } from '@/utils/date';
import { formatDistance } from '@/utils/format';
import { useTheme } from '@/theme';

/**
 * Odometer history.
 *
 * Readings from fuel logs, services and parts are derived from those records
 * rather than copied, so a deleted fuel log takes its reading with it and the
 * history can never disagree with the log (requirement 63).
 *
 * The list is virtualised: a rider with a few years of fuel logs has well over a
 * thousand readings here, and rendering them all at once would jank (requirement 59).
 */
export default function OdometerHistory() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const points = analytics?.odometer.points ?? [];

  if (error) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <SkeletonList count={5} height={52} />
      </Screen>
    );
  }

  if (points.length === 0) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <EmptyState
          icon="dashboard"
          title="No readings yet"
          message="Readings appear here from fuel logs, services and manual updates."
          primaryAction={{ label: 'Log a fill-up', onPress: () => router.push('/fuel/add') }}
          variant="page"
          testID="empty-odometer"
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <ScreenHeader title="Odometer history" />
      </View>

      <FlatList
        testID="screen-odometer"
        data={points}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          // The design shows one card containing every row. Virtualising means
          // building that card out of the rows themselves: the surface runs
          // through all of them and only the ends are rounded.
          const first = index === 0;
          const last = index === points.length - 1;
          return (
            <View
              style={{
                backgroundColor: c.sur,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderTopWidth: first ? 1 : 0,
                borderBottomWidth: last ? 1 : 0,
                borderColor: c.brd,
                borderTopLeftRadius: first ? radius.listCard : 0,
                borderTopRightRadius: first ? radius.listCard : 0,
                borderBottomLeftRadius: last ? radius.listCard : 0,
                borderBottomRightRadius: last ? radius.listCard : 0,
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingHorizontal: 16,
              }}
            >
              <Txt role="rowTitle">{formatDistance(item.metres, units.distance)}</Txt>
              <Txt role="meta" tone="mut" numberOfLines={1}>
                {formatShortDate(item.date)} · {odometerSourceLabel(item.source)}
              </Txt>
            </View>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={{ backgroundColor: c.sur, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.brd }}>
            <Divider inset={16} />
          </View>
        )}
        ListFooterComponent={
          <Txt role="helper" tone="mut" style={{ marginTop: 14 }}>
            Readings come from fuel logs, services and manual updates — every source is kept so distances stay
            auditable.
          </Txt>
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={16}
        maxToRenderPerBatch={20}
        windowSize={9}
      />
    </View>
  );
}

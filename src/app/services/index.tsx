import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ErrorState,
  Button,
  Card,
  EmptyState,
  RecordRow,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatCurrency, formatDistance } from '@/utils/format';
import { formatLongDate } from '@/utils/date';

export default function ServiceHistory() {
  const router = useRouter();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const services = analytics?.services.all ?? [];

  if (error) {
    return (
      <Screen testID="screen-services">
        <ScreenHeader title="Service history" />
        <ErrorState
          message={error.message}
          onRetry={() => void refetch()}
          variant="page"
        />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-services">
        <ScreenHeader title="Service history" />
        <SkeletonList count={4} height={88} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-services">
      <ScreenHeader
        title="Service history"
        action={
          <Button
            label="Add service"
            size="small"
            onPress={() => router.push('/services/add')}
            testID="cta-add-service"
          />
        }
      />

      {services.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="No services recorded"
          message="Every service you log here proves your bike's care at resale — and resets the maintenance rules it covered."
          primaryAction={{ label: 'Add a service', onPress: () => router.push('/services/add') }}
          variant="page"
          testID="empty-services"
        />
      ) : (
        <Stack gap={14}>
          <Card variant="flush" style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Txt role="smallStrong" tone="mut">
                {`All services · ${services.length} visit${services.length === 1 ? '' : 's'}`}
              </Txt>
              <Txt role="rowTitle" numberOfLines={1}>
                {formatCurrency(analytics?.services.totalSpendMinor ?? 0, analytics?.currency ?? 'BDT')}
              </Txt>
            </View>
          </Card>

          {/* Riders see a part in the parts list and the same money inside a
              service total, and reasonably suspect it was counted twice. */}
          <Txt role="helper" tone="mut">
            A service&apos;s total includes its parts — they don&apos;t appear twice in Costs.
          </Txt>

          <View style={{ gap: 12 }}>
            {services.map((service) => (
              <RecordRow
                key={service.id}
                title={service.title}
                subtitle={`${service.selfService ? 'Self-service' : (service.workshop ?? 'Workshop')} · ${formatLongDate(
                  service.date,
                )}${service.odometerMetres === null ? '' : ` · ${formatDistance(service.odometerMetres, units.distance)}`}`}
                caption={service.itemsSummary ?? undefined}
                onPress={() => router.push({ pathname: '/services/add', params: { id: service.id } })}
                trailing={
                  <Txt role="rowTitle" numberOfLines={1}>
                    {formatCurrency(service.totalCostMinor, service.currency)}
                  </Txt>
                }
                testID={`service-${service.id}`}
              />
            ))}
          </View>
        </Stack>
      )}
    </Screen>
  );
}

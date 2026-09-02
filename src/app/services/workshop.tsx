import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ErrorState,
  Badge,
  Card,
  EmptyState,
  Icon,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  StatTile,
  Txt,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatCurrency, formatDistance, NO_VALUE } from '@/utils/format';
import { formatLongDate } from '@/utils/date';
import { useTheme } from '@/theme';

/**
 * Workshop records — the estimate guard.
 *
 * For every workshop service that recorded a quote, this shows the quote, the
 * invoice and the difference between them, so a job that grew in the workshop is
 * visible rather than lost inside a single total.
 */
export default function WorkshopRecords() {
  const router = useRouter();
  const { c } = useTheme();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const records = (analytics?.services.all ?? []).filter((s) => !s.selfService);

  if (error) {
    return (
      <Screen testID="screen-workshop">
        <ScreenHeader title="Workshop records" />
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
      <Screen testID="screen-workshop">
        <ScreenHeader title="Workshop records" />
        <SkeletonList count={3} height={160} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-workshop">
      <ScreenHeader
        title="Workshop records"
        subtitle="Quote against invoice, so nothing gets replaced without asking"
      />

      {records.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="No workshop visits yet"
          message="Record a service at a workshop, add the quote you were given, and Revora will show you the difference when the invoice arrives."
          primaryAction={{ label: 'Add a service', onPress: () => router.push('/services/add') }}
          variant="page"
          testID="empty-workshop"
        />
      ) : (
        <Stack>
          {records.map((service) => {
            const estimate = service.estimate;
            const delta =
              estimate?.quoteMinor === null || estimate?.quoteMinor === undefined
                ? null
                : service.totalCostMinor - estimate.quoteMinor;

            return (
              <Card key={service.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <Txt role="rowTitle" style={{ flex: 1 }} numberOfLines={2}>
                    {service.title} · {service.workshop ?? 'Workshop'}
                  </Txt>
                  <Badge label="COMPLETED" tone="good" />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatTile
                    label="QUOTE"
                    value={
                      estimate?.quoteMinor == null
                        ? NO_VALUE
                        : formatCurrency(estimate.quoteMinor, service.currency)
                    }
                  />
                  <StatTile label="INVOICE" value={formatCurrency(service.totalCostMinor, service.currency)} />
                  <StatTile
                    label="DELTA"
                    value={
                      delta === null
                        ? NO_VALUE
                        : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatCurrency(Math.abs(delta), service.currency).replace(`${service.currency} `, '')}`
                    }
                    tone={delta === null ? 'ink' : delta > 0 ? 'bad' : delta < 0 ? 'good' : 'ink'}
                  />
                </View>

                {estimate?.odometerInMetres != null || estimate?.odometerOutMetres != null ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <Txt role="smallStrong" tone="mut">
                      Odometer in / out
                    </Txt>
                    <Txt role="smallStrong" numberOfLines={1}>
                      {estimate.odometerInMetres == null
                        ? NO_VALUE
                        : formatDistance(estimate.odometerInMetres, units.distance)}{' '}
                      →{' '}
                      {estimate.odometerOutMetres == null
                        ? NO_VALUE
                        : formatDistance(estimate.odometerOutMetres, units.distance)}
                    </Txt>
                  </View>
                ) : null}

                {estimate ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      marginTop: 12,
                    }}
                  >
                    <Icon
                      name={estimate.askBeforeReplacing ? 'checkCircle' : 'cross'}
                      size={16}
                      color={estimate.askBeforeReplacing ? c.good : c.mut}
                      strokeWidth={1.9}
                    />
                    <Txt role="metaSmall" tone="mut" style={{ flex: 1 }}>
                      {estimate.askBeforeReplacing
                        ? 'Workshop agreed to confirm extra work before doing it'
                        : 'No confirm-before-replace agreement recorded'}
                    </Txt>
                  </View>
                ) : null}

                {estimate && estimate.approvedWork.length > 0 ? (
                  <View style={{ gap: 8, marginTop: 12 }}>
                    <Txt role="eyebrow" tone="mut" uppercase>
                      APPROVED WORK
                    </Txt>
                    {estimate.approvedWork.map((item, index) => (
                      <View key={`${item}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                        <Icon name="checkCircle" size={15} color={c.good} strokeWidth={1.8} />
                        <Txt role="smallStrong" style={{ flex: 1 }}>
                          {item}
                        </Txt>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Txt role="micro" tone="mut" style={{ marginTop: 12 }}>
                  {formatLongDate(service.date)}
                </Txt>
              </Card>
            );
          })}
        </Stack>
      )}
    </Screen>
  );
}

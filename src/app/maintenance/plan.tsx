import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ErrorState,
  Badge,
  Card,
  Divider,
  EmptyState,
  Icon,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { buildServicePlan } from '@/features/maintenance/buildServicePlan';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatDistance } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import { useTheme } from '@/theme';

/**
 * Service plan — the rider's rules projected forward, and the services already
 * recorded, on one timeline.
 */
export default function ServicePlan() {
  const router = useRouter();
  const { c } = useTheme();
  const { units, activeBike } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  if (error) {
    return (
      <Screen testID="screen-service-plan">
        <ScreenHeader title="Service plan" />
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
      <Screen testID="screen-service-plan">
        <ScreenHeader title="Service plan" />
        <SkeletonList count={3} height={140} />
      </Screen>
    );
  }

  if (!analytics) return null;

  const plan = buildServicePlan(analytics);
  const current = analytics.odometer.currentMetres;
  const empty = plan.past.length === 0 && plan.upcoming.length === 0;

  return (
    <Screen onRefresh={refetch} testID="screen-service-plan">
      <ScreenHeader
        title="Service plan"
        subtitle={`Built from your maintenance rules and service history${
          activeBike ? ` for the ${activeBike.nickname}` : ''
        }`}
      />

      {/* A projection is an assumption with a date on it. Naming the figure it
          was built from is what separates a useful forecast from a promise the
          app cannot keep. */}
      {!empty && analytics ? (
        <Txt role="helper" tone="mut" style={{ marginBottom: 14 }} testID="hint-projection">
          {`Projected from the current ${formatDistance(analytics.odometer.currentMetres, units.distance)}. Projections, not promises.`}
        </Txt>
      ) : null}

      {empty ? (
        <EmptyState
          icon="wrench"
          title="No plan yet"
          message="Add a maintenance rule or record a service, and the plan builds itself from your own schedule."
          primaryAction={{ label: 'Add a rule', onPress: () => router.push('/maintenance/rule') }}
          variant="page"
          testID="empty-plan"
        />
      ) : (
        <Stack>
          {plan.upcoming.map((milestone) => {
            const remaining = current === null || milestone.metres === null ? null : milestone.metres - current;
            return (
              <Card key={milestone.id}>
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
                    {milestone.metres === null
                      ? milestone.title
                      : `${formatDistance(milestone.metres, units.distance)} · ${milestone.title}`}
                  </Txt>
                  <Badge
                    label={
                      remaining === null
                        ? milestone.statusLabel
                        : remaining < 0
                          ? `OVERDUE BY ${formatDistance(-remaining, units.distance)}`
                          : `IN ${formatDistance(remaining, units.distance)}`
                    }
                    tone={remaining !== null && remaining < 0 ? 'bad' : 'neutral'}
                  />
                </View>
                <View style={{ gap: 8 }}>
                  {milestone.items.map((item, index) => (
                    <View key={`${item.label}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <Icon name="circle" size={15} color={c.mut} strokeWidth={1.6} />
                      <Txt role="smallStrong" style={{ flex: 1 }}>
                        {item.label}
                      </Txt>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}

          {plan.past.length > 0 ? (
            <>
              <Divider />
              <Txt role="eyebrow" tone="mut" uppercase>
                ALREADY DONE
              </Txt>
              {plan.past.map((milestone) => (
                <Card key={milestone.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginBottom: milestone.items.length > 0 ? 12 : 0,
                    }}
                  >
                    <Txt role="rowTitle" style={{ flex: 1 }} numberOfLines={2}>
                      {milestone.metres === null
                        ? milestone.title
                        : `${formatDistance(milestone.metres, units.distance)} · ${milestone.title}`}
                    </Txt>
                    <Badge
                      label={milestone.date ? `DONE · ${formatShortDate(milestone.date).toUpperCase()}` : 'DONE'}
                      tone="good"
                    />
                  </View>
                  <View style={{ gap: 8 }}>
                    {milestone.items.map((item, index) => (
                      <View
                        key={`${item.label}-${index}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
                      >
                        <Icon name="checkCircle" size={15} color={c.good} strokeWidth={1.8} />
                        <Txt role="smallStrong" style={{ flex: 1 }}>
                          {item.label}
                        </Txt>
                      </View>
                    ))}
                  </View>
                </Card>
              ))}
            </>
          ) : null}
        </Stack>
      )}
    </Screen>
  );
}

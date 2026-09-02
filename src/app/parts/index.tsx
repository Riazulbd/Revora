import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ErrorState,
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  MenuRow,
  ProgressBar,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { partHealth, type PartLife } from '@/calculations/parts';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatDistance, formatPercent } from '@/utils/format';
import { formatLongDate } from '@/utils/date';
import type { Part, UnitPreferences } from '@/types';

export default function PartsList() {
  const router = useRouter();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const active = analytics?.parts.active ?? [];
  const removed = analytics?.parts.removed ?? [];
  const accessoryCount = analytics?.accessories.all.length ?? 0;

  if (error) {
    return (
      <Screen testID="screen-parts">
        <ScreenHeader title="Parts" />
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
      <Screen testID="screen-parts">
        <ScreenHeader title="Parts" />
        <SkeletonList count={3} height={96} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-parts">
      <ScreenHeader
        title="Parts"
        action={
          <Button
            label="Add part"
            size="small"
            onPress={() => router.push('/parts/add')}
            testID="cta-add-part"
          />
        }
      />

      {active.length === 0 && removed.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="No parts logged"
          message="Log a part with its expected life and Revora tracks how much of that life is left as you ride."
          primaryAction={{ label: 'Add a part', onPress: () => router.push('/parts/add') }}
          secondaryAction={{ label: 'Accessories', onPress: () => router.push('/accessories') }}
          variant="page"
          testID="empty-parts"
        />
      ) : (
        <Stack gap={14}>
          {active.length > 0 ? (
            <>
              <Eyebrow>ACTIVE</Eyebrow>
              <View style={{ gap: 12 }}>
                {active.map(({ part, life }) => (
                  <PartCard key={part.id} part={part} life={life} units={units} />
                ))}
              </View>
            </>
          ) : null}

          {removed.length > 0 ? (
            <>
              <Eyebrow>REMOVED · HISTORY</Eyebrow>
              <View style={{ gap: 12 }}>
                {removed.map(({ part, life }) => (
                  <Card key={part.id} variant="list" style={{ paddingVertical: 14 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt role="rowTitleDense" numberOfLines={2}>
                          {part.name}
                        </Txt>
                        <Txt role="metaSmall" tone="mut" numberOfLines={2}>
                          Removed {part.removedDate ? formatLongDate(part.removedDate) : ''}
                          {life.actualLifeMetres === null
                            ? ''
                            : ` · actual life ${formatDistance(life.actualLifeMetres, units.distance)}`}
                        </Txt>
                      </View>
                      <Badge label="REMOVED" tone="neutral" />
                    </View>
                  </Card>
                ))}
              </View>
            </>
          ) : null}

          <Card variant="list">
            <MenuRow
              label="Accessories"
              onPress={() => router.push('/accessories')}
              right={
                <Txt role="metaSmall" tone="mut">
                  {accessoryCount} fitted
                </Txt>
              }
              testID="row-accessories"
            />
          </Card>
        </Stack>
      )}
    </Screen>
  );
}

function PartCard({ part, life, units }: { part: Part; life: PartLife; units: UnitPreferences }) {
  const router = useRouter();
  const health = partHealth(life);

  const remainingLabel = life.isOverdue
    ? `OVERDUE BY ${formatDistance(life.overdueMetres, units.distance)}`
    : life.remainingPercent === null
      ? 'No expected life set'
      : `${formatPercent(life.remainingPercent)} life left`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${part.name}. ${remainingLabel}`}
      onPress={() => router.push({ pathname: '/parts/[id]', params: { id: part.id } })}
      testID={`part-${part.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card variant="list" style={{ paddingVertical: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Txt role="rowTitleDense" style={{ flex: 1 }} numberOfLines={2}>
          {part.name}
        </Txt>
        <Txt
          role="badge"
          tone={health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : 'good'}
          numberOfLines={1}
        >
          {remainingLabel}
        </Txt>
      </View>

      <Txt role="metaSmall" tone="mut" numberOfLines={2}>
        Installed {formatDistance(part.installedOdometerMetres, units.distance)} · used{' '}
        {formatDistance(life.usedMetres, units.distance)}
      </Txt>

        {life.remainingPercent === null ? null : (
          <ProgressBar
            fraction={life.remainingPercent / 100}
            tone={health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : 'good'}
            height={7}
          />
        )}
      </Card>
    </Pressable>
  );
}

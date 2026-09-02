import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ErrorState,
  Badge,
  Button,
  EmptyState,
  RecordRow,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { compareByUrgency, STATUS_LABEL } from '@/calculations/maintenance';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { describeRule } from '@/features/maintenance/describeRule';
import type { MaintenanceStatusKind } from '@/types';

const TONE: Record<MaintenanceStatusKind, 'bad' | 'warn' | 'neutral' | 'good'> = {
  overdue: 'bad',
  due_soon: 'warn',
  upcoming: 'neutral',
  good: 'good',
  unknown: 'neutral',
};

export default function MaintenanceRules() {
  const router = useRouter();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const rules = [...(analytics?.maintenance.rules ?? [])].sort(compareByUrgency);
  const counts = analytics?.maintenance.counts;

  if (error) {
    return (
      <Screen testID="screen-maintenance">
        <ScreenHeader title="Maintenance" />
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
      <Screen testID="screen-maintenance">
        <ScreenHeader title="Maintenance" />
        <SkeletonList count={4} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-maintenance">
      <ScreenHeader
        title="Maintenance"
        action={
          <Button
            label="Add rule"
            size="small"
            onPress={() => router.push('/maintenance/rule')}
            testID="cta-add-rule"
          />
        }
      />

      {rules.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="No maintenance rules yet"
          message="Add a rule and Revora tracks it against your odometer and the calendar, and tells you before it falls due."
          primaryAction={{ label: 'Add a rule', onPress: () => router.push('/maintenance/rule') }}
          variant="page"
          testID="empty-maintenance"
        />
      ) : (
        <Stack gap={14}>
          {counts ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {counts.overdue > 0 ? <Badge label={`${counts.overdue} overdue`} tone="bad" size="chip" /> : null}
              {counts.due_soon > 0 ? (
                <Badge label={`${counts.due_soon} due soon`} tone="warn" size="chip" />
              ) : null}
              {counts.upcoming > 0 ? (
                <Badge label={`${counts.upcoming} upcoming`} tone="neutral" size="chip" />
              ) : null}
              {counts.good > 0 ? <Badge label={`${counts.good} good`} tone="good" size="chip" /> : null}
              {counts.unknown > 0 ? (
                <Badge label={`${counts.unknown} not set`} tone="neutral" size="chip" />
              ) : null}
            </View>
          ) : null}

          <View style={{ gap: 12 }}>
            {rules.map(({ rule, status }) => (
              <RecordRow
                key={rule.id}
                title={rule.name}
                subtitle={describeRule(rule, status, units)}
                onPress={() => router.push({ pathname: '/maintenance/rule', params: { id: rule.id } })}
                trailing={<Badge label={STATUS_LABEL[status.kind]} tone={TONE[status.kind]} />}
                testID={`rule-${rule.id}`}
              />
            ))}
          </View>

          <Txt role="helper" tone="mut">
            Statuses come from your odometer and the time since last completion. Warn-ahead distance is
            configurable per rule.
          </Txt>
        </Stack>
      )}
    </Screen>
  );
}

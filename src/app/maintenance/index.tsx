import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Footnote,
  ListCard,
  MenuRow,
  Screen,
  SectionEyebrow,
  SkeletonList,
  TabHeader,
} from '@/components';
import { compareByUrgency } from '@/calculations/maintenance';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { MaintenanceOffRow, MaintenanceRuleRow } from '@/features/maintenance/ui/MaintenanceRuleRow';
import { formatDistance } from '@/utils/format';

/**
 * The maintenance list (Figma `D1 Maintenance — Overview`).
 *
 * Three things the board is precise about, and each of them is a decision
 * rather than a style:
 *
 *  · A row carries one status three ways — the pill beside the name, the fill
 *    of the track and the line under it — and all three read the same
 *    `MaintenanceStatus`, so they cannot contradict one another.
 *  · A rule with reminders off keeps its own card under a TURNED OFF eyebrow
 *    and still opens, because a rule you cannot re-open is a rule you have to
 *    delete and retype.
 *  · The footnote exists because a status here is not a stored flag — it moves
 *    the moment a fuel log advances the odometer, and a badge that changes
 *    without the rider touching maintenance needs to say why.
 */
export default function MaintenanceRules() {
  const router = useRouter();
  const { activeBike, units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const rules = [...(analytics?.maintenance.rules ?? [])].sort(compareByUrgency);
  const disabled = analytics?.maintenance.disabled ?? [];
  const counts = analytics?.maintenance.counts ?? null;
  const current = analytics?.odometer.currentMetres ?? null;

  const openRule = (id: string) => router.push({ pathname: '/maintenance/rule', params: { id } });

  const header = (
    <TabHeader
      title="Maintenance"
      subtitle={`${activeBike?.nickname ?? 'Your bike'}${current === null ? '' : ` · ${formatDistance(current, units.distance)}`}`}
      action={
        <Button
          label="Add rule"
          icon="plus"
          size="action"
          onPress={() => router.push('/maintenance/rule')}
          testID="cta-add-rule"
        />
      }
      style={{ marginBottom: 0 }}
    />
  );

  if (error) {
    return (
      <Screen wash testID="screen-maintenance" contentStyle={{ gap: 16 }}>
        {header}
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" testID="error-maintenance" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen wash testID="screen-maintenance" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={4} />
      </Screen>
    );
  }

  return (
    <Screen wash onRefresh={refetch} testID="screen-maintenance" contentStyle={{ gap: 16 }}>
      {header}

      {/* Figma `Status summary`: one chip per standing, in the list's order. */}
      {counts !== null && rules.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, rowGap: 8 }} testID="status-summary">
          {counts.overdue > 0 ? <Badge size="status" tone="bad" icon="circleAlert" label={`${counts.overdue} overdue`} /> : null}
          {counts.due_soon > 0 ? <Badge size="status" tone="warn" icon="clock" label={`${counts.due_soon} due soon`} /> : null}
          {counts.upcoming > 0 ? <Badge size="status" tone="neutral" icon="calendar" label={`${counts.upcoming} upcoming`} bordered style={{ backgroundColor: 'transparent' }} /> : null}
          {counts.good > 0 ? <Badge size="status" tone="good" icon="check" label={`${counts.good} good`} /> : null}
          {counts.unknown > 0 ? <Badge size="status" tone="neutral" icon="circle" label={`${counts.unknown} not set`} /> : null}
        </View>
      ) : null}

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
        <View style={{ gap: 16 }}>
          <ListCard style={{ paddingVertical: 2 }} testID="card-rules">
            {rules.map((entry) => (
              <MaintenanceRuleRow
                key={entry.rule.id}
                entry={entry}
                units={units}
                onPress={() => openRule(entry.rule.id)}
                testID={`rule-${entry.rule.id}`}
              />
            ))}
          </ListCard>

          <Footnote style={{ marginTop: 0 }} testID="hint-status-live">
            Status is recomputed from the current odometer — a fuel log can change it.
          </Footnote>
        </View>
      )}

      {/* Figma `Plan link`. */}
      <Card variant="list" style={{ paddingVertical: 6 }}>
        <MenuRow
          icon="calendarRange"
          iconTone="info"
          label="Service plan"
          subtitle="The year ahead, projected from your riding"
          onPress={() => router.push('/maintenance/plan')}
          testID="row-service-plan"
        />
      </Card>

      {disabled.length > 0 ? (
        <View>
          <SectionEyebrow first>Turned off</SectionEyebrow>
          <ListCard style={{ opacity: 0.75 }} testID="card-rules-off">
            {disabled.map(({ rule }) => (
              <MaintenanceOffRow key={rule.id} name={rule.name} onPress={() => openRule(rule.id)} testID={`rule-disabled-${rule.id}`} />
            ))}
          </ListCard>
        </View>
      ) : null}
    </Screen>
  );
}

import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Footnote,
  ListCard,
  RecordRow,
  RowIcon,
  SCREEN_GUTTER,
  Screen,
  SectionEyebrow,
  SkeletonList,
  TabHeader,
} from '@/components';
import { compareByUrgency } from '@/calculations/maintenance';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { describeSchedule, describeStatusPill } from '@/features/maintenance/describeRule';
import { MaintenanceGlyph, glyphForRule } from '@/features/maintenance/ui/MaintenanceGlyph';
import type { RuleWithStatus } from '@/calculations/analytics';
import type { UnitPreferences } from '@/types';
import { useTheme } from '@/theme';

/**
 * The maintenance list.
 *
 * Three things the board is precise about, and each of them is a decision
 * rather than a style:
 *
 *  · The row's supporting line states the *schedule* ("Every 3,000 km or
 *    3 months · last at 31,402 km") and the pill states the *urgency*
 *    ("310 KM OVER"). One fact each, so they cannot contradict one another.
 *  · A rule with reminders off keeps its own card under a TURNED OFF eyebrow
 *    and still opens, because a rule you cannot re-open is a rule you have to
 *    delete and retype.
 *  · The footnote exists because a status here is not a stored flag — it moves
 *    the moment a fuel log advances the odometer, and a badge that changes
 *    without the rider touching maintenance needs to say why.
 */
export default function MaintenanceRules() {
  const router = useRouter();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const rules = [...(analytics?.maintenance.rules ?? [])].sort(compareByUrgency);
  const disabled = analytics?.maintenance.disabled ?? [];
  const counts = analytics?.maintenance.counts ?? null;

  const openRule = (id: string) => router.push({ pathname: '/maintenance/rule', params: { id } });

  if (error) {
    return (
      <Screen testID="screen-maintenance" contentStyle={{ paddingHorizontal: SCREEN_GUTTER.tab }}>
        <TabHeader title="Maintenance" />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" testID="error-maintenance" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-maintenance" contentStyle={{ paddingHorizontal: SCREEN_GUTTER.tab }}>
        <TabHeader title="Maintenance" />
        <SkeletonList count={4} />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={refetch}
      testID="screen-maintenance"
      contentStyle={{ paddingHorizontal: SCREEN_GUTTER.tab }}
    >
      <TabHeader
        title="Maintenance"
        action={
          <Button
            label="Add rule"
            icon="plus"
            size="compact"
            onPress={() => router.push('/maintenance/rule')}
            testID="cta-add-rule"
          />
        }
      />

      {counts !== null && rules.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14, marginHorizontal: 4 }}>
          {counts.overdue > 0 ? <Badge label={`${counts.overdue} overdue`} tone="bad" /> : null}
          {counts.due_soon > 0 ? <Badge label={`${counts.due_soon} due soon`} tone="warn" /> : null}
          {counts.upcoming > 0 ? <Badge label={`${counts.upcoming} upcoming`} tone="neutral" /> : null}
          {counts.good > 0 ? <Badge label={`${counts.good} good`} tone="good" /> : null}
          {counts.unknown > 0 ? <Badge label={`${counts.unknown} not set`} tone="neutral" /> : null}
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
        <>
          <ListCard testID="card-rules">
            {rules.map((entry) => (
              <RuleRow key={entry.rule.id} entry={entry} units={units} onPress={() => openRule(entry.rule.id)} />
            ))}
          </ListCard>

          <Footnote testID="hint-status-live">
            Status is recomputed from the current odometer — a fuel log can change it.
          </Footnote>
        </>
      )}

      {disabled.length > 0 ? (
        <>
          <SectionEyebrow>Turned off</SectionEyebrow>
          <ListCard style={{ opacity: 0.65 }} testID="card-rules-off">
            {disabled.map(({ rule }) => (
              <DisabledRuleRow key={rule.id} id={rule.id} name={rule.name} onPress={() => openRule(rule.id)} />
            ))}
          </ListCard>
        </>
      ) : null}
    </Screen>
  );
}

/** `width:40px; height:40px; border-radius:11px` — the board's row mark. */
function RuleRow({
  entry,
  units,
  onPress,
}: {
  entry: RuleWithStatus;
  units: UnitPreferences;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const pill = describeStatusPill(entry.rule, entry.status, units);
  const ink =
    pill.tone === 'bad' ? c.bad : pill.tone === 'warn' ? c.warn : pill.tone === 'good' ? c.good : c.mut;

  return (
    <RecordRow
      variant="flush"
      leading={
        <RowIcon size={40} tone={pill.tone}>
          <MaintenanceGlyph name={glyphForRule(entry.rule.name)} size={18} color={ink} />
        </RowIcon>
      }
      title={entry.rule.name}
      subtitle={describeSchedule(entry.rule, units)}
      badge={<Badge label={pill.label} tone={pill.tone} variant="outlined" />}
      onPress={onPress}
      testID={`rule-${entry.rule.id}`}
    />
  );
}

function DisabledRuleRow({ id, name, onPress }: { id: string; name: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <RecordRow
      variant="flush"
      leading={
        <RowIcon size={40} tone="neutral">
          <MaintenanceGlyph name="off" size={18} color={c.mut} />
        </RowIcon>
      }
      title={name}
      subtitle="Reminders off · history kept · tap to turn back on"
      chevron={false}
      onPress={onPress}
      testID={`rule-disabled-${id}`}
    />
  );
}

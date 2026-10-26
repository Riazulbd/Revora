import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Card,
  EmptyState,
  ErrorState,
  Footnote,
  Icon,
  ListCard,
  RecordRow,
  RowIcon,
  Screen,
  ScreenHeader,
  SkeletonList,
  Txt,
} from '@/components';
import { averageMonthlyDistanceMetres } from '@/calculations/odometer';
import { describeProjection, projectServicePlan } from '@/calculations/serviceplan';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { MaintenanceGlyph, glyphForRule } from '@/features/maintenance/ui/MaintenanceGlyph';
import { PlanTimeline } from '@/features/maintenance/ui/PlanTimeline';
import { useTheme } from '@/theme';
import { formatDistance } from '@/utils/format';
import { daysBetween } from '@/utils/date';

/**
 * The year ahead (Figma `D2 Maintenance — Service plan`).
 *
 * Every row is one maintenance rule projected forward from the odometer it
 * falls due at and the pace the rider has actually been riding. The pace is
 * measured — `averageMonthlyDistanceMetres()` returns null when the history is
 * too thin — and when it is unknown the row keeps its distance and simply drops
 * the date, which is what the footnote on the board promises. Inventing a rate
 * so that every line could carry a month would be the one thing this screen
 * must never do.
 */
export default function ServicePlan() {
  const router = useRouter();
  const { c } = useTheme();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  if (error) {
    return (
      <Screen testID="screen-service-plan" contentStyle={{ gap: 16 }}>
        <ScreenHeader title="Service plan" style={{ marginBottom: 0 }} />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" testID="error-service-plan" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-service-plan" contentStyle={{ gap: 16 }}>
        <ScreenHeader title="Service plan" style={{ marginBottom: 0 }} />
        <SkeletonList count={4} height={64} />
      </Screen>
    );
  }

  if (!analytics) return null;

  const currentMetres = analytics.odometer.currentMetres;
  const monthlyMetres = averageMonthlyDistanceMetres(analytics.odometer.points);
  const plan = projectServicePlan({
    rules: analytics.maintenance.rules,
    monthlyMetres,
    today: analytics.today,
  });
  const withinYear = plan.filter(
    (row) => row.overdue || (row.projectedOn !== null && daysBetween(analytics.today, row.projectedOn) <= 365),
  ).length;

  // A projection is an assumption with a date on it. Naming both figures it
  // was built from — the odometer and the rider's own pace — is what keeps it
  // a forecast rather than a promise the app cannot keep.
  const intro =
    currentMetres === null
      ? 'Projections, not promises.'
      : monthlyMetres === null
        ? `Projected from the current ${formatDistance(currentMetres, units.distance)}. Projections, not promises.`
        : `Projected from the current ${formatDistance(currentMetres, units.distance)} at your recent ${formatDistance(
            monthlyMetres,
            units.distance,
          )} a month. Projections, not promises.`;

  return (
    <Screen onRefresh={refetch} testID="screen-service-plan" contentStyle={{ gap: 16 }}>
      <ScreenHeader title="Service plan" style={{ marginBottom: 0 }} />

      <Txt role="body" tone="mut" testID="hint-projection">
        {intro}
      </Txt>

      {plan.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="Nothing to plan yet"
          message="A rule can only be projected once it has an interval and one completion behind it. Add a rule, or mark one done, and the year ahead builds itself."
          primaryAction={{ label: 'Add a rule', onPress: () => router.push('/maintenance/rule') }}
          variant="page"
          testID="empty-plan"
        />
      ) : (
        <>
          {/* Figma `Year card`. */}
          <Card style={{ gap: 12 }} testID="card-year">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Txt role="cardTitle">Next 12 months</Txt>
              <Txt role="micro" tone="mut">{`${withinYear} item${withinYear === 1 ? '' : 's'}`}</Txt>
            </View>
            <PlanTimeline plan={plan} today={analytics.today} testID="chart-timeline" />
          </Card>

          <ListCard style={{ paddingVertical: 2 }} testID="card-plan">
            {plan.map((row) => {
              const when = row.overdue ? 'Overdue now' : describeProjection(row.projectedOn, analytics.today);
              const distance = row.dueAtMetres === null ? null : formatDistance(row.dueAtMetres, units.distance);
              return (
                <RecordRow
                  key={row.ruleId}
                  variant="flush"
                  titleSize="large"
                  leading={
                    <RowIcon tone={row.overdue ? 'bad' : 'neutral'}>
                      <MaintenanceGlyph name={glyphForRule(row.name)} color={row.overdue ? c.badIcon : c.mut} />
                    </RowIcon>
                  }
                  title={row.name}
                  {...(row.overdue
                    ? {
                        subtitleContent: (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Icon name="circleAlert" size={14} color={c.bad} />
                            <Txt role="micro" tone="bad">
                              Overdue now
                            </Txt>
                          </View>
                        ),
                      }
                    : when === null
                      ? {}
                      : { subtitle: when })}
                  {...(distance === null
                    ? {}
                    : {
                        trailing: (
                          <Txt role="rowTitleLarge" tone={row.overdue ? 'bad' : 'ink'} numberOfLines={1}>
                            {distance}
                          </Txt>
                        ),
                      })}
                  testID={`plan-rule-${row.ruleId}`}
                />
              );
            })}
          </ListCard>

          <Footnote style={{ marginTop: 0 }} testID="hint-plan-dates">
            Dates need riding history. With too little, items show their distance alone — a rate would be
            invented.
          </Footnote>
        </>
      )}
    </Screen>
  );
}

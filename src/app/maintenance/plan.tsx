import React from 'react';
import { useRouter } from 'expo-router';

import {
  EmptyState,
  ErrorState,
  Footnote,
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
import { fontFamily, useTheme } from '@/theme';
import { formatDistance } from '@/utils/format';

/**
 * The year ahead.
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
      <Screen testID="screen-service-plan">
        <ScreenHeader title="Service plan" />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" testID="error-service-plan" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-service-plan">
        <ScreenHeader title="Service plan" />
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

  return (
    <Screen onRefresh={refetch} testID="screen-service-plan">
      <ScreenHeader title="Service plan" style={{ marginBottom: 0 }} />

      {/* A projection is an assumption with a date on it. Naming both figures it
          was built from — the odometer and the rider's own pace — is what keeps
          it a forecast rather than a promise the app cannot keep. */}
      <Txt role="meta" tone="mut" style={{ marginTop: 6, lineHeight: 18 }} testID="hint-projection">
        {currentMetres === null ? (
          'Projections, not promises.'
        ) : monthlyMetres === null ? (
          `Projected from the current ${formatDistance(currentMetres, units.distance)}. Projections, not promises.`
        ) : (
          <>
            {`Projected from the current ${formatDistance(currentMetres, units.distance)} at your recent `}
            <Txt style={{ fontFamily: fontFamily[700], fontSize: 12, color: c.mut }}>
              {`${formatDistance(monthlyMetres, units.distance)} a month`}
            </Txt>
            . Projections, not promises.
          </>
        )}
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
          <ListCard style={{ marginTop: 14 }} testID="card-plan">
            {plan.map((row) => {
              const when = row.overdue ? 'Overdue now' : describeProjection(row.projectedOn, analytics.today);
              return (
                <RecordRow
                  key={row.ruleId}
                  variant="flush"
                  leading={
                    <RowIcon size={36} tone={row.overdue ? 'bad' : 'neutral'}>
                      <MaintenanceGlyph
                        name={glyphForRule(row.name)}
                        size={16}
                        color={row.overdue ? c.bad : c.mut}
                      />
                    </RowIcon>
                  }
                  title={row.name}
                  {...(when === null ? {} : { subtitle: when })}
                  subtitleTone={row.overdue ? 'bad' : 'mut'}
                  trailing={
                    <Txt role="linkLarge" tone={row.overdue ? 'bad' : 'ink'} numberOfLines={1}>
                      {formatDistance(row.dueAtMetres, units.distance)}
                    </Txt>
                  }
                  testID={`plan-rule-${row.ruleId}`}
                />
              );
            })}
          </ListCard>

          <Footnote style={{ marginTop: 12 }} testID="hint-plan-dates">
            Dates need riding history. With too little, items show their distance alone — a rate would be
            invented.
          </Footnote>
        </>
      )}
    </Screen>
  );
}

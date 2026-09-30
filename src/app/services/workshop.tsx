import React from 'react';
import { useRouter } from 'expo-router';

import {
  Badge,
  EmptyState,
  ErrorState,
  Footnote,
  ListCard,
  RecordRow,
  Screen,
  ScreenHeader,
  SkeletonList,
  StatRow,
  StatTile,
} from '@/components';
import { summariseEstimates } from '@/calculations/estimateGuard';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatCurrencySymbol, NO_VALUE } from '@/utils/format';

/**
 * Workshop records — the estimate guard.
 *
 * For every workshop visit that recorded a quote, this shows the quote, the
 * invoice and the difference between them, so a job that grew in the workshop is
 * visible rather than lost inside a single total. Visits with no quote are
 * counted and said out loud: a comparison over 6 of 14 visits that presented
 * itself as "your workshops" would be a lie of omission.
 */

export default function WorkshopRecords() {
  const router = useRouter();
  const { analytics, isPending, error, refetch } = useGarageData();

  const currency = analytics?.currency ?? 'BDT';
  const summary = summariseEstimates(analytics?.services.all ?? []);

  if (error) {
    return (
      <Screen testID="screen-workshop">
        <ScreenHeader title="Workshop records" />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-workshop">
        <ScreenHeader title="Workshop records" />
        <SkeletonList count={2} height={64} />
      </Screen>
    );
  }

  /** `+৳1,700` / `−৳300` — the sign is the news, so it is never dropped. */
  const signed = (deltaMinor: number) =>
    `${deltaMinor > 0 ? '+' : deltaMinor < 0 ? '−' : ''}${formatCurrencySymbol(Math.abs(deltaMinor), currency)}`;

  const deltaValue =
    summary.deltaMinor === null
      ? NO_VALUE
      : summary.deltaMinor === 0
        ? 'Matched'
        : `${signed(summary.deltaMinor)} ${summary.deltaMinor > 0 ? 'over' : 'under'}`;

  return (
    <Screen onRefresh={refetch} testID="screen-workshop">
      <ScreenHeader title="Workshop records" backTestID="back-workshop" />

      {summary.comparedVisits === 0 ? (
        <EmptyState
          icon="building"
          title="Nothing to compare yet"
          message="Record the quote you were given when you log a workshop service, and Revora will show you the difference when the invoice arrives."
          primaryAction={{ label: 'Log a service', onPress: () => router.push('/services/add') }}
          variant="page"
          testID="empty-workshop"
        />
      ) : (
        <>
          <StatRow style={{ marginBottom: 8 }}>
            <StatTile
              label="Quoted"
              value={formatCurrencySymbol(summary.quotedMinor, currency)}
              variant="outlined"
              testID="tile-quoted"
            />
            <StatTile
              label="Invoiced"
              value={formatCurrencySymbol(summary.invoicedMinor, currency)}
              variant="outlined"
              testID="tile-invoiced"
            />
          </StatRow>
          <StatRow>
            {/* The sign carries the meaning, so the word says it too — colour is
                never the only signal (requirement 58). */}
            <StatTile
              label="Delta"
              value={deltaValue}
              tone={summary.severity === 'neutral' ? 'ink' : summary.severity}
              variant="outlined"
              testID="tile-delta"
            />
            <StatTile
              label="Compared"
              value={`${summary.comparedVisits} visit${summary.comparedVisits === 1 ? '' : 's'}`}
              variant="outlined"
              testID="tile-compared"
            />
          </StatRow>

          {summary.uncomparedVisits > 0 ? (
            <Footnote testID="note-uncompared">
              {`${summary.uncomparedVisits} other visit${
                summary.uncomparedVisits === 1 ? ' had' : 's had'
              } no quote recorded and ${
                summary.uncomparedVisits === 1 ? 'is' : 'are'
              } left out of the comparison.`}
            </Footnote>
          ) : null}

          <ListCard style={{ marginTop: 14 }} testID="workshop-list">
            {summary.byWorkshop.map((entry) => (
              <RecordRow
                key={entry.workshop}
                variant="flush"
                icon="building"
                iconTone="neutral"
                iconSize={40}
                title={entry.workshop}
                subtitle={`${entry.comparedVisits} compared visit${
                  entry.comparedVisits === 1 ? '' : 's'
                } · quoted ${formatCurrencySymbol(entry.quotedMinor, currency)} · invoiced ${formatCurrencySymbol(
                  entry.invoicedMinor,
                  currency,
                )}`}
                badge={
                  <Badge
                    label={entry.deltaMinor === 0 ? 'Matched' : signed(entry.deltaMinor)}
                    variant="outlined"
                    tone={entry.severity}
                    uppercase={false}
                  />
                }
                testID={`workshop-${entry.workshop}`}
              />
            ))}
          </ListCard>

          {/* A rider who reads red as "bad news" and green as "good" has read it
              correctly — say so once rather than leaving them to infer it. */}
          <Footnote>
            Under-quote shows in green with a minus — over and under are different news.
          </Footnote>
        </>
      )}
    </Screen>
  );
}

import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Banner,
  EmptyState,
  ErrorState,
  Footnote,
  ListCard,
  RecordRow,
  Screen,
  ScreenHeader,
  SectionEyebrow,
  SkeletonList,
  StatRow,
  StatTile,
  Txt,
} from '@/components';
import type { BadgeTone, IconName } from '@/components';
import { summariseEstimates, type EstimateSeverity } from '@/calculations/estimateGuard';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatCurrencySymbol, NO_VALUE } from '@/utils/format';

/**
 * Workshop records — the estimate guard (Figma `D6 Services — Workshop records`).
 *
 * For every workshop visit that recorded a quote, this shows the quote, the
 * invoice and the difference between them, so a job that grew in the workshop is
 * visible rather than lost inside a single total. Visits with no quote are
 * counted and said out loud: a comparison over 6 of 14 visits that presented
 * itself as "your workshops" would be a lie of omission.
 */

/** The glyph on a delta: the trend arrow, or a tick when the two matched. */
function deltaGlyph(severity: EstimateSeverity): IconName {
  return severity === 'good' ? 'trendingDown' : severity === 'neutral' ? 'check' : 'trendingUp';
}

function deltaTone(severity: EstimateSeverity): BadgeTone {
  return severity === 'neutral' ? 'ink' : severity;
}

export default function WorkshopRecords() {
  const router = useRouter();
  const { analytics, isPending, error, refetch } = useGarageData();

  const currency = analytics?.currency ?? 'BDT';
  const summary = summariseEstimates(analytics?.services.all ?? []);

  if (error) {
    return (
      <Screen testID="screen-workshop" contentStyle={{ gap: 16 }}>
        <ScreenHeader title="Workshop records" style={{ marginBottom: 0 }} />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-workshop" contentStyle={{ gap: 16 }}>
        <ScreenHeader title="Workshop records" style={{ marginBottom: 0 }} />
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

  const deltaVariant =
    summary.severity === 'bad' ? 'bad' : summary.severity === 'warn' ? 'warn' : summary.severity === 'good' ? 'good' : 'outlined';

  return (
    <Screen onRefresh={refetch} testID="screen-workshop" contentStyle={{ gap: 16 }}>
      <ScreenHeader title="Workshop records" backTestID="back-workshop" style={{ marginBottom: 0 }} />

      {/* Figma `Intro`. */}
      <View style={{ gap: 4 }}>
        <Txt role="headline">Quotes vs invoices</Txt>
        <Txt role="body" tone="mut">
          Only visits where you recorded a quote are compared.
        </Txt>
      </View>

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
          {/* Figma `Stats`: two rows of two, the delta tinted in its severity. */}
          <View style={{ gap: 8 }}>
            <StatRow>
              <StatTile
                variant="outlined"
                eyebrow
                icon="fileText"
                label="Quoted"
                valueSize="xl"
                value={formatCurrencySymbol(summary.quotedMinor, currency)}
                testID="tile-quoted"
              />
              <StatTile
                variant="outlined"
                eyebrow
                icon="receipt"
                label="Invoiced"
                valueSize="xl"
                value={formatCurrencySymbol(summary.invoicedMinor, currency)}
                testID="tile-invoiced"
              />
            </StatRow>
            <StatRow>
              {/* The sign carries the meaning, so the word says it too — colour is
                  never the only signal (requirement 58). */}
              <StatTile
                variant={deltaVariant}
                bordered
                eyebrow
                icon={deltaGlyph(summary.severity)}
                label="Delta"
                valueSize="xl"
                value={deltaValue}
                testID="tile-delta"
              />
              <StatTile
                variant="outlined"
                eyebrow
                icon="history"
                label="Compared"
                valueSize="xl"
                value={`${summary.comparedVisits} visit${summary.comparedVisits === 1 ? '' : 's'}`}
                testID="tile-compared"
              />
            </StatRow>
          </View>

          {summary.uncomparedVisits > 0 ? (
            <Banner
              variant="soft"
              tone="neutral"
              message={`${summary.uncomparedVisits} other visit${
                summary.uncomparedVisits === 1 ? ' had' : 's had'
              } no quote recorded and ${summary.uncomparedVisits === 1 ? 'is' : 'are'} left out of the comparison.`}
              testID="note-uncompared"
            />
          ) : null}

          <View>
            <SectionEyebrow first>By workshop</SectionEyebrow>
            <ListCard style={{ paddingVertical: 2 }} testID="workshop-list">
              {summary.byWorkshop.map((entry) => (
                <RecordRow
                  key={entry.workshop}
                  variant="flush"
                  titleSize="large"
                  icon="building"
                  iconTone="neutral"
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
                      tone={deltaTone(entry.severity)}
                      icon={deltaGlyph(entry.severity)}
                      size="wide"
                      bordered
                    />
                  }
                  testID={`workshop-${entry.workshop}`}
                />
              ))}
            </ListCard>
          </View>

          {/* A rider who reads red as "bad news" and green as "good" has read it
              correctly — say so once rather than leaving them to infer it. */}
          <Footnote style={{ marginTop: 0 }}>
            Under-quote shows in green with a minus — over and under are different news.
          </Footnote>
        </>
      )}
    </Screen>
  );
}

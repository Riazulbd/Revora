import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  conditionHistory,
  currentCondition,
  SAFETY_AREA_LABEL,
} from '@/calculations/safety';

import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Eyebrow,
  RecordRow,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
} from '@/components';
import { useSafetyChecks } from '@/features/records/useRecordQueries';
import { formatLongDate } from '@/utils/date';
import type { SafetyStatus } from '@/types';

const TONE: Record<SafetyStatus, 'good' | 'warn' | 'bad'> = { ok: 'good', watch: 'warn', action: 'bad' };
const LABEL: Record<SafetyStatus, string> = { ok: 'OK', watch: 'WATCH', action: 'ACTION' };

export default function SafetyLog() {
  const router = useRouter();
  const checks = useSafetyChecks();
  const items = checks.data ?? [];

  if (checks.isPending) {
    return (
      <Screen testID="screen-safety">
        <ScreenHeader title="Safety & condition" />
        <SkeletonList count={3} height={72} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={async () => void (await checks.refetch())} testID="screen-safety">
      <ScreenHeader
        title="Safety & condition"
        action={
          <Button
            label="Log check"
            size="small"
            onPress={() => router.push('/records/safety-add')}
            testID="cta-add-check"
          />
        }
      />

      <Stack gap={14}>
        <Banner
          tone="neutral"
          message="A condition log by you, for you — not a mechanical diagnosis. When in doubt, see a mechanic."
        />

        {items.length === 0 ? (
          <EmptyState
            icon="shield"
            title="No checks logged"
            message="Tyre pressure, chain slack, brake feel — a two-minute check logged here builds a record you can trust."
            primaryAction={{ label: 'Log a check', onPress: () => router.push('/records/safety-add') }}
            testID="empty-safety"
          />
        ) : (
          <>
            <View style={{ gap: 10 }}>
              <Eyebrow>CURRENT — LATEST CHECK PER AREA</Eyebrow>
              {currentCondition(items).map((state) => (
                <RecordRow
                  key={state.area}
                  title={state.label}
                  subtitle={
                    state.latest === null
                      ? 'Never checked'
                      : `${state.latest.summary} · ${formatLongDate(state.latest.date)}`
                  }
                  caption={
                    state.status === 'action'
                      ? 'Shows on the Dashboard until cleared'
                      : (state.latest?.note ?? undefined)
                  }
                  onPress={() =>
                    router.push(
                      state.latest === null
                        ? { pathname: '/records/safety-add', params: { area: state.area } }
                        : { pathname: '/records/safety-add', params: { id: state.latest.id } },
                    )
                  }
                  trailing={
                    <Badge
                      label={state.status === null ? 'NOT CHECKED' : LABEL[state.status]}
                      tone={state.status === null ? 'neutral' : TONE[state.status]}
                    />
                  }
                  testID={`safety-area-${state.area}`}
                />
              ))}
            </View>

            {conditionHistory(items).length > 0 ? (
              <View style={{ gap: 10 }}>
                <Eyebrow>HISTORY</Eyebrow>
                {conditionHistory(items).map((check) => (
                  <RecordRow
                    key={check.id}
                    title={SAFETY_AREA_LABEL[check.area]}
                    subtitle={`${check.summary} · ${formatLongDate(check.date)}`}
                    onPress={() => router.push({ pathname: '/records/safety-add', params: { id: check.id } })}
                    trailing={<Badge label={LABEL[check.status]} tone={TONE[check.status]} />}
                    testID={`safety-${check.id}`}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </Stack>
    </Screen>
  );
}

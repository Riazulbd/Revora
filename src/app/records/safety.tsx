import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Banner,
  Button,
  EmptyState,
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

const AREA_LABEL = {
  tyres: 'Tyres',
  chain: 'Chain',
  brakes: 'Brakes',
  battery: 'Battery',
  lights: 'Lights',
} as const;

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
          <View style={{ gap: 12 }}>
            {items.map((check) => (
              <RecordRow
                key={check.id}
                title={AREA_LABEL[check.area]}
                subtitle={`${check.summary} · ${formatLongDate(check.date)}`}
                caption={check.note ?? undefined}
                onPress={() => router.push({ pathname: '/records/safety-add', params: { id: check.id } })}
                trailing={<Badge label={LABEL[check.status]} tone={TONE[check.status]} />}
                testID={`safety-${check.id}`}
              />
            ))}
          </View>
        )}
      </Stack>
    </Screen>
  );
}

import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
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
import { useWarranties } from '@/features/records/useRecordQueries';
import { daysBetween, formatLongDate, todayIso } from '@/utils/date';
import type { Warranty } from '@/types';

function warrantyTone(warranty: Warranty, today: string): { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  if (warranty.claimStatus === 'open') return { label: 'CLAIM OPEN', tone: 'warn' };
  if (warranty.validUntil === null) return { label: 'NO EXPIRY', tone: 'neutral' };
  const days = daysBetween(today, warranty.validUntil);
  if (days < 0) return { label: 'EXPIRED', tone: 'bad' };
  if (days <= 30) return { label: 'EXPIRING', tone: 'warn' };
  return { label: 'ACTIVE', tone: 'good' };
}

export default function Warranties() {
  const router = useRouter();
  const warranties = useWarranties();
  const today = todayIso();

  const items = warranties.data ?? [];

  if (warranties.isPending) {
    return (
      <Screen testID="screen-warranties">
        <ScreenHeader title="Warranties" />
        <SkeletonList count={2} height={72} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={async () => void (await warranties.refetch())} testID="screen-warranties">
      <ScreenHeader
        title="Warranties"
        action={
          <Button
            label="Add"
            size="small"
            onPress={() => router.push('/records/warranty')}
            testID="cta-add-warranty"
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon="shield"
          title="No warranties recorded"
          message="Battery, tyres, engine cover — record what is under warranty and until when, so a claim is never missed."
          primaryAction={{ label: 'Add a warranty', onPress: () => router.push('/records/warranty') }}
          variant="page"
          testID="empty-warranties"
        />
      ) : (
        <Stack gap={12}>
          {/* Riders ask why a lapsed warranty is still listed. It is listed
              because a buyer asking what was covered and when is exactly the
              question it answers. */}
          <Txt role="helper" tone="mut">
            Expired warranties are kept — evidence of cover matters at resale.
          </Txt>

          <View style={{ gap: 12 }}>
            {items.map((warranty) => {
              const status = warrantyTone(warranty, today);
              return (
                <RecordRow
                  key={warranty.id}
                  title={warranty.title}
                  subtitle={[
                    warranty.provider,
                    warranty.validUntil ? `until ${formatLongDate(warranty.validUntil)}` : null,
                    warranty.claimStatus === 'none' ? 'no claims' : `claim ${warranty.claimStatus}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => router.push({ pathname: '/records/warranty', params: { id: warranty.id } })}
                  trailing={<Badge label={status.label} tone={status.tone} />}
                  testID={`warranty-${warranty.id}`}
                />
              );
            })}
          </View>
        </Stack>
      )}
    </Screen>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ErrorState,
  Button,
  Card,
  Dialog,
  EmptyState,
  RecordRow,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { accessoryTotalMinor } from '@/calculations/expenses';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDeleteAccessory } from '@/features/accessories/useAccessoryMutations';
import { formatCurrency } from '@/utils/format';
import { formatLongDate } from '@/utils/date';

export default function Accessories() {
  const router = useRouter();
  const { analytics, isPending, error, refetch } = useGarageData();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const accessories = analytics?.accessories.all ?? [];
  const deleteAccessory = useDeleteAccessory({ onDeleted: () => setPendingDelete(null) });

  if (error) {
    return (
      <Screen testID="screen-accessories">
        <ScreenHeader title="Accessories" />
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
      <Screen testID="screen-accessories">
        <ScreenHeader title="Accessories" />
        <SkeletonList count={3} height={72} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-accessories">
      <ScreenHeader
        title="Accessories"
        action={
          <Button
            label="Add"
            size="small"
            onPress={() => router.push('/accessories/add')}
            testID="cta-add-accessory"
          />
        }
      />

      {accessories.length === 0 ? (
        <EmptyState
          icon="shield"
          title="No accessories yet"
          message="Top boxes, crash guards, phone mounts — log what you've fitted and what it cost."
          primaryAction={{ label: 'Add an accessory', onPress: () => router.push('/accessories/add') }}
          variant="page"
          testID="empty-accessories"
        />
      ) : (
        <Stack gap={14}>
          <Card variant="flush" style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Txt role="smallStrong" tone="mut">
                Total spent on accessories
              </Txt>
              <Txt role="rowTitle" numberOfLines={1}>
                {formatCurrency(analytics?.accessories.totalSpendMinor ?? 0, analytics?.currency ?? 'BDT')}
              </Txt>
            </View>
          </Card>

          <View style={{ gap: 12 }}>
            {accessories.map((accessory) => (
              <RecordRow
                key={accessory.id}
                title={accessory.name}
                subtitle={`Added ${formatLongDate(accessory.date)}${
                  accessory.installationCostMinor > 0
                    ? ` · fitting ${formatCurrency(accessory.installationCostMinor, accessory.currency)}`
                    : ''
                }`}
                onPress={() => router.push({ pathname: '/accessories/add', params: { id: accessory.id } })}
                trailing={
                  <Txt role="rowTitle" numberOfLines={1}>
                    {formatCurrency(accessoryTotalMinor(accessory), accessory.currency)}
                  </Txt>
                }
                testID={`accessory-${accessory.id}`}
              />
            ))}
          </View>
        </Stack>
      )}

      <Dialog
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Remove this accessory?"
        message="Its cost comes out of your ledger. This can't be undone."
        confirmLabel="Remove"
        destructive
        busy={deleteAccessory.isPending}
        onConfirm={() => pendingDelete && deleteAccessory.submit(pendingDelete)}
      />
    </Screen>
  );
}

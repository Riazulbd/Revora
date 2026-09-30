import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  RowIcon,
  Screen,
  SkeletonList,
  Stack,
  TabHeader,
  Txt,
} from '@/components';
import { warrantySourceLine, warrantyState, warrantyTitle } from '@/calculations/warranties';
import { useWarranties } from '@/features/records/useRecordQueries';
import { todayIso } from '@/utils/date';
import { useTheme } from '@/theme';
import type { Warranty } from '@/types';

/**
 * Warranties on the motorcycle's parts.
 *
 * Expired cover is listed, not deleted. A buyer asking what was covered and
 * when is exactly the question a spent warranty answers, so the row is dimmed
 * and says why it is still here rather than disappearing.
 */
export default function Warranties() {
  const router = useRouter();
  const warranties = useWarranties();
  const today = todayIso();

  const items = warranties.data ?? [];

  if (warranties.isPending) {
    return (
      <Screen testID="screen-warranties" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Warranties" />
        <SkeletonList count={2} height={96} />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={async () => void (await warranties.refetch())}
      testID="screen-warranties"
      contentStyle={{ paddingHorizontal: 20 }}
    >
      <TabHeader
        title="Warranties"
        action={
          <Button
            label="Add"
            icon="plus"
            size="compact"
            onPress={() => router.push('/records/warranty')}
            testID="cta-add-warranty"
          />
        }
      />

      {warranties.isError ? (
        <ErrorState
          message="Your warranties are on this phone and in your account — this screen just couldn't read them."
          onRetry={() => void warranties.refetch()}
          testID="error-warranties"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="shield"
          title="No warranties recorded"
          message="Battery, tyres, engine cover — record what is under warranty and until when, so a claim is never missed."
          primaryAction={{ label: 'Add a warranty', onPress: () => router.push('/records/warranty') }}
          variant="page"
          testID="empty-warranties"
        />
      ) : (
        <Stack gap={10}>
          {items.map((warranty) => (
            <WarrantyCard key={warranty.id} warranty={warranty} today={today} />
          ))}
        </Stack>
      )}
    </Screen>
  );
}

function WarrantyCard({ warranty, today }: { warranty: Warranty; today: string }) {
  const router = useRouter();
  const { c, radius } = useTheme();

  const state = warrantyState(warranty, today);
  const source = warrantySourceLine(warranty, today);
  const ink =
    state.tone === 'good' ? c.good : state.tone === 'warn' ? c.warn : state.tone === 'bad' ? c.bad : c.mut;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${warrantyTitle(warranty)}. ${state.label}`}
      onPress={() => router.push({ pathname: '/records/warranty', params: { id: warranty.id } })}
      testID={`warranty-${warranty.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : state.expired ? 0.65 : 1 })}
    >
      <Card variant="list" style={{ paddingVertical: 16, borderRadius: radius.listCard, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <RowIcon tone={state.tone === 'bad' ? 'bad' : state.tone === 'warn' ? 'warn' : state.tone === 'good' ? 'good' : 'neutral'}>
              <Icon name="shield" size={17} color={ink} strokeWidth={1.8} />
            </RowIcon>
            <Txt role="tileValue" numberOfLines={2} style={{ flexShrink: 1 }}>
              {warrantyTitle(warranty)}
            </Txt>
          </View>

          <Badge
            label={state.label}
            tone={state.tone}
            variant={state.outlined ? 'outlined' : 'filled'}
            uppercase
            style={{ flexShrink: 0 }}
          />
        </View>

        {source === null ? null : (
          <Txt role="meta" tone="mut">
            {source}
          </Txt>
        )}

        {state.claimOpen ? (
          <Txt role="meta" tone="warn">
            Claim open — gather the purchase receipt, the warranty card and a photo of the serial number.
          </Txt>
        ) : state.expired ? (
          <Txt role="meta" tone="mut">
            Kept as evidence of cover — matters at resale.
          </Txt>
        ) : null}
      </Card>
    </Pressable>
  );
}

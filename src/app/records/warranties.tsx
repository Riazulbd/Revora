import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  HeroCard,
  Icon,
  ProgressBar,
  RowIcon,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonList,
  Txt,
  type IconName,
  type RowTone,
  type SegmentedOption,
} from '@/components';
import {
  activeWarranties,
  nextWarrantyToEnd,
  warrantyChip,
  warrantyProgress,
  warrantyState,
} from '@/calculations/warranties';
import { useWarranties } from '@/features/records/useRecordQueries';
import { InkAddButton } from '@/features/records/ui/RecordsChrome';
import { useTheme } from '@/theme';
import { formatLongDate, formatShortDate, todayIso } from '@/utils/date';
import type { Warranty } from '@/types';

/**
 * Warranties on the motorcycle's parts (Figma `R3 Records — Warranties`).
 *
 * Expired cover is listed, not deleted. A buyer asking what was covered and
 * when is exactly the question a spent warranty answers, so the row is dimmed
 * and says why it is still here rather than disappearing.
 */

type Filter = 'active' | 'expired' | 'all';

const FILTERS: readonly SegmentedOption<Filter>[] = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'all', label: 'All' },
];

/** `'Tyres · Pirelli Diablo Rosso'` → `'Tyres'`: the part alone, for the hero's sentence. */
function nextName(title: string): string {
  return title.split(' · ')[0]?.trim() || title;
}

/** What a warranty is for, read off its title — decoration, never a figure. */
function warrantyGlyph(title: string): IconName {
  if (/batter/i.test(title)) return 'battery';
  if (/tyre|tire|wheel/i.test(title)) return 'disc';
  if (/chain|sprocket/i.test(title)) return 'link';
  if (/engine|motor/i.test(title)) return 'cog';
  if (/brake|pad/i.test(title)) return 'disc';
  return 'shield';
}

export default function Warranties() {
  const router = useRouter();
  const { c } = useTheme();
  const warranties = useWarranties();
  const today = todayIso();
  const [filter, setFilter] = useState<Filter>('active');

  const items = warranties.data ?? [];
  const active = activeWarranties(items, today);
  const next = nextWarrantyToEnd(items, today);
  const shown = filter === 'all' ? items : filter === 'active' ? active : items.filter((w) => warrantyState(w, today).expired);

  const addWarranty = () => router.push('/records/warranty');

  const header = (
    <ScreenHeader
      title="Warranties"
      action={<InkAddButton onPress={addWarranty} accessibilityLabel="Add a warranty" testID="cta-add-warranty" />}
      style={{ marginBottom: 0 }}
    />
  );

  if (warranties.isPending) {
    return (
      <Screen wash testID="screen-warranties" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={2} height={96} />
      </Screen>
    );
  }

  return (
    <Screen wash onRefresh={async () => void (await warranties.refetch())} testID="screen-warranties" contentStyle={{ gap: 16 }}>
      {header}

      {warranties.isError ? (
        <ErrorState
          message="Your warranties are on this phone and in your account — this screen just couldn't read them."
          onRetry={() => void warranties.refetch()}
          testID="error-warranties"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="badgeCheck"
          title="No warranties recorded"
          message="Battery, tyres, engine cover — record what is under warranty and until when, so a claim is never missed."
          primaryAction={{ label: 'Add a warranty', onPress: addWarranty }}
          variant="page"
          testID="empty-warranties"
        />
      ) : (
        <>
          {/* Figma `Hero — dark accent`: what is covered right now, and what ends next. */}
          <HeroCard gap={14} testID="hero-warranties">
            <Txt role="eyebrow" uppercase color={c.heroMut}>
              Covered right now
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt role="hero" color={c.heroInk}>
                {String(active.length)}
              </Txt>
              <Txt role="cardTitle" color={c.heroMut} style={{ fontWeight: '500' }}>
                {active.length === 1 ? 'active warranty' : 'active warranties'}
              </Txt>
            </View>
            {next ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: c.heroTile }}>
                <Icon name="clock" size={20} color="#F5C26B" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt role="rowTitle" color={c.heroInk} numberOfLines={1}>
                    {`${nextName(next.warranty.title)} ${/s$/i.test(nextName(next.warranty.title)) ? 'end' : 'ends'} ${next.days === 0 ? 'today' : `in ${next.days} day${next.days === 1 ? '' : 's'}`}`}
                  </Txt>
                  <Txt role="meta" color={c.heroMut} numberOfLines={1}>
                    {`Check for wear before ${formatShortDate(next.warranty.validUntil ?? today)}`}
                  </Txt>
                </View>
              </View>
            ) : null}
          </HeroCard>

          <Segmented options={FILTERS} value={filter} onChange={setFilter} size="medium" testID="filter-warranties" />

          {shown.length === 0 ? (
            <EmptyState
              icon="badgeCheck"
              iconTone="neutral"
              size="compact"
              title={filter === 'expired' ? 'Nothing has expired' : 'Nothing active right now'}
              message="Tap All to see every warranty you have recorded."
              testID="empty-warranties-filtered"
            />
          ) : (
            shown.map((warranty) => <WarrantyCard key={warranty.id} warranty={warranty} today={today} />)
          )}

          <Button label="Add a warranty" icon="plus" size="xlarge" onPress={addWarranty} testID="cta-add-warranty-primary" />
        </>
      )}
    </Screen>
  );
}

/**
 * Figma `Warranty card` — the head row, then a track filled to how far the
 * term has run — or, once expired, Figma `Expired row` at 0.75 opacity.
 */
function WarrantyCard({ warranty, today }: { warranty: Warranty; today: string }) {
  const router = useRouter();
  const { c } = useTheme();

  const state = warrantyState(warranty, today);
  const chip = warrantyChip(warranty, today);
  const progress = warrantyProgress(warranty, today);
  const tone: RowTone = state.expired ? 'neutral' : chip.tone === 'neutral' ? 'neutral' : chip.tone;
  const recorded = new Date(warranty.createdAt);
  const recordedIso = `${recorded.getFullYear()}-${String(recorded.getMonth() + 1).padStart(2, '0')}-${String(recorded.getDate()).padStart(2, '0')}`;

  const line = state.expired
    ? `Ended ${warranty.validUntil ? formatShortDate(warranty.validUntil) : '—'}${
        warranty.claimStatus === 'settled' ? ' · Claim settled' : warranty.claimStatus === 'rejected' ? ' · Claim rejected' : ''
      }`
    : [warranty.provider, warranty.purchasedFrom].filter((p): p is string => Boolean(p && p.trim())).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${warranty.title}. ${chip.label}`}
      onPress={() => router.push({ pathname: '/records/warranty', params: { id: warranty.id } })}
      testID={`warranty-${warranty.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : state.expired ? 0.75 : 1 })}
    >
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <RowIcon icon={warrantyGlyph(warranty.title)} tone={tone} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt role="rowTitleLarge" numberOfLines={1}>
              {warranty.title}
            </Txt>
            {line === '' ? null : (
              <Txt role="meta" tone="mut" numberOfLines={2}>
                {line}
              </Txt>
            )}
          </View>
          <Badge label={chip.label} tone={chip.tone} />
        </View>

        {!state.expired && progress !== null && warranty.validUntil !== null ? (
          <View style={{ gap: 6 }}>
            <ProgressBar fraction={progress} tone={chip.tone === 'warn' ? 'warn' : 'good'} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Txt role="meta" tone="mut" numberOfLines={1}>
                {`Recorded ${formatLongDate(recordedIso as `${number}-${number}-${number}`)}`}
              </Txt>
              <Txt role="smallStrong" color={c.ink} numberOfLines={1}>
                {`Until ${formatLongDate(warranty.validUntil)}`}
              </Txt>
            </View>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

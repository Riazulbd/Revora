import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Footnote,
  Icon,
  IconSquareButton,
  ListCard,
  MenuRow,
  ProgressBar,
  RecordRow,
  RowIcon,
  Screen,
  SectionEyebrow,
  SkeletonList,
  Txt,
  type IconName,
  type RowTone,
} from '@/components';
import { partHealth, type PartLife } from '@/calculations/parts';
import { partUsedFraction, partUsedPercent } from '@/calculations/partWear';
import { partGlyph } from '@/features/parts/ui/PartsGlyph';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';
import { formatDistance, NO_VALUE } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import type { Part, UnitPreferences } from '@/types';

/**
 * Parts — active, and the removed history under it (Figma `D7 Parts — List`).
 *
 * Every figure on this screen is recomputed from the current odometer on read.
 * A part fitted at 33,010 km shows what it has run *now*, which is why editing
 * an old odometer reading corrects this list instead of leaving it stale.
 */
export default function PartsList() {
  const router = useRouter();
  const { activeBike, units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const active = analytics?.parts.active ?? [];
  const removed = analytics?.parts.removed ?? [];
  const accessoryCount = analytics?.accessories.all.length ?? 0;
  const current = analytics?.odometer.currentMetres ?? null;

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/garage');
  };

  // Figma `Top bar` + `Titles`: the back button and the primary action on one
  // row, the tab-sized title under them.
  const header = (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconSquareButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} testID="back-parts" />
        <Button label="Add part" icon="plus" size="action" onPress={() => router.push('/parts/add')} testID="cta-add-part" />
      </View>
      <View style={{ gap: 2 }}>
        <Txt role="tabTitle">Parts</Txt>
        <Txt role="body" tone="mut" numberOfLines={1}>
          {`${activeBike?.nickname ?? 'Your bike'}${current === null ? '' : ` · odometer ${formatDistance(current, units.distance)}`}`}
        </Txt>
      </View>
    </View>
  );

  if (error) {
    return (
      <Screen wash testID="screen-parts" contentStyle={{ gap: 16 }}>
        {header}
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen wash testID="screen-parts" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={3} height={96} />
      </Screen>
    );
  }

  const empty = active.length === 0 && removed.length === 0;

  return (
    <Screen wash onRefresh={refetch} testID="screen-parts" contentStyle={{ gap: 16 }}>
      {header}

      {empty ? (
        <EmptyState
          icon="wrench"
          title="No parts logged"
          message="Log a part with its expected life and Revora tracks how much of that life is left as you ride."
          primaryAction={{
            label: 'Add a part',
            onPress: () => router.push('/parts/add'),
            testID: 'cta-empty-add-part',
          }}
          secondaryAction={{
            label: 'Accessories',
            onPress: () => router.push('/accessories'),
            testID: 'cta-empty-accessories',
          }}
          variant="page"
          testID="empty-parts"
        />
      ) : (
        <>
          <View>
            <SectionEyebrow first>Active</SectionEyebrow>
            {active.length > 0 ? (
              <ListCard style={{ paddingVertical: 2 }} testID="list-parts-active">
                {active.map(({ part, life }) => (
                  <ActivePartRow key={part.id} part={part} life={life} units={units} />
                ))}
              </ListCard>
            ) : (
              <EmptyState
                icon="wrench"
                iconTone="neutral"
                size="compact"
                title="Nothing fitted right now"
                message="Every part you have logged has been taken off. The history below keeps what each one lasted."
                primaryAction={{
                  label: 'Add a part',
                  onPress: () => router.push('/parts/add'),
                  testID: 'cta-empty-active-add-part',
                }}
                testID="empty-parts-active"
              />
            )}
          </View>

          {active.length > 0 ? (
            <Footnote style={{ marginTop: 0 }} testID="note-parts-wear">
              Wear updates whenever the odometer moves. No bar where no life was recorded — nothing is invented.
            </Footnote>
          ) : null}

          {removed.length > 0 ? (
            <View>
              <SectionEyebrow first>Removed · history</SectionEyebrow>
              <ListCard style={{ opacity: 0.65, paddingVertical: 2 }} testID="list-parts-removed">
                {removed.map(({ part, life }) => (
                  <RemovedPartRow key={part.id} part={part} life={life} units={units} />
                ))}
              </ListCard>
            </View>
          ) : null}

          {/* Figma `Accessories`: the way through to the list, with its count. */}
          <Card variant="list" style={{ paddingVertical: 2 }}>
            <MenuRow
              icon="package"
              iconTone="accent"
              label="Accessories"
              onPress={() => router.push('/accessories')}
              right={
                <Txt role="meta" tone="mut">
                  {accessoryCount === 0 ? 'None yet' : `${accessoryCount} fitted`}
                </Txt>
              }
              testID="row-accessories"
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

/**
 * Figma `Part row`: the name with its standing on the right (`⊘ over by 412
 * km`, `◷ 92% used`, `✓ 25% used`, or `No life recorded`), the fitting line,
 * and a 6px bar filled to the used share.
 *
 * A part with no expected life carries neither a percentage nor a bar: there is
 * nothing to measure it against, and 0% would be a claim nobody made.
 */
function ActivePartRow({ part, life, units }: { part: Part; life: PartLife; units: UnitPreferences }) {
  const router = useRouter();
  const { c } = useTheme();
  const health = partHealth(life);
  const tone: RowTone = health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : health === 'good' ? 'good' : 'neutral';
  const usedPercent = partUsedPercent(life);
  const usedFraction = partUsedFraction(life);

  const statusColor = tone === 'bad' ? c.bad : tone === 'warn' ? c.warn : tone === 'good' ? c.good : c.mut;
  const statusIcon: IconName | null = tone === 'bad' ? 'circleAlert' : tone === 'warn' ? 'clock' : tone === 'good' ? 'check' : null;
  const statusLabel = life.isOverdue
    ? `over by ${formatDistance(life.overdueMetres, units.distance)}`
    : usedPercent === null
      ? 'No life recorded'
      : `${usedPercent}% used`;

  const meta = `Fitted at ${formatDistance(part.installedOdometerMetres, units.distance)} · ${formatDistance(
    life.usedMetres,
    units.distance,
  )} run${part.expectedLifeMetres === null ? '' : ` · expected ${formatDistance(part.expectedLifeMetres, units.distance)}`}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${part.name}. ${statusLabel}. ${meta}`}
      onPress={() => router.push({ pathname: '/parts/[id]', params: { id: part.id } })}
      testID={`part-${part.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, minHeight: HIT_SIZE }}>
        <RowIcon icon={partGlyph(part.name)} tone={tone} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Txt role="rowTitleLarge" numberOfLines={1} style={{ flexShrink: 1 }}>
              {part.name}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {statusIcon ? <Icon name={statusIcon} size={14} color={statusColor} /> : null}
              <Txt role="chip" color={statusColor} numberOfLines={1}>
                {statusLabel}
              </Txt>
            </View>
          </View>
          <Txt role="meta" tone="mut" numberOfLines={2}>
            {meta}
          </Txt>
          {usedFraction === null ? null : (
            <ProgressBar fraction={usedFraction} tone={tone === 'neutral' ? 'accent' : tone} height={6} style={{ marginTop: 2 }} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** Figma `Row` under REMOVED · HISTORY: `Ran 12,500 → 26,700 km · removed 4 Jan`, and what it lasted. */
function RemovedPartRow({ part, life, units }: { part: Part; life: PartLife; units: UnitPreferences }) {
  const router = useRouter();

  const ran =
    part.removedOdometerMetres === null
      ? null
      : `Ran ${formatDistance(part.installedOdometerMetres, units.distance)} → ${formatDistance(
          part.removedOdometerMetres,
          units.distance,
        )}`;
  const meta = [ran, part.removedDate === null ? null : `removed ${formatShortDate(part.removedDate)}`]
    .filter((piece): piece is string => piece !== null)
    .join(' · ');

  const lasted =
    life.actualLifeMetres === null ? NO_VALUE : formatDistance(life.actualLifeMetres, units.distance);

  return (
    <RecordRow
      variant="flush"
      titleSize="large"
      icon="clock"
      iconTone="neutral"
      title={part.name}
      subtitle={meta}
      trailing={
        <Txt role="mediumStrong" tone="mut" numberOfLines={1} style={{ fontFamily: fontFamily[700] }}>
          {lasted}
        </Txt>
      }
      onPress={() => router.push({ pathname: '/parts/[id]', params: { id: part.id } })}
      testID={`part-${part.id}`}
    />
  );
}

import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Footnote,
  ListCard,
  MenuRow,
  ProgressBar,
  RowIcon,
  Screen,
  SectionEyebrow,
  SkeletonList,
  TabHeader,
  Txt,
  type RowTone,
} from '@/components';
import { partHealth, type PartLife } from '@/calculations/parts';
import { partUsedFraction, partUsedPercent } from '@/calculations/partWear';
import { partGlyph } from '@/features/parts/ui/PartsGlyph';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { fontFamily } from '@/theme';
import { formatDistance, NO_VALUE } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import type { Part, UnitPreferences } from '@/types';

/**
 * Parts — active, and the removed history under it.
 *
 * Every figure on this screen is recomputed from the current odometer on read.
 * A part fitted at 33,010 km shows what it has run *now*, which is why editing
 * an old odometer reading corrects this list instead of leaving it stale.
 */
export default function PartsList() {
  const router = useRouter();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const active = analytics?.parts.active ?? [];
  const removed = analytics?.parts.removed ?? [];
  const accessoryCount = analytics?.accessories.all.length ?? 0;

  const header = (
    <TabHeader
      title="Parts"
      action={
        <Button
          label="Add part"
          icon="plus"
          size="compact"
          onPress={() => router.push('/parts/add')}
          testID="cta-add-part"
        />
      }
    />
  );

  if (error) {
    return (
      <Screen testID="screen-parts" contentStyle={{ paddingHorizontal: 20 }}>
        {header}
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-parts" contentStyle={{ paddingHorizontal: 20 }}>
        {header}
        <SkeletonList count={3} height={96} />
      </Screen>
    );
  }

  const empty = active.length === 0 && removed.length === 0;

  return (
    <Screen onRefresh={refetch} testID="screen-parts" contentStyle={{ paddingHorizontal: 20 }}>
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
          {active.length > 0 ? (
            <>
              <SectionEyebrow top={0}>Active</SectionEyebrow>
              <ListCard testID="list-parts-active">
                {active.map(({ part, life }) => (
                  <ActivePartRow key={part.id} part={part} life={life} units={units} />
                ))}
              </ListCard>
              <Footnote style={{ marginTop: 8 }} testID="note-parts-wear">
                Wear updates whenever the odometer moves. No bar where no life was recorded — nothing is
                invented.
              </Footnote>
            </>
          ) : (
            <>
              <SectionEyebrow top={0}>Active</SectionEyebrow>
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
            </>
          )}

          {removed.length > 0 ? (
            <>
              <SectionEyebrow>Removed · history</SectionEyebrow>
              <ListCard style={{ opacity: 0.65 }} testID="list-parts-removed">
                {removed.map(({ part, life }) => (
                  <RemovedPartRow key={part.id} part={part} life={life} units={units} />
                ))}
              </ListCard>
            </>
          ) : null}

          {/* The boards give the accessories list no entrance of its own, and
              this screen is "Parts & accessories" everywhere it is linked from. */}
          <Card variant="list" style={{ marginTop: 18 }}>
            <MenuRow
              label="Accessories"
              onPress={() => router.push('/accessories')}
              right={
                <Txt role="metaSmall" tone="mut">
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
 * `Chain & sprocket set · 85% used`, the reading it was fitted at, and the bar.
 *
 * A part with no expected life carries neither a percentage nor a bar: there is
 * nothing to measure it against, and 0% would be a claim nobody made.
 */
function ActivePartRow({ part, life, units }: { part: Part; life: PartLife; units: UnitPreferences }) {
  const router = useRouter();
  const health = partHealth(life);
  const tone: RowTone = health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : health === 'good' ? 'good' : 'neutral';
  const usedPercent = partUsedPercent(life);
  const usedFraction = partUsedFraction(life);

  const usedLabel = life.isOverdue
    ? `over by ${formatDistance(life.overdueMetres, units.distance)}`
    : usedPercent === null
      ? 'no expected life'
      : `${usedPercent}% used`;

  const meta = `Fitted at ${formatDistance(part.installedOdometerMetres, units.distance)} · ${formatDistance(
    life.usedMetres,
    units.distance,
  )} run · ${
    part.expectedLifeMetres === null
      ? 'no expected life'
      : `expected ${formatDistance(part.expectedLifeMetres, units.distance)}`
  }`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${part.name}. ${usedLabel}. ${meta}`}
      onPress={() => router.push({ pathname: '/parts/[id]', params: { id: part.id } })}
      testID={`part-${part.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14 }}>
        <RowIcon icon={partGlyph(part.name)} tone={tone} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <Txt role="rowTitle" numberOfLines={2} style={{ flexShrink: 1 }}>
              {part.name}
            </Txt>
            {usedPercent === null ? (
              <Txt role="meta" tone="mut" numberOfLines={1}>
                no expected life
              </Txt>
            ) : (
              <Txt
                role="smallStrong"
                tone={tone === 'neutral' ? 'mut' : tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'good'}
                numberOfLines={1}
                style={{ fontFamily: fontFamily[700] }}
              >
                {usedLabel}
              </Txt>
            )}
          </View>
          <Txt role="meta" tone="mut" numberOfLines={2} style={{ marginTop: 2 }}>
            {meta}
          </Txt>
          {usedFraction === null ? null : (
            <ProgressBar
              fraction={usedFraction}
              tone={tone === 'neutral' ? 'accent' : tone}
              height={6}
              style={{ marginTop: 8 }}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** `Old chain set · Ran 30,900 → 33,010 km · removed 2 Jul`, and what it lasted. */
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${part.name}. ${meta}. Lasted ${lasted}`}
      onPress={() => router.push({ pathname: '/parts/[id]', params: { id: part.id } })}
      testID={`part-${part.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 13 }}>
        <RowIcon icon="clock" tone="neutral" size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt role="rowTitle" numberOfLines={2}>
            {part.name}
          </Txt>
          <Txt role="meta" tone="mut" numberOfLines={2}>
            {meta}
          </Txt>
        </View>
        <Txt role="smallStrong" tone="mut" numberOfLines={1} style={{ fontFamily: fontFamily[700] }}>
          {lasted}
        </Txt>
      </View>
    </Pressable>
  );
}

import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  DateChip,
  EmptyState,
  ErrorState,
  HeroCard,
  HeroHead,
  ListCard,
  RecordRow,
  Screen,
  ScreenHeader,
  SectionEyebrow,
  SkeletonList,
  Txt,
  type IconName,
  type RowTone,
} from '@/components';
import { currentCondition, type AreaState } from '@/calculations/safety';
import { areaRowLine, readiness, safetySessions, sessionLine, sessionTitle, type SafetySession } from '@/calculations/safetySessions';
import { useSafetyChecks } from '@/features/records/useRecordQueries';
import { HeroSegments, InkAddButton, StatusDots } from '@/features/records/ui/RecordsChrome';
import { useTheme } from '@/theme';
import { todayIso } from '@/utils/date';
import type { SafetyArea, SafetyStatus } from '@/types';

/**
 * Safety and condition (Figma `R5 Records — Safety checks`).
 *
 * Two questions, in the order a rider has them. First: is anything wrong right
 * now? That is the latest word on each area — the hero's `3/5 areas good`, one
 * segment per area, and the sentence naming what is not right. An area nobody
 * has ever looked at is its own state: the absence of a check is not a pass.
 *
 * Second: what has been looked at before? Checks are stored one per area, so
 * the history groups them back into the walk-arounds they came from. Nothing
 * stores a session; a session is just a shared date.
 */

/** Figma `Tile` per area. Presentation only. */
export const SAFETY_AREA_GLYPH: Record<SafetyArea, IconName> = {
  tyres: 'tyre',
  chain: 'link',
  brakes: 'disc',
  battery: 'battery',
  lights: 'lightbulb',
};

const STATUS_CHIP: Record<SafetyStatus, { label: string; tone: 'good' | 'warn' | 'bad' }> = {
  ok: { label: 'Good', tone: 'good' },
  watch: { label: 'Watch', tone: 'warn' },
  action: { label: 'Bad', tone: 'bad' },
};

export default function SafetyLog() {
  const router = useRouter();
  const { c } = useTheme();
  const checks = useSafetyChecks();
  const today = todayIso();

  const items = checks.data ?? [];
  const addCheck = () => router.push('/records/safety-add');

  const header = (
    <ScreenHeader
      title="Safety"
      action={<InkAddButton onPress={addCheck} accessibilityLabel="New check" testID="cta-add-check" />}
      style={{ marginBottom: 0 }}
    />
  );

  if (checks.isPending) {
    return (
      <Screen wash testID="screen-safety" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  if (checks.isError) {
    return (
      <Screen wash testID="screen-safety" contentStyle={{ gap: 16 }}>
        {header}
        <ErrorState
          message="Your checks are on this phone and in your account — this screen just couldn't read them."
          onRetry={() => void checks.refetch()}
          testID="error-safety"
        />
      </Screen>
    );
  }

  const states = currentCondition(items).sort((a, b) => ORDER.indexOf(a.area) - ORDER.indexOf(b.area));
  const ready = readiness(items, today);
  const sessions = safetySessions(items);

  const openArea = (state: AreaState) =>
    router.push(
      state.latest === null
        ? { pathname: '/records/safety-add', params: { area: state.area } }
        : { pathname: '/records/safety-add', params: { id: state.latest.id } },
    );

  return (
    <Screen wash onRefresh={async () => void (await checks.refetch())} testID="screen-safety" contentStyle={{ gap: 16 }}>
      {header}

      {items.length === 0 ? (
        <EmptyState
          icon="shieldCheck"
          title="Two minutes before a ride"
          message="Walk around the bike and mark each area good, watch or bad. No score, no grade — just what you’d act on."
          primaryAction={{ label: 'Start first check', onPress: addCheck, testID: 'cta-first-check' }}
          variant="page"
          testID="empty-safety"
        />
      ) : (
        <>
          {/* Figma `Hero — dark accent`: ready to ride? */}
          <HeroCard gap={14} testID="hero-safety">
            <HeroHead eyebrow="Ready to ride?" {...(ready.checkedLabel === null ? {} : { chip: ready.checkedLabel })} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt role="hero" color={c.heroInk}>{`${ready.good}/${ready.total}`}</Txt>
              <Txt role="cardTitle" color={c.heroMut} style={{ fontWeight: '500' }}>
                areas good
              </Txt>
            </View>
            <HeroSegments segments={ready.segments} />
            <Txt role="bodySmall" color={c.heroChipInk}>
              {ready.sentence ?? 'Nothing needs a look right now.'}
            </Txt>
          </HeroCard>

          <View>
            <SectionEyebrow first>Current — latest check per area</SectionEyebrow>
            <ListCard style={{ paddingVertical: 4 }} testID="list-safety-current">
              {states.map((state) => (
                <AreaRow key={state.area} state={state} onPress={() => openArea(state)} />
              ))}
            </ListCard>
          </View>

          {sessions.length === 0 ? null : (
            <View>
              <SectionEyebrow first>History</SectionEyebrow>
              <ListCard style={{ paddingVertical: 4 }} testID="list-safety-history">
                {sessions.map((session) => (
                  <SessionRow key={session.date} session={session} />
                ))}
              </ListCard>
            </View>
          )}

          <Button label="New check" icon="clipboard" size="xlarge" onPress={addCheck} testID="cta-new-check" />
        </>
      )}
    </Screen>
  );
}

/** The walk order the board lists the areas in. */
const ORDER: readonly SafetyArea[] = ['tyres', 'chain', 'brakes', 'battery', 'lights'];

/** Figma `Row` on the Areas card: tile in the status tone, the area, its line, a chip. */
function AreaRow({ state, onPress }: { state: AreaState; onPress: () => void }) {
  const chip = state.status === null ? null : STATUS_CHIP[state.status];
  const tone: RowTone = chip === null ? 'neutral' : chip.tone;
  return (
    <RecordRow
      variant="flush"
      icon={SAFETY_AREA_GLYPH[state.area]}
      iconTone={tone}
      title={state.label}
      subtitle={areaRowLine(state)}
      {...(chip === null ? { badge: <Badge label="Never checked" tone="neutral" /> } : { badge: <Badge label={chip.label} tone={chip.tone} /> })}
      onPress={onPress}
      testID={`safety-area-${state.area}`}
    />
  );
}

/** Figma `Row` on the History card: the date block, the session, and a dot per status present. */
function SessionRow({ session }: { session: SafetySession }) {
  const router = useRouter();
  const id = session.rows[0]?.checkIds[0];
  return (
    <RecordRow
      variant="flush"
      leading={<DateChip date={session.date} />}
      title={sessionTitle(session)}
      subtitle={sessionLine(session)}
      trailing={<StatusDots statuses={session.rows.map((row) => row.status)} />}
      {...(id === undefined ? {} : { onPress: () => router.push({ pathname: '/records/safety-add', params: { id } }) })}
      testID={`safety-${id ?? session.date}`}
    />
  );
}

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
  RowIcon,
  Screen,
  SectionEyebrow,
  SkeletonList,
  TabHeader,
  Txt,
} from '@/components';
import { currentCondition, type AreaState } from '@/calculations/safety';
import {
  actionAreas,
  actionHeadline,
  areaConditionLine,
  daysAgoLabel,
  observedSummary,
  odometerMetresOn,
  safetySessions,
  type SafetySession,
  type SafetySessionRow,
} from '@/calculations/safetySessions';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useSafetyChecks } from '@/features/records/useRecordQueries';
import { SAFETY_AREA_ICON } from '@/features/records/ui/RecordsWalkaroundRow';
import { formatDistance, NO_VALUE } from '@/utils/format';
import { formatShortDate, todayIso } from '@/utils/date';
import { fontFamily, HIT_SIZE, useTheme } from '@/theme';
import type { SafetyStatus } from '@/types';

/**
 * Safety and condition.
 *
 * Two questions, in the order a rider has them. First: is anything wrong right
 * now? That is the latest word on each area, and an area nobody has ever looked
 * at gets its own state — the absence of a check is not a pass, and showing it
 * green would be the app vouching for something it has never seen.
 *
 * Second: what has been looked at before? Checks are stored one per area, so
 * the history groups them back into the walk-arounds they came from. Nothing
 * stores a session; a session is just a shared date.
 */
export default function SafetyLog() {
  const router = useRouter();
  const { units } = useGarage();
  const { analytics } = useGarageData();
  const checks = useSafetyChecks();
  const today = todayIso();

  const items = checks.data ?? [];

  if (checks.isPending) {
    return (
      <Screen testID="screen-safety" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Safety" />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  if (checks.isError) {
    return (
      <Screen testID="screen-safety" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Safety" />
        <ErrorState
          message="Your checks are on this phone and in your account — this screen just couldn't read them."
          onRetry={() => void checks.refetch()}
          testID="error-safety"
        />
      </Screen>
    );
  }

  const states = currentCondition(items);
  const needsAction = actionAreas(items);
  const headline = actionHeadline(needsAction);
  const sessions = safetySessions(items);
  const points = analytics?.odometer.points ?? [];
  const nothingChecked = items.length === 0;

  const openArea = (state: AreaState) =>
    router.push(
      state.latest === null
        ? { pathname: '/records/safety-add', params: { area: state.area } }
        : { pathname: '/records/safety-add', params: { id: state.latest.id } },
    );

  return (
    <Screen
      onRefresh={async () => void (await checks.refetch())}
      testID="screen-safety"
      contentStyle={{ paddingHorizontal: 20 }}
    >
      <TabHeader
        title="Safety"
        action={
          nothingChecked ? undefined : (
            <Button
              label="New check"
              icon="plus"
              size="compact"
              onPress={() => router.push('/records/safety-add')}
              testID="cta-add-check"
            />
          )
        }
      />

      {needsAction.length > 0 && headline !== null ? (
        <ActionAlert states={needsAction} headline={headline} today={today} onPress={openArea} />
      ) : null}

      {nothingChecked ? null : (
        <SectionEyebrow top={needsAction.length > 0 ? 16 : 0}>CURRENT — LATEST CHECK PER AREA</SectionEyebrow>
      )}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          ...(nothingChecked ? { marginBottom: 14 } : {}),
        }}
      >
        {states.map((state) => (
          <AreaTile key={state.area} state={state} today={today} onPress={() => openArea(state)} />
        ))}
      </View>

      {nothingChecked ? (
        <EmptyState
          icon="shield"
          size="compact"
          title="Two minutes before a ride"
          message="Walk around the bike and mark each area OK, watch or action. No score, no grade — just what you’d act on."
          primaryAction={{
            label: 'Start first check',
            onPress: () => router.push('/records/safety-add'),
            testID: 'cta-add-check',
          }}
          testID="empty-safety"
        />
      ) : (
        <>
          <Footnote style={{ marginTop: 8 }}>
            Never checked is its own state — absence of a check is not “OK”.
          </Footnote>

          {sessions.length === 0 ? null : (
            <>
              <SectionEyebrow>HISTORY</SectionEyebrow>
              <Card variant="list">
                {sessions.map((session, index) => (
                  <SessionGroup
                    key={session.date}
                    session={session}
                    first={index === 0}
                    last={index === sessions.length - 1}
                    odometerLabel={
                      points.length === 0
                        ? NO_VALUE
                        : formatDistance(odometerMetresOn(points, session.date), units.distance)
                    }
                  />
                ))}
              </Card>
              <Footnote style={{ marginTop: 8 }}>
                Each row is one area. Checks made the same day group into a session; the data stores no
                session — just the checks.
              </Footnote>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/**
 * The one thing on this screen that is not a list: an area marked for action is
 * a live fault, and it stays on the Dashboard until a later check clears it.
 */
function ActionAlert({
  states,
  headline,
  today,
  onPress,
}: {
  states: readonly AreaState[];
  headline: string;
  today: string;
  onPress: (state: AreaState) => void;
}) {
  const { c, radius } = useTheme();
  const first = states[0];
  if (first === undefined || first.latest === null) return null;

  const observed = observedSummary(first.latest);
  const detail = `${observed === null ? 'Marked' : `${observed} — marked`} ${daysAgoLabel(
    first.latest.date,
    today,
  )}. Shows on the Dashboard until cleared.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${detail}`}
      onPress={() => onPress(first)}
      testID="safety-action-alert"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          backgroundColor: c.sur,
          borderWidth: 1.5,
          borderColor: c.bad,
          borderRadius: radius.listCard,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <RowIcon tone="bad">
          <Icon name={SAFETY_AREA_ICON[first.area]} size={16} color={c.bad} strokeWidth={1.8} />
        </RowIcon>
        <View style={{ flex: 1 }}>
          <Txt role="rowTitle" tone="bad">
            {headline}
          </Txt>
          <Txt role="meta" style={{ marginTop: 2 }}>
            {detail}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

const DOT: Record<SafetyStatus, 'good' | 'warn' | 'bad'> = { ok: 'good', watch: 'warn', action: 'bad' };

/** One area on the Current grid: its name, a dot, and one line of words. */
function AreaTile({
  state,
  today,
  onPress,
}: {
  state: AreaState;
  today: string;
  onPress: () => void;
}) {
  const { c, radius } = useTheme();
  const never = state.status === null;
  const tone = state.status === null ? c.brd : c[DOT[state.status]];
  const line = areaConditionLine(state, today);
  const lineColor = state.status === 'action' ? c.bad : state.status === 'watch' ? c.warn : c.mut;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${state.label}. ${line}`}
      onPress={onPress}
      testID={`safety-area-${state.area}`}
      style={({ pressed }) => ({ width: '48%', opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          borderRadius: radius.tile,
          backgroundColor: never ? c.sur2 : c.sur,
          borderWidth: 1,
          borderStyle: never ? 'dashed' : 'solid',
          borderColor: c.brd,
          paddingVertical: 11,
          paddingHorizontal: 12,
          minHeight: HIT_SIZE,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Txt
            numberOfLines={1}
            style={{ fontFamily: fontFamily[700], fontSize: 13, color: never ? c.mut : c.ink, flexShrink: 1 }}
          >
            {state.label}
          </Txt>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone, flexShrink: 0 }} />
        </View>
        <Txt role="micro" color={lineColor} numberOfLines={1} style={{ marginTop: 3 }}>
          {line}
        </Txt>
      </View>
    </Pressable>
  );
}

/** One day's walk-around: a header, then one row per status. */
function SessionGroup({
  session,
  first,
  last,
  odometerLabel,
}: {
  session: SafetySession;
  first: boolean;
  last: boolean;
  odometerLabel: string;
}) {
  const { c } = useTheme();

  return (
    <View style={first ? undefined : { borderTopWidth: 1, borderTopColor: c.brd }}>
      <Txt
        uppercase
        style={{
          fontFamily: fontFamily[700],
          fontSize: 11,
          letterSpacing: 0.4,
          color: c.mut,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        {formatShortDate(session.date)} · {odometerLabel} · {session.areaCount} area
        {session.areaCount === 1 ? '' : 's'}
      </Txt>
      {session.rows.map((row, index) => (
        <SessionRow
          key={`${session.date}-${row.status}`}
          row={row}
          last={last && index === session.rows.length - 1}
        />
      ))}
    </View>
  );
}

function SessionRow({ row, last }: { row: SafetySessionRow; last: boolean }) {
  const router = useRouter();
  const { c } = useTheme();
  const id = row.checkIds[0];

  const words = `${row.label} · ${row.statusLabel}${row.detail === null ? '' : ` · ${row.detail}`}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={words}
      disabled={id === undefined}
      onPress={() => id && router.push({ pathname: '/records/safety-add', params: { id } })}
      testID={`safety-${id ?? row.status}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: HIT_SIZE,
        paddingVertical: 9,
        paddingBottom: last ? 13 : 9,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.brd,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c[DOT[row.status]], flexShrink: 0 }}
      />
      <Txt role="meta" tone="mut" style={{ flex: 1 }}>
        <Txt role="rowTitleDense">{row.label}</Txt> · {row.statusLabel}
        {row.detail === null ? '' : ` · ${row.detail}`}
      </Txt>
      {row.hasPhoto ? <Icon name="camera" size={14} color={c.mut} strokeWidth={2} /> : null}
    </Pressable>
  );
}

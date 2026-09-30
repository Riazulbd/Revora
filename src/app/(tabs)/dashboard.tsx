import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Banner,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
  Footnote,
  Gauge,
  Icon,
  LinkButton,
  RowIcon,
  Screen,
  SkeletonList,
  Stack,
  StatRow,
  StatTile,
  TabHeader,
  Txt,
} from '@/components';
import { efficiencyToDisplay, mileageGaugeMax, mileageUnitLabel } from '@/calculations/units';
import { confidenceLabel, mileageBlockerMessage } from '@/calculations/mileage';
import { SETTLED_DISTANCE_FOR_COST_PER_UNIT } from '@/calculations/ownership';
import {
  activityDetail,
  activityTitle,
  agoPhrase,
  compactAgo,
  costPerDistanceNote,
  lastRideMetres,
  maintenanceDueLine,
  maintenanceHighlights,
  odometerUpdatedLine,
  weekdayDate,
} from '@/calculations/dashboard';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { DashboardAdCard } from '@/features/ads/DashboardAdCard';
import { useConnectivity } from '@/services/connectivity';
import { formatMonthLabel, monthKey, todayIso } from '@/utils/date';
import { formatCurrency, formatDistanceValue, formatMileageValue, formatRate } from '@/utils/format';
import { fontFamily, useTheme } from '@/theme';
import { AttentionCard } from '@/features/dashboard/AttentionCard';
import { DashboardSearchBar, EntryActions, QuickTiles } from '@/features/dashboard/EntryLayer';
import { OverflowMenu } from '@/features/dashboard/OverflowMenu';
import { ruleGlyph } from '@/features/dashboard/ui/RuleGlyph';
import { useAttention } from '@/features/dashboard/useAttention';

/**
 * The Dashboard, built entirely from the rider's own records.
 *
 * The board's order is the argument: what is wrong with the motorcycle, then
 * where it stands, then what it costs to run, then what is coming, then what
 * was logged last. Nothing above the fold is a number the rider has to go and
 * ask for.
 *
 * Where a figure cannot be computed it says so — there is no sample data, and
 * no zero standing in for "we don't know yet" (requirement 21 / 31).
 */
export default function Dashboard() {
  const router = useRouter();
  const { activeBike, isPro } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const connectivity = useConnectivity();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const attention = useAttention();

  const today = analytics?.today ?? todayIso();
  // The load-error board drops the bike's name: with no records loaded, the app
  // cannot honestly claim which motorcycle this screen is about.
  const named = error === null && activeBike !== null;

  return (
    <Screen variant="tab" onRefresh={refetch} testID="screen-dashboard">
      <TabHeader
        title={named ? activeBike.nickname : 'Dashboard'}
        {...(named
          ? { subtitle: `${activeBike.manufacturer} ${activeBike.model} · ${weekdayDate(today)}` }
          : {})}
        action={<EntryActions count={attention.count} onOverflow={() => setOverflowOpen(true)} />}
        style={{ marginBottom: 12 }}
      />

      {/* Search and the one-tap destinations. Everything the retired fifth tab
          reached is found here, or arrives by itself in the card below. */}
      <DashboardSearchBar />
      <View style={{ marginTop: 10 }}>
        <QuickTiles
          documentsExpiring={attention.documentsExpiring}
          variant={error ? 'degraded' : 'default'}
        />
      </View>
      {error ? (
        <Footnote>
          Both still work — capture queues locally, offline documents open without the server.
        </Footnote>
      ) : null}

      {!connectivity.isOnline ? (
        <Banner
          tone="offline"
          message="You're offline. Everything still works — logs save here and sync later."
          style={{ marginTop: 12 }}
          testID="banner-offline"
        />
      ) : null}

      <View style={{ marginTop: 12 }}>
        {error ? (
          <Stack>
            <AttentionCard items={[]} hasError />
            <ErrorState
              title="Couldn't load your records"
              message="Your data is safe on your account — this is a loading problem, not a data problem."
              onRetry={() => void refetch()}
              testID="state-dashboard-error"
            />
          </Stack>
        ) : isPending && analytics === null ? (
          <SkeletonList count={4} height={110} />
        ) : analytics === null ? (
          <EmptyState
            icon="motorcycle"
            title="No motorcycle selected"
            message="Add a motorcycle and your dashboard fills in from what you log."
            primaryAction={{
              label: 'Add a motorcycle',
              onPress: () => router.push('/(onboarding)/add-bike'),
              testID: 'cta-add-bike',
            }}
            variant="page"
          />
        ) : (
          <Stack>
            <AttentionCard
              items={attention.items}
              isPending={attention.isPending}
              hasRecords={!analytics.isEmpty}
            />
            <OdometerCard analytics={analytics} />
            <MileageCard analytics={analytics} />
            <MaintenanceCard analytics={analytics} />
            <ActivityCard analytics={analytics} />
            {isPro ? null : <DashboardAdCard />}
          </Stack>
        )}
      </View>

      <OverflowMenu visible={overflowOpen} onClose={() => setOverflowOpen(false)} isPro={isPro} />
    </Screen>
  );
}

type CardProps = { analytics: NonNullable<ReturnType<typeof useGarageData>['analytics']> };

/**
 * `border-radius:18px; padding:18px 16px 16px; gap:12px` — the odometer, the
 * three tiles it pays for, and the one sentence that says how much of the log
 * they rest on.
 */
function OdometerCard({ analytics }: CardProps) {
  const { units, currency, odometer } = analytics;

  const ride = lastRideMetres(odometer.points);
  const loggedFuel = analytics.fuel.entries.length > 0;
  const note = costPerDistanceNote({
    trackedMetres: analytics.ownership.distanceMetres,
    settledMetres: SETTLED_DISTANCE_FOR_COST_PER_UNIT,
    distanceUnit: units.distance,
  });

  return (
    <Card style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
      <Eyebrow>CURRENT ODOMETER</Eyebrow>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Txt role="hero" numberOfLines={1} adjustsFontSizeToFit>
          {formatDistanceValue(odometer.currentMetres, units.distance)}
        </Txt>
        <Txt tone="mut" style={{ fontFamily: fontFamily[700], fontSize: 15 }}>
          {units.distance}
        </Txt>
      </View>

      <Txt role="meta" tone="mut" numberOfLines={2}>
        {odometerUpdatedLine({
          latest: odometer.latest,
          lastRideMetres: ride,
          distanceUnit: units.distance,
          today: analytics.today,
        })}
      </Txt>

      <StatRow>
        <StatTile
          label={`FUEL · ${formatMonthLabel(monthKey(analytics.today)).toUpperCase()}`}
          {...(loggedFuel ? { value: formatCurrency(analytics.fuel.thisMonthSpendMinor, currency) } : {})}
        />
        <StatTile
          label={`COST / ${units.distance.toUpperCase()}`}
          value={formatRate(analytics.ownership.costPerDistanceScaled, currency)}
        />
        <StatTile
          label="LAST FILL"
          {...(analytics.fuel.latest
            ? { value: compactAgo(analytics.fuel.latest.date, analytics.today) }
            : {})}
        />
      </StatRow>

      {/* One slot, two truths: an empty log has nothing to settle, and a short
          one is shown with the distance it rests on rather than withheld. */}
      {!loggedFuel ? (
        <Txt role="helper" tone="mut">
          Nothing logged yet — these fill in with your first fuel record.
        </Txt>
      ) : note ? (
        <Txt role="helper" tone="mut" testID="hint-cost-per-distance">
          {note}
        </Txt>
      ) : null}
    </Card>
  );
}

/**
 * The gauge card. A measured interval when there is one; otherwise the estimate
 * drawn across the whole log, labelled as an estimate and told what would
 * replace it. A rider several fills in is never shown a blank card with no idea
 * whether the app is working.
 */
function MileageCard({ analytics }: CardProps) {
  const router = useRouter();
  const { units, mileage } = analytics;

  const measured = mileage.latest;
  const shown = measured ?? mileage.provisional;
  const estimated = measured === null && mileage.provisional !== null;
  const unitLabel = mileageUnitLabel(units.mileage);

  if (shown === null) {
    return (
      <EmptyState
        icon="fuelPump"
        title="Log your first fill"
        message={
          mileage.blockedBy === null || analytics.fuel.entries.length === 0
            ? 'Mileage is measured between two full-tank fills. Fill up, log it, and the second fill starts telling you the truth about your bike.'
            : mileageBlockerMessage(mileage.blockedBy)
        }
        primaryAction={{
          label: 'Log first fill',
          onPress: () => router.push('/fuel/add'),
          testID: 'cta-first-fill',
        }}
        testID="state-no-mileage"
      />
    );
  }

  const confidence = estimated ? 'estimated' : mileage.confidence;

  return (
    <Card style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
      <Eyebrow>LATEST MILEAGE</Eyebrow>

      <Gauge
        value={efficiencyToDisplay(shown.efficiency, units.mileage)}
        max={mileageGaugeMax(units.mileage)}
        caption={`${unitLabel} · ${
          estimated ? 'estimated across the whole log' : `measured ${agoPhrase(shown.date, analytics.today)}`
        }`}
        estimated={estimated}
        testID="gauge-mileage"
      />

      <StatRow gap={7}>
        <StatTile
          variant="centered"
          label="AVERAGE"
          value={formatMileageValue(mileage.average, units.mileage)}
        />
        <StatTile variant="centered" label="INTERVALS" value={String(mileage.count)} />
        <StatTile
          variant="centered"
          label="CONFIDENCE"
          badge={
            <Badge
              variant="outlined"
              tone={
                confidence === 'high'
                  ? 'good'
                  : confidence === 'medium'
                    ? 'warn'
                    : confidence === 'estimated'
                      ? 'warn'
                      : 'neutral'
              }
              label={confidenceLabel(confidence)}
            />
          }
        />
      </StatRow>

      {/* An estimate has to say it is one, and say what would replace it. */}
      {estimated ? (
        <Txt role="helper" tone="mut" testID="hint-mileage-estimated">
          Estimated across your whole log — no interval measured yet.{' '}
          {mileage.blockedBy === null
            ? 'Two full-tank fills in a row will replace this with a measured figure.'
            : mileageBlockerMessage(mileage.blockedBy)}
        </Txt>
      ) : null}
    </Card>
  );
}

/**
 * Two rules and a count. The card is a summary, not the list — which is why
 * "4 other rules OK" is a sentence rather than four more rows.
 */
function MaintenanceCard({ analytics }: CardProps) {
  const router = useRouter();
  const { c } = useTheme();
  const { activeBike } = useGarage();
  const { units } = analytics;

  const rules = analytics.maintenance.rules;

  if (rules.length === 0) {
    return (
      <Card style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 14 }}>
        <Eyebrow style={{ marginBottom: 8 }}>MAINTENANCE</Eyebrow>
        <Txt role="body" tone="mut">
          No rules yet.{' '}
          <Txt
            accessibilityRole="link"
            tone="acc"
            style={{ fontFamily: fontFamily[700] }}
            onPress={() => router.push('/maintenance')}
            testID="link-starter-rules"
          >
            {`Add the starter set for the ${activeBike?.model ?? 'your bike'}`}
          </Txt>{' '}
          — oil, chain, air filter.
        </Txt>
      </Card>
    );
  }

  const { shown, otherOkCount } = maintenanceHighlights(rules);

  return (
    <Card style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 8 }}>
      <Eyebrow style={{ marginBottom: 10 }}>MAINTENANCE</Eyebrow>

      {shown.map(({ rule, status }, index) => {
        const overdue = status.kind === 'overdue';
        return (
          <View key={rule.id}>
            {index > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${rule.name}. ${maintenanceDueLine(status, units.distance)}`}
              onPress={() => router.push({ pathname: '/maintenance/rule', params: { id: rule.id } } as never)}
              testID={`maintenance-${rule.id}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 10,
                minHeight: 44,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <RowIcon
                icon={ruleGlyph(rule.name)}
                tone={overdue ? 'bad' : status.kind === 'due_soon' ? 'warn' : 'neutral'}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt role="rowTitle" numberOfLines={1}>
                  {rule.name}
                </Txt>
                <Txt role="meta" tone={overdue ? 'bad' : 'mut'} numberOfLines={1}>
                  {maintenanceDueLine(status, units.distance)}
                </Txt>
              </View>
              <Icon name="chevronRight" size={16} color={c.mut} strokeWidth={2} />
            </Pressable>
          </View>
        );
      })}

      {otherOkCount > 0 ? (
        <>
          {shown.length > 0 ? <Divider /> : null}
          <Txt role="meta" tone="mut" style={{ paddingTop: 10, paddingBottom: 12 }}>
            {`${otherOkCount} other rule${otherOkCount === 1 ? '' : 's'} OK`}
          </Txt>
        </>
      ) : null}
    </Card>
  );
}

/** The last three things the rider logged, whatever kind they were. */
function ActivityCard({ analytics }: CardProps) {
  const router = useRouter();
  const { units, currency } = analytics;
  const recent = analytics.ledger.slice(0, 3);

  if (recent.length === 0) return null;

  const context = { fuelEntries: analytics.fuel.entries, services: analytics.services.all };

  return (
    <Card style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <Eyebrow>RECENT ACTIVITY</Eyebrow>
        <LinkButton
          label="View all"
          size="medium"
          onPress={() => router.push('/(tabs)/expenses')}
          testID="link-activity-all"
        />
      </View>

      {recent.map((entry, index) => (
        <View key={entry.id}>
          {index > 0 ? <Divider /> : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              minHeight: 44,
            }}
          >
            <RowIcon
              size={34}
              icon={entry.source === 'fuel' ? 'fuelPump' : entry.source === 'service' ? 'wrench' : 'document'}
              tone={entry.source === 'fuel' ? 'accent' : entry.source === 'service' ? 'good' : 'neutral'}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt role="rowTitle" numberOfLines={1}>
                {activityTitle(entry)}
              </Txt>
              <Txt role="meta" tone="mut" numberOfLines={1}>
                {activityDetail(entry, context, units.distance)}
              </Txt>
            </View>
            <Txt role="rowTitle" numberOfLines={1}>
              {formatCurrency(entry.amountMinor, currency)}
            </Txt>
          </View>
        </View>
      ))}
    </Card>
  );
}

import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Button,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Footnote,
  HeroCard,
  HeroHead,
  ListCard,
  MenuRow,
  RecordRow,
  Screen,
  SkeletonList,
  TabHeader,
  Txt,
} from '@/components';
import type { IconName, RowTone, SegmentedOption } from '@/components';
import {
  SERVICE_CATEGORY_LABEL,
  filterServices,
  primaryServiceCategory,
  serviceFilters,
  type ServiceCategory,
  type ServiceFilter,
} from '@/calculations/serviceCategories';
import { serviceSpendSummary } from '@/calculations/serviceSpend';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { ServiceSpendChart } from '@/features/services/ui/ServiceSpendChart';
import { useTheme } from '@/theme';
import { formatCurrencySymbol, formatDistance } from '@/utils/format';
import { formatShortDate } from '@/utils/date';

/**
 * Service history (Figma `D4 Services — History`).
 *
 * The board's own shape: the last year's spend in the dark card, the category
 * chips, then the visits. Nothing here is stored — the chips, the glyph on each
 * row and the figures in the card are all derived from the records on read, so
 * a renamed or corrected service takes every figure with it (requirement 3).
 */

/** What each category looks like on a row (Figma `Tile`). Presentation only — the category itself is derived. */
const ROW_LOOK: Record<ServiceCategory, { icon: IconName; tone: RowTone }> = {
  oil: { icon: 'droplet', tone: 'accent' },
  brakes: { icon: 'disc', tone: 'bad' },
  chain: { icon: 'link', tone: 'info' },
  tyres: { icon: 'circleDot', tone: 'neutral' },
  other: { icon: 'wrench', tone: 'neutral' },
};

export default function ServiceHistory() {
  const router = useRouter();
  const { c } = useTheme();
  const { activeBike, units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const [filter, setFilter] = useState<ServiceFilter>('all');

  const services = analytics?.services.all ?? [];
  const currency = analytics?.currency ?? 'BDT';

  const addService = () => router.push('/services/add');

  const header = (
    <TabHeader
      title="Services"
      subtitle={activeBike ? `${activeBike.nickname} · ${activeBike.model}` : undefined}
      action={<Button label="Log a service" icon="plus" size="action" onPress={addService} testID="cta-add-service" />}
      style={{ marginBottom: 0 }}
    />
  );

  if (error) {
    return (
      <Screen wash testID="screen-services" contentStyle={{ gap: 16 }}>
        {header}
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen wash testID="screen-services" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={4} height={68} />
      </Screen>
    );
  }

  const filters = serviceFilters(services);
  // A chip the rider is standing on can disappear when the last service under
  // it is deleted; falling back to All beats showing an empty list forever.
  const active = filters.includes(filter) ? filter : 'all';
  const shown = filterServices(services, active);
  const spend = serviceSpendSummary(shown, analytics?.today ?? '1970-01-01');

  const options: SegmentedOption<ServiceFilter>[] = filters.map((value) => ({
    value,
    label: value === 'all' ? 'All' : SERVICE_CATEGORY_LABEL[value],
  }));

  return (
    <Screen wash onRefresh={refetch} testID="screen-services" contentStyle={{ gap: 16 }}>
      {header}

      {services.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="No services recorded"
          message="Every service you log here proves your bike's care at resale — and resets the maintenance rules it covered."
          primaryAction={{ label: 'Log a service', onPress: addService }}
          variant="page"
          testID="empty-services"
        />
      ) : (
        <>
          {/* Figma `Spend card`: the last twelve months under whichever chip is on. */}
          <HeroCard gap={14} testID="services-total">
            <HeroHead
              eyebrow={active === 'all' ? 'All services' : SERVICE_CATEGORY_LABEL[active]}
              chip={`${spend.visits} visit${spend.visits === 1 ? '' : 's'} · last 12 months`}
            />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt role="display" color={spend.visits === 0 ? c.heroMut : c.heroInk} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 40, lineHeight: 50, letterSpacing: -0.8 }}>
                {formatCurrencySymbol(spend.totalMinor, currency)}
              </Txt>
              {spend.averageMinor === null ? null : (
                <Txt role="mediumStrong" color={c.heroMut} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {`avg ${formatCurrencySymbol(spend.averageMinor, currency)} / visit`}
                </Txt>
              )}
            </View>
            <ServiceSpendChart summary={spend} testID="chart-service-spend" />
          </HeroCard>

          {/* Figma `Filter chips`: 48px pills, scrolling off the right edge. */}
          {options.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16 }}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              <ChipGroup options={options} value={active} onChange={setFilter} size="large" wrap={false} testID="filter-services" />
            </ScrollView>
          ) : null}

          {shown.length === 0 ? (
            /* A filter with nothing under it says so, rather than leaving a
               blank where the rider expects their history. */
            <EmptyState
              icon="wrench"
              title={`No ${active === 'all' ? '' : `${SERVICE_CATEGORY_LABEL[active].toLowerCase()} `}services yet`}
              message="Nothing in your history matches this filter. Tap All to see every visit."
              primaryAction={{ label: 'Show all services', onPress: () => setFilter('all') }}
              testID="empty-services-filtered"
            />
          ) : (
            <ListCard style={{ paddingVertical: 2 }} testID="service-list">
              {shown.map((service) => {
                const look = ROW_LOOK[primaryServiceCategory(service)];
                return (
                  <RecordRow
                    key={service.id}
                    variant="flush"
                    titleSize="large"
                    icon={look.icon}
                    iconTone={look.tone}
                    title={service.title}
                    subtitle={`${formatShortDate(service.date)} · ${
                      service.selfService ? 'Self-service' : (service.workshop ?? 'Workshop')
                    }${service.odometerMetres === null ? '' : ` · ${formatDistance(service.odometerMetres, units.distance)}`}`}
                    amount={formatCurrencySymbol(service.totalCostMinor, service.currency)}
                    onPress={() => router.push({ pathname: '/services/add', params: { id: service.id } })}
                    testID={`service-${service.id}`}
                  />
                );
              })}
            </ListCard>
          )}

          {/* Figma `Workshop link`. */}
          <Card variant="list" style={{ paddingVertical: 6 }}>
            <MenuRow
              icon="building"
              iconTone="info"
              label="Workshop records"
              subtitle="Quotes vs invoices, by workshop"
              onPress={() => router.push('/services/workshop')}
              testID="row-workshop-records"
            />
          </Card>

          {/* Riders see a part in the parts list and the same money inside a
              service total, and reasonably suspect it was counted twice. */}
          <Footnote style={{ marginTop: 0 }}>
            A service&rsquo;s total includes its parts — they don&rsquo;t appear twice in Costs.
          </Footnote>
        </>
      )}
    </Screen>
  );
}

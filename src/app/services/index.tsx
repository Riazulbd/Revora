import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Button,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Footnote,
  ListCard,
  RecordRow,
  SCREEN_GUTTER,
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
  serviceSpendMinor,
  type ServiceCategory,
  type ServiceFilter,
} from '@/calculations/serviceCategories';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatCurrencySymbol, formatDistance } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import { useTheme } from '@/theme';

/**
 * Service history.
 *
 * The board's own shape: the total for whatever is on screen, the category
 * chips, then the visits. Nothing here is stored — the chips, the glyph on each
 * row and the total under them are all derived from the records on read, so a
 * renamed or corrected service takes every figure with it (requirement 3).
 */

/** What each category looks like on a row. Presentation only — the category itself is derived. */
const ROW_LOOK: Record<ServiceCategory, { icon: IconName; tone: RowTone }> = {
  oil: { icon: 'drop', tone: 'good' },
  brakes: { icon: 'shield', tone: 'bad' },
  chain: { icon: 'sparkle', tone: 'warn' },
  tyres: { icon: 'circle', tone: 'neutral' },
  other: { icon: 'wrench', tone: 'accent' },
};

export default function ServiceHistory() {
  const router = useRouter();
  const { radius } = useTheme();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const [filter, setFilter] = useState<ServiceFilter>('all');

  const services = analytics?.services.all ?? [];
  const currency = analytics?.currency ?? 'BDT';

  const addService = () => router.push('/services/add');

  if (error) {
    return (
      <Screen testID="screen-services" contentStyle={{ paddingHorizontal: SCREEN_GUTTER.tab }}>
        <TabHeader title="Services" />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-services" contentStyle={{ paddingHorizontal: SCREEN_GUTTER.tab }}>
        <TabHeader title="Services" />
        <SkeletonList count={4} height={68} />
      </Screen>
    );
  }

  const filters = serviceFilters(services);
  // A chip the rider is standing on can disappear when the last service under
  // it is deleted; falling back to All beats showing an empty list forever.
  const active = filters.includes(filter) ? filter : 'all';
  const shown = filterServices(services, active);

  const options: SegmentedOption<ServiceFilter>[] = filters.map((value) => ({
    value,
    label: value === 'all' ? 'All' : SERVICE_CATEGORY_LABEL[value],
  }));

  const totalLabel =
    active === 'all'
      ? `All services · ${shown.length} visit${shown.length === 1 ? '' : 's'}`
      : `${SERVICE_CATEGORY_LABEL[active]} · ${shown.length} visit${shown.length === 1 ? '' : 's'}`;

  return (
    <Screen
      onRefresh={refetch}
      testID="screen-services"
      contentStyle={{ paddingHorizontal: SCREEN_GUTTER.tab }}
    >
      <TabHeader
        title="Services"
        style={{ marginBottom: 14 }}
        action={
          <Button
            label="Log a service"
            icon="plus"
            size="compact"
            onPress={addService}
            testID="cta-add-service"
          />
        }
      />

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
          <Card
            variant="list"
            style={{
              borderRadius: radius.tile,
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
            testID="services-total"
          >
            <Txt role="tileLabel" tone="mut" uppercase numberOfLines={1} style={{ flexShrink: 1 }}>
              {totalLabel}
            </Txt>
            <Txt role="tileValue" numberOfLines={1}>
              {formatCurrencySymbol(serviceSpendMinor(shown), currency)}
            </Txt>
          </Card>

          {options.length > 1 ? (
            <ChipGroup
              options={options}
              value={active}
              onChange={setFilter}
              size="compact"
              style={{ marginTop: 12 }}
              testID="filter-services"
            />
          ) : null}

          {shown.length === 0 ? (
            /* A filter with nothing under it says so, rather than leaving a
               blank where the rider expects their history. */
            <View style={{ marginTop: 14 }}>
              <EmptyState
                icon="wrench"
                title={`No ${active === 'all' ? '' : `${SERVICE_CATEGORY_LABEL[active].toLowerCase()} `}services yet`}
                message="Nothing in your history matches this filter. Tap All to see every visit."
                primaryAction={{ label: 'Show all services', onPress: () => setFilter('all') }}
                testID="empty-services-filtered"
              />
            </View>
          ) : (
            <ListCard style={{ marginTop: 14 }} testID="service-list">
              {shown.map((service) => {
                const look = ROW_LOOK[primaryServiceCategory(service)];
                return (
                  <RecordRow
                    key={service.id}
                    variant="flush"
                    icon={look.icon}
                    iconTone={look.tone}
                    iconSize={40}
                    title={service.title}
                    subtitle={`${formatShortDate(service.date)} · ${
                      service.selfService ? 'Self-service' : (service.workshop ?? 'Workshop')
                    } · ${formatDistance(service.odometerMetres, units.distance)}`}
                    amount={formatCurrencySymbol(service.totalCostMinor, service.currency)}
                    onPress={() =>
                      router.push({ pathname: '/services/add', params: { id: service.id } })
                    }
                    testID={`service-${service.id}`}
                  />
                );
              })}
            </ListCard>
          )}

          {/* Riders see a part in the parts list and the same money inside a
              service total, and reasonably suspect it was counted twice. */}
          <Footnote>
            A service&rsquo;s total includes its parts — they don&rsquo;t appear twice in Costs.
          </Footnote>
        </>
      )}
    </Screen>
  );
}

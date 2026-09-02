import { useCallback, useMemo } from 'react';

import { analyseBike, type BikeAnalytics } from '@/calculations/analytics';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import {
  accessoryRepository,
  expenseRepository,
  fuelAdjustmentRepository,
  fuelRepository,
  maintenanceRuleRepository,
  odometerRepository,
  partRepository,
  serviceRepository,
  type RecordRepository,
} from '@/repositories';
import type { AppError } from '@/services/errors';
import { log } from '@/services/logger';
import { useLiveQuery } from '@/services/liveQuery';
import { useToday } from '@/features/shared/useToday';
import type { CurrencyCode, OwnedRecord } from '@/types';

/**
 * Every record the active motorcycle needs, and the single analysis built from
 * them.
 *
 * Dashboard, Fuel, Garage, Expenses and Analytics all call this. Because the
 * underlying Firestore listeners are reference-counted and shared, five screens
 * share one set of listeners — and all five see a new fuel log the instant it is
 * written, with no invalidation to remember (requirement 52).
 *
 * Every query key includes the bike id, so switching bikes swaps the whole data
 * set atomically; nothing from the previous motorcycle survives (requirement 11).
 */

/** Row caps, tuned so the Dashboard never pulls an unbounded history. */
const LIMITS = {
  fuel: 400,
  adjustments: 200,
  odometer: 400,
  rules: 100,
  services: 200,
  parts: 200,
  accessories: 100,
  expenses: 400,
} as const;

function useBikeCollection<T extends OwnedRecord>(
  repo: RecordRepository<T>,
  uid: string | null,
  bikeId: string | null,
  currency: CurrencyCode,
  limit: number,
) {
  return useLiveQuery<T[]>({
    queryKey: [repo.name, uid, bikeId, currency, limit],
    enabled: uid !== null && bikeId !== null,
    subscribe: (onData, onError) =>
      uid === null || bikeId === null
        ? () => undefined
        : repo.subscribe(uid, bikeId, currency, { limit })(onData, onError),
  });
}

export type GarageDataResult = {
  analytics: BikeAnalytics | null;
  isPending: boolean;
  error: AppError | null;
  /** Pull-to-refresh: forces a server read past the local cache. */
  refetch: () => Promise<void>;
};

/**
 * Every collection this hook reads, paired with its row cap.
 *
 * Only the `name` and `refresh` members are needed here, which sidesteps the
 * variance problem of putting differently-typed repositories in one array.
 */
type RefreshableSource = {
  name: string;
  refresh: (uid: string, bikeId: string, options?: { limit?: number }) => Promise<void>;
  limit: number;
};

const SOURCES: readonly RefreshableSource[] = [
  { name: fuelRepository.name, refresh: fuelRepository.refresh, limit: LIMITS.fuel },
  { name: fuelAdjustmentRepository.name, refresh: fuelAdjustmentRepository.refresh, limit: LIMITS.adjustments },
  { name: odometerRepository.name, refresh: odometerRepository.refresh, limit: LIMITS.odometer },
  { name: maintenanceRuleRepository.name, refresh: maintenanceRuleRepository.refresh, limit: LIMITS.rules },
  { name: serviceRepository.name, refresh: serviceRepository.refresh, limit: LIMITS.services },
  { name: partRepository.name, refresh: partRepository.refresh, limit: LIMITS.parts },
  { name: accessoryRepository.name, refresh: accessoryRepository.refresh, limit: LIMITS.accessories },
  { name: expenseRepository.name, refresh: expenseRepository.refresh, limit: LIMITS.expenses },
];

export function useGarageData(): GarageDataResult {
  const { user } = useAuth();
  const { activeBike, units } = useGarage();
  const uid = user?.uid ?? null;
  const bikeId = activeBike?.id ?? null;
  const currency = activeBike?.currency ?? units.currency;
  const today = useToday();

  const fuel = useBikeCollection(fuelRepository, uid, bikeId, currency, LIMITS.fuel);
  const adjustments = useBikeCollection(fuelAdjustmentRepository, uid, bikeId, currency, LIMITS.adjustments);
  const odometer = useBikeCollection(odometerRepository, uid, bikeId, currency, LIMITS.odometer);
  const rules = useBikeCollection(maintenanceRuleRepository, uid, bikeId, currency, LIMITS.rules);
  const services = useBikeCollection(serviceRepository, uid, bikeId, currency, LIMITS.services);
  const parts = useBikeCollection(partRepository, uid, bikeId, currency, LIMITS.parts);
  const accessories = useBikeCollection(accessoryRepository, uid, bikeId, currency, LIMITS.accessories);
  const expenses = useBikeCollection(expenseRepository, uid, bikeId, currency, LIMITS.expenses);

  const queries = [fuel, adjustments, odometer, rules, services, parts, accessories, expenses];

  const analytics = useMemo<BikeAnalytics | null>(() => {
    if (activeBike === null) return null;
    return analyseBike({
      bike: activeBike,
      fuelEntries: fuel.data ?? [],
      fuelAdjustments: adjustments.data ?? [],
      odometerReadings: odometer.data ?? [],
      rules: rules.data ?? [],
      services: services.data ?? [],
      parts: parts.data ?? [],
      accessories: accessories.data ?? [],
      expenses: expenses.data ?? [],
      units,
      today,
    });
  }, [
    activeBike,
    fuel.data,
    adjustments.data,
    odometer.data,
    rules.data,
    services.data,
    parts.data,
    accessories.data,
    expenses.data,
    units,
    today,
  ]);

  const error = queries.find((q) => q.error)?.error ?? null;

  const refetch = useCallback(async () => {
    if (uid === null || bikeId === null) return;
    // The listeners keep every screen current already, so a refresh is only
    // meaningful if it reaches past the cache. Offline this rejects rather than
    // hanging, and the caller's spinner stops either way (mistake 10).
    await Promise.all(
      SOURCES.map((source) =>
        source.refresh(uid, bikeId, { limit: source.limit }).catch((refreshError) => {
          log.debug('garage', 'refresh skipped', { collection: source.name, error: String(refreshError) });
        }),
      ),
    );
  }, [uid, bikeId]);

  return {
    analytics,
    isPending: bikeId !== null && queries.some((q) => q.isPending),
    error,
    refetch,
  };
}

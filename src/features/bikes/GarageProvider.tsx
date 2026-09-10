import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { bikeRepository, profileRepository } from '@/repositories';
import { useLiveQuery } from '@/services/liveQuery';
import { log } from '@/services/logger';
import type { AppError } from '@/services/errors';
import type { Bike, UnitPreferences, UserProfile } from '@/types';
import { entitlementIsActive } from '@/features/premium/entitlement';

/**
 * Profile + garage + which motorcycle is selected.
 *
 * The active bike id lives on the profile document, so switching bikes on the
 * phone follows the rider to the web and back. Every screen reads `activeBike`
 * from here — there is no second copy anywhere, which is what makes a bike switch
 * update the whole app at once instead of leaving one screen stale
 * (requirement 11 / 63).
 */

type GarageContextValue = {
  profile: UserProfile | null;
  bikes: Bike[];
  activeBike: Bike | null;
  activeBikeId: string | null;
  units: UnitPreferences;
  isPro: boolean;
  isPending: boolean;
  error: AppError | null;
  setActiveBike: (bikeId: string) => Promise<void>;
  refetch: () => Promise<void>;
};

const DEFAULT_UNITS: UnitPreferences = {
  currency: 'BDT',
  distance: 'km',
  volume: 'L',
  mileage: 'km_per_l',
};

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const profileQuery = useLiveQuery<UserProfile | null>({
    queryKey: ['profile', uid],
    enabled: uid !== null,
    subscribe: (onData, onError) =>
      uid === null ? () => undefined : profileRepository.subscribe(uid)(onData, onError),
  });

  const bikesQuery = useLiveQuery<Bike[]>({
    queryKey: ['bikes', uid],
    enabled: uid !== null,
    subscribe: (onData, onError) =>
      uid === null ? () => undefined : bikeRepository.subscribe(uid)(onData, onError),
  });

  const entitlementQuery = useLiveQuery<UserProfile['entitlement'] | null>({
    queryKey: ['entitlement', uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => uid === null ? () => undefined
      : profileRepository.subscribeEntitlement(uid)(onData, onError),
  });
  const profile = useMemo(() => profileQuery.data ? {
    ...profileQuery.data,
    entitlement: entitlementQuery.data ?? { tier: 'free' as const, source: 'none' as const, expiresAt: null, updatedAt: 0 },
  } : null, [profileQuery.data, entitlementQuery.data]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    // Expiration also takes effect offline or while a screen stays mounted.
    const expiresAt = profile?.entitlement.expiresAt;
    const delay = expiresAt ? expiresAt - Date.now() + 1 : 0;
    const timer = delay > 0 && delay < 2147483647 ? setTimeout(refresh, delay) : undefined;
    const interval = setInterval(refresh, 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); clearInterval(interval); subscription.remove(); };
  }, [profile?.entitlement.expiresAt]);
  const allBikes = useMemo(() => bikesQuery.data ?? [], [bikesQuery.data]);
  const bikes = useMemo(() => allBikes.filter((b) => b.archivedAt === null), [allBikes]);

  // If the stored active bike was deleted (or never chosen), fall back to the
  // first bike in the garage rather than leaving every screen empty.
  const activeBike = useMemo(() => {
    if (bikes.length === 0) return null;
    const stored = profile?.activeBikeId ?? null;
    return bikes.find((b) => b.id === stored) ?? bikes[0] ?? null;
  }, [bikes, profile?.activeBikeId]);

  useEffect(() => {
    if (uid === null || activeBike === null) return;
    if (profile?.activeBikeId === activeBike.id) return;
    void profileRepository
      .setActiveBike(uid, activeBike.id)
      .catch((error) => log.warn('garage', 'could not persist active bike', { error: String(error) }));
  }, [uid, activeBike, profile?.activeBikeId]);

  const setActiveBike = useCallback(
    async (bikeId: string) => {
      if (uid === null) return;
      await profileRepository.setActiveBike(uid, bikeId);
    },
    [uid],
  );

  const refetch = useCallback(async () => {
    await Promise.all([profileQuery.refetch(), bikesQuery.refetch(), entitlementQuery.refetch()]);
  }, [profileQuery, bikesQuery, entitlementQuery]);

  const value = useMemo<GarageContextValue>(
    () => ({
      profile,
      bikes,
      activeBike,
      activeBikeId: activeBike?.id ?? null,
      units: profile?.units ?? DEFAULT_UNITS,
      isPro: entitlementIsActive(profile?.entitlement, now),
      isPending: uid !== null && (profileQuery.isPending || bikesQuery.isPending || entitlementQuery.isPending),
      error: profileQuery.error ?? bikesQuery.error ?? entitlementQuery.error ?? null,
      setActiveBike,
      refetch,
    }),
    [
      profile,
      now,
      entitlementQuery.isPending,
      entitlementQuery.error,
      bikes,
      activeBike,
      uid,
      profileQuery.isPending,
      bikesQuery.isPending,
      profileQuery.error,
      bikesQuery.error,
      setActiveBike,
      refetch,
    ],
  );

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

export function useGarage(): GarageContextValue {
  const ctx = useContext(GarageContext);
  if (!ctx) throw new Error('useGarage must be used inside <GarageProvider>');
  return ctx;
}

/** The active motorcycle, or null while the garage is still loading / empty. */
export function useActiveBike(): Bike | null {
  return useGarage().activeBike;
}

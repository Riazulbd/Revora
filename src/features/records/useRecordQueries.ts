import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import {
  captureRepository,
  documentRepository,
  safetyRepository,
  warrantyRepository,
} from '@/repositories';
import { documentStatus } from '@/calculations/documents';
import { useLiveQuery } from '@/services/liveQuery';
import type { CaptureItem, SafetyCheck, VaultDocument, Warranty } from '@/types';
import { todayIso } from '@/utils/date';

/**
 * Live reads for the record collections that the dashboard does not need.
 *
 * Keeping these out of `useGarageData` is deliberate: the Dashboard should not
 * open listeners for the document vault (requirement 60 / mistake 22).
 */


export function useDocuments() {
  const { user } = useAuth();
  const { activeBike } = useGarage();
  const uid = user?.uid ?? null;
  const bikeId = activeBike?.id ?? null;

  return useLiveQuery<VaultDocument[]>({
    queryKey: ['documents', uid, bikeId, 200],
    enabled: uid !== null && bikeId !== null,
    subscribe: (onData, onError) =>
      uid === null || bikeId === null
        ? () => undefined
        : documentRepository.subscribe(uid, bikeId, 'BDT', { limit: 200 })(onData, onError),
  });
}

export function useWarranties() {
  const { user } = useAuth();
  const { activeBike } = useGarage();
  const uid = user?.uid ?? null;
  const bikeId = activeBike?.id ?? null;

  return useLiveQuery<Warranty[]>({
    queryKey: ['warranties', uid, bikeId, 200],
    enabled: uid !== null && bikeId !== null,
    subscribe: (onData, onError) =>
      uid === null || bikeId === null
        ? () => undefined
        : warrantyRepository.subscribe(uid, bikeId, 'BDT', { limit: 200 })(onData, onError),
  });
}

export function useSafetyChecks() {
  const { user } = useAuth();
  const { activeBike } = useGarage();
  const uid = user?.uid ?? null;
  const bikeId = activeBike?.id ?? null;

  return useLiveQuery<SafetyCheck[]>({
    queryKey: ['safety', uid, bikeId, 200],
    enabled: uid !== null && bikeId !== null,
    subscribe: (onData, onError) =>
      uid === null || bikeId === null
        ? () => undefined
        : safetyRepository.subscribe(uid, bikeId, 'BDT', { limit: 200 })(onData, onError),
  });
}

export function useCaptureQueue() {
  const { user } = useAuth();
  const { activeBike } = useGarage();
  const uid = user?.uid ?? null;
  const bikeId = activeBike?.id ?? null;

  return useLiveQuery<CaptureItem[]>({
    queryKey: ['captures', uid, bikeId, 100],
    enabled: uid !== null && bikeId !== null,
    subscribe: (onData, onError) =>
      uid === null || bikeId === null
        ? () => undefined
        : captureRepository.subscribe(uid, bikeId, 'BDT', { limit: 100 })(onData, onError),
  });
}

/** Counts used by the More menu badges. */
export function useExpiringDocuments() {
  const documents = useDocuments();
  const today = todayIso();

  return useMemo(() => {
    let expiredCount = 0;
    let expiringCount = 0;
    for (const document of documents.data ?? []) {
      const status = documentStatus(document, today);
      if (status === 'expired') expiredCount += 1;
      if (status === 'expiring') expiringCount += 1;
    }
    return { expiredCount, expiringCount };
  }, [documents.data, today]);
}

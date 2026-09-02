import { useRouter } from 'expo-router';

import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { partRepository } from '@/repositories';
import type { IsoDate, Part } from '@/types';
import { todayIso } from '@/utils/date';

export type PartDraft = {
  id: string;
  name: string;
  installedOdometerMetres: number;
  installedDate: IsoDate;
  expectedLifeMetres: number | null;
  costMinor: number;
  fittedBy: string | null;
  /** When set, the cost belongs to that service and is not counted again. */
  linkedServiceId: string | null;
  notes: string | null;
  existing?: Part;
};

export function useSavePart(options: { onSaved?: (part: Part) => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<PartDraft, Part>({
    mutationFn: async (draft) => {
      const { uid, bikeId, currency } = requireGarage(ctx);
      const now = Date.now();

      const part: Part = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        name: draft.name,
        installedOdometerMetres: draft.installedOdometerMetres,
        installedDate: draft.installedDate,
        expectedLifeMetres: draft.expectedLifeMetres,
        costMinor: draft.costMinor,
        currency: draft.existing?.currency ?? currency,
        fittedBy: draft.fittedBy,
        linkedServiceId: draft.linkedServiceId,
        removedDate: draft.existing?.removedDate ?? null,
        removedOdometerMetres: draft.existing?.removedOdometerMetres ?? null,
        notes: draft.notes,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };

      await partRepository.save(uid, part, draft.existing === undefined);
      return part;
    },
    successMessage: (_part, draft) => (draft.existing ? 'Part updated' : 'Part added'),
    onSuccess: (part) => {
      options.onSaved?.(part);
      if (router.canGoBack()) router.back();
      else router.replace('/parts');
    },
  });
}

/**
 * Takes a part off the bike.
 *
 * The record is kept — it moves to the removed history with the odometer it came
 * off at, which is what makes "actual life" a measured number rather than an
 * estimate.
 */
export function useRemovePart(options: { onRemoved?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<{ id: string; odometerMetres: number; date?: IsoDate }>({
    mutationFn: async ({ id, odometerMetres, date }) => {
      const { uid } = requireGarage(ctx);
      await partRepository.patch(uid, id, {
        removedOdometerMetres: odometerMetres,
        removedDate: date ?? todayIso(),
      });
    },
    successMessage: 'Part moved to removed history',
    onSuccess: () => options.onRemoved?.(),
  });
}

export function useDeletePart(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await partRepository.remove(uid, id);
    },
    successMessage: 'Part deleted',
    onSuccess: () => options.onDeleted?.(),
  });
}

export function useNewPartId(): () => string {
  const ctx = useGarageContext();
  return () => (ctx ? partRepository.newId() : 'pending');
}

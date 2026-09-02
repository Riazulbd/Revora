import { useRouter } from 'expo-router';

import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { accessoryRepository } from '@/repositories';
import type { Accessory, IsoDate } from '@/types';

export type AccessoryDraft = {
  id: string;
  name: string;
  purchaseCostMinor: number;
  installationCostMinor: number;
  date: IsoDate;
  notes: string | null;
  photoPath: string | null;
  linkedServiceId: string | null;
  existing?: Accessory;
};

export function useSaveAccessory(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<AccessoryDraft, Accessory>({
    mutationFn: async (draft) => {
      const { uid, bikeId, currency } = requireGarage(ctx);
      const now = Date.now();

      const accessory: Accessory = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        name: draft.name,
        purchaseCostMinor: draft.purchaseCostMinor,
        installationCostMinor: draft.installationCostMinor,
        currency: draft.existing?.currency ?? currency,
        date: draft.date,
        notes: draft.notes,
        photoPath: draft.photoPath,
        linkedServiceId: draft.linkedServiceId,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };

      await accessoryRepository.save(uid, accessory, draft.existing === undefined);
      return accessory;
    },
    successMessage: (_a, draft) => (draft.existing ? 'Accessory updated' : 'Accessory added'),
    onSuccess: () => {
      options.onSaved?.();
      if (router.canGoBack()) router.back();
      else router.replace('/accessories');
    },
  });
}

export function useDeleteAccessory(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await accessoryRepository.remove(uid, id);
    },
    successMessage: 'Accessory removed',
    onSuccess: () => options.onDeleted?.(),
  });
}

export function useNewAccessoryId(): () => string {
  const ctx = useGarageContext();
  return () => (ctx ? accessoryRepository.newId() : 'pending');
}

import { useRouter } from 'expo-router';

import { accessoryAsPart, partAsAccessory } from '@/calculations/recategorise';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { accessoryRepository, partRepository } from '@/repositories';
import type { Accessory, Part } from '@/types';

/**
 * Moves a record between `parts` and `accessories`.
 *
 * The new record is written **before** the old one is deleted. There is no
 * transaction across two collections here, so one of the two orderings has to
 * be chosen deliberately: writing first means a failure halfway leaves the cost
 * counted twice, which the rider can see and fix; deleting first means it
 * vanishes silently, which they cannot. A visible duplicate beats a silent
 * loss of something they paid for.
 *
 * `clientRef` is carried across, so a retry writes the same pair rather than a
 * third copy.
 */
export type RecategoriseDraft =
  | { direction: 'partToAccessory'; part: Part }
  | { direction: 'accessoryToPart'; accessory: Accessory; odometerMetres: number };

export function useRecategorise(options: { onDone?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<RecategoriseDraft>({
    mutationFn: async (draft) => {
      const { uid } = requireGarage(ctx);
      const now = Date.now();

      if (draft.direction === 'partToAccessory') {
        const accessory = partAsAccessory(draft.part, accessoryRepository.newId(), now);
        await accessoryRepository.save(uid, accessory, true);
        await partRepository.remove(uid, draft.part.id);
        return;
      }

      const part = accessoryAsPart(
        draft.accessory,
        partRepository.newId(),
        draft.odometerMetres,
        now,
      );
      await partRepository.save(uid, part, true);
      await accessoryRepository.remove(uid, draft.accessory.id);
    },
    successMessage: (_result, draft) =>
      draft.direction === 'partToAccessory' ? 'Moved to accessories' : 'Moved to parts',
    onSuccess: () => {
      options.onDone?.();
      if (router.canGoBack()) router.back();
    },
  });
}

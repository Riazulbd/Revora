import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { bikeRepository, odometerRepository } from '@/repositories';
import type { IsoDate, OdometerReading, OdometerSource } from '@/types';
import { todayIso } from '@/utils/date';

export type OdometerDraft = {
  metres: number;
  date?: IsoDate;
  source?: OdometerSource;
  note?: string | null;
};

/**
 * Adds a reading to the odometer history.
 *
 * It appends — it never overwrites a "current odometer" field, because there is
 * no such field. 5,180 followed by 5,350 leaves two rows, and every distance
 * stays auditable (requirement 12).
 */
export function useAddOdometerReading(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<OdometerDraft, OdometerReading>({
    mutationFn: async (draft) => {
      const { uid, bikeId } = requireGarage(ctx);
      const now = Date.now();
      const reading: OdometerReading = {
        id: odometerRepository.newId(),
        userId: uid,
        bikeId,
        createdAt: now,
        updatedAt: now,
        metres: draft.metres,
        date: draft.date ?? todayIso(),
        source: draft.source ?? 'manual',
        sourceId: null,
        note: draft.note ?? null,
      };
      await odometerRepository.save(uid, reading, true);
      await bikeRepository.syncCurrentOdometer(bikeId, draft.metres);
      return reading;
    },
    successMessage: 'Odometer updated',
    onSuccess: () => options.onSaved?.(),
  });
}

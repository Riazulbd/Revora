import { previewOdometerCorrection } from '@/calculations/odometer';
import { useGarageData } from '@/features/bikes/useGarageData';
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

export type OdometerCorrectionDraft = {
  readingId: string;
  /** The corrected reading, or null to remove the reading altogether. */
  metres: number | null;
};

/**
 * Corrects or removes a reading the rider got wrong.
 *
 * A mistyped 6,000 has to be fixable back to 5,588, and every derived figure —
 * mileage, running cost, maintenance due, analytics — has to follow. Nothing
 * derived is stored, so rewriting the row is enough for all of them.
 *
 * The bike's shared `currentOdometer` is the single exception: it is a real
 * stored copy that the web product reads, and it was moved up when the mistake
 * was saved. It is recomputed here from the surviving records — and only here is
 * it allowed to move down.
 */
export function useCorrectOdometerReading(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const { analytics } = useGarageData();
  const points = analytics?.odometer.points ?? [];

  return useRecordMutation<OdometerCorrectionDraft>({
    mutationFn: async ({ readingId, metres }) => {
      const { uid, bikeId } = requireGarage(ctx);
      // Computed before the write, from the history as the rider last saw it.
      const { resultingMetres } = previewOdometerCorrection(points, readingId, metres);
      if (metres === null) await odometerRepository.remove(uid, readingId);
      else await odometerRepository.correct(uid, readingId, metres);
      await bikeRepository.resyncCurrentOdometer(bikeId, resultingMetres ?? 0);
    },
    successMessage: (_result, input) =>
      input.metres === null
        ? 'Reading deleted · figures recalculated'
        : 'Odometer corrected · figures recalculated',
    onSuccess: () => options.onSaved?.(),
  });
}

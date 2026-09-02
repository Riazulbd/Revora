import { useRouter } from 'expo-router';

import { normaliseFuelAmounts } from '@/calculations/fuel';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { bikeRepository, fuelAdjustmentRepository, fuelRepository } from '@/repositories';
import { AppError } from '@/services/errors';
import type { FillType, FuelAdjustment, FuelAdjustmentReason, FuelEntry, IsoDate } from '@/types';

/** An adjustment as the form collects it, before it becomes a stored record. */
export type AdjustmentDraft = {
  /** Present when editing an adjustment that already exists. */
  id?: string;
  reason: FuelAdjustmentReason;
  /** Signed millilitres. Negative left the tank. */
  millilitres: number;
  approximate: boolean;
  note: string | null;
};

export type FuelDraft = {
  id: string;
  date: IsoDate;
  odometerMetres: number;
  litresMl: number;
  pricePerLitreMinor: number | null;
  totalCostMinor: number | null;
  fillType: FillType;
  missedPreviousFill: boolean;
  /** Adjustments the rider logged alongside this fill. */
  adjustments: AdjustmentDraft[];
  /** Adjustments that were attached before and have now been removed. */
  removedAdjustmentIds: string[];
  station: string | null;
  notes: string | null;
  receiptPath: string | null;
  /** Present when editing; absent when creating. */
  existing?: FuelEntry;
};

/**
 * Saving a fuel log.
 *
 * Nothing derived is written: no mileage, no effective-fuel figure. Adjustments
 * are separate dated records on the motorcycle's timeline, which is how the
 * shared database models them and why a leak between two fills can be recorded
 * without touching either.
 *
 * The bike's stored odometer is nudged forward afterwards so the web product
 * sees the same reading this app derives (requirement 63).
 */
export function useSaveFuel(options: { onSaved?: (entry: FuelEntry) => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<FuelDraft, FuelEntry>({
    mutationFn: async (draft) => {
      const { uid, bikeId, currency } = requireGarage(ctx);

      const amounts = normaliseFuelAmounts({
        litresMl: draft.litresMl,
        pricePerLitreMinor: draft.pricePerLitreMinor,
        totalCostMinor: draft.totalCostMinor,
      });
      if (!amounts) {
        throw new AppError('validation', 'Enter how much fuel you added and what it cost.');
      }

      const now = Date.now();
      const isNew = draft.existing === undefined;

      const entry: FuelEntry = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        date: draft.date,
        odometerMetres: draft.odometerMetres,
        litresMl: amounts.litresMl,
        pricePerLitreMinor: amounts.pricePerLitreMinor,
        totalCostMinor: amounts.totalCostMinor,
        currency: draft.existing?.currency ?? currency,
        fillType: draft.fillType,
        missedPreviousFill: draft.missedPreviousFill,
        station: draft.station,
        notes: draft.notes,
        receiptPath: draft.receiptPath,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };

      await fuelRepository.save(uid, entry, isNew);

      for (const adjustment of draft.adjustments) {
        const existingId = adjustment.id;
        const record: FuelAdjustment = {
          id: existingId ?? fuelAdjustmentRepository.newId(),
          userId: uid,
          bikeId,
          createdAt: now,
          updatedAt: now,
          // Dated with the fill, so it lands in the interval the fill closes.
          date: draft.date,
          millilitres: adjustment.millilitres,
          reason: adjustment.reason,
          approximate: adjustment.approximate,
          note: adjustment.note,
          clientRef: existingId ?? `${draft.id}:${adjustment.reason}`,
        };
        await fuelAdjustmentRepository.save(uid, record, existingId === undefined);
      }

      for (const removedId of draft.removedAdjustmentIds) {
        await fuelAdjustmentRepository.remove(uid, removedId);
      }

      await bikeRepository.syncCurrentOdometer(bikeId, draft.odometerMetres);

      return entry;
    },
    successMessage: (_entry, draft) =>
      draft.existing ? 'Fuel log updated · mileage recalculated' : 'Fuel log saved · mileage updated',
    onSuccess: (entry) => {
      options.onSaved?.(entry);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/fuel');
    },
  });
}

export function useDeleteFuel(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<{ id: string; adjustmentIds: string[] }>({
    mutationFn: async ({ id, adjustmentIds }) => {
      const { uid } = requireGarage(ctx);
      await fuelRepository.remove(uid, id);
      // Adjustments logged with this fill go with it; ones dated elsewhere stay.
      for (const adjustmentId of adjustmentIds) {
        await fuelAdjustmentRepository.remove(uid, adjustmentId);
      }
    },
    successMessage: 'Fuel log deleted · mileage recalculated',
    onSuccess: () => options.onDeleted?.(),
  });
}

export function useNewFuelId(): () => string {
  return () => fuelRepository.newId();
}

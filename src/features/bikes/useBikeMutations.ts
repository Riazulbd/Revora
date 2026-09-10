import { useRouter } from 'expo-router';

import { DEFAULT_RULES } from '@/calculations/maintenance';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import {
  bikeRepository,
  maintenanceRuleRepository,
  odometerRepository,
  profileRepository,
  FREE_PLAN_BIKE_LIMIT,
} from '@/repositories';
import { AppError } from '@/services/errors';
import type { Bike, CompanyAllowance, CurrencyCode, IsoDate, MaintenanceRule, OdometerReading } from '@/types';
import { todayIso } from '@/utils/date';

export type BikeDraft = {
  manufacturer: string;
  model: string;
  nickname: string;
  year: number | null;
  tankCapacityMl: number | null;
  purchasePriceMinor: number | null;
  purchaseDate: IsoDate | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  /** The reading the garage starts from. */
  odometerMetres: number;
  currency: CurrencyCode;
};

/**
 * Adds a motorcycle.
 *
 * Three writes make a usable garage: the bike, its opening odometer reading, and
 * a starter set of maintenance rules so the Maintenance screen is useful on day
 * one rather than empty.
 *
 * The UI checks the Free-plan limit for immediate feedback. The createBike
 * callable also enforces it transactionally using the server entitlement.
 */
export function useAddBike(options: { onAdded?: (bike: Bike) => void } = {}) {
  const { user } = useAuth();
  const { bikes, isPro } = useGarage();

  return useRecordMutation<BikeDraft, Bike>({
    mutationFn: async (draft) => {
      if (!user) throw new AppError('auth', 'Sign in again to add a motorcycle.');
      if (!isPro && bikes.length >= FREE_PLAN_BIKE_LIMIT) {
        throw new AppError('validation', 'The Free plan tracks one motorcycle. Upgrade to Pro to add more.');
      }

      const uid = user.uid;
      const now = Date.now();
      const bikeId = bikeRepository.newId();
      const odometerMetres = draft.odometerMetres;

      const company: CompanyAllowance = { enabled: false, companyName: '', monthlyAllowanceMinor: 0 };

      const bike: Bike = {
        id: bikeId,
        userId: uid,
        createdAt: now,
        updatedAt: now,
        manufacturer: draft.manufacturer,
        model: draft.model,
        nickname: draft.nickname,
        year: draft.year,
        tankCapacityMl: draft.tankCapacityMl,
        purchasePriceMinor: draft.purchasePriceMinor,
        purchaseDate: draft.purchaseDate,
        engineNumber: draft.engineNumber,
        chassisNumber: draft.chassisNumber,
        photoPath: null,
        currency: draft.currency,
        initialOdometerMetres: odometerMetres,
        storedOdometerMetres: odometerMetres,
        company,
        archivedAt: null,
      };

      await bikeRepository.save(uid, bike, true);

      const reading: OdometerReading = {
        id: odometerRepository.newId(),
        userId: uid,
        bikeId,
        createdAt: now,
        updatedAt: now,
        metres: odometerMetres,
        date: todayIso(),
        source: 'manual',
        sourceId: null,
        note: 'Starting reading',
      };
      await odometerRepository.save(uid, reading, true);

      for (const template of DEFAULT_RULES) {
        const rule: MaintenanceRule = {
          id: maintenanceRuleRepository.newId(),
          userId: uid,
          bikeId,
          createdAt: now,
          updatedAt: now,
          name: template.name,
          intervalMetres: template.intervalMetres,
          intervalDays: template.intervalDays,
          warnAheadMetres: template.warnAheadMetres,
          warnAheadDays: template.warnAheadDays,
          enabled: true,
          // Seeded rules start from the opening odometer, so the first due point
          // is a real projection rather than an immediate "overdue".
          lastCompletedMetres: odometerMetres,
          lastCompletedDate: todayIso(),
          notes: null,
        };
        await maintenanceRuleRepository.save(uid, rule, true);
      }

      await profileRepository.update(uid, {
        activeBikeId: bikeId,
        onboardingCompletedAt: now,
      });

      return bike;
    },
    successMessage: (bike) => `${bike.nickname} added to your garage`,
    onSuccess: (bike) => options.onAdded?.(bike),
  });
}

/**
 * `stayOnScreen` is for callers that are not an editor — changing the photo from
 * the Garage tab must not navigate away from the tab the rider is standing on.
 */
export function useUpdateBike(options: { onSaved?: () => void; stayOnScreen?: boolean } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<Partial<Bike>>({
    mutationFn: async (changes) => {
      const { uid, bikeId } = requireGarage(ctx);
      await bikeRepository.patch(uid, bikeId, changes);
    },
    successMessage: 'Motorcycle updated',
    onSuccess: () => {
      options.onSaved?.();
      if (!options.stayOnScreen && router.canGoBack()) router.back();
    },
  });
}

export function useUpdateCompanyAllowance(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<CompanyAllowance>({
    mutationFn: async (company) => {
      const { uid, bikeId } = requireGarage(ctx);
      await bikeRepository.patch(uid, bikeId, { company });
    },
    successMessage: 'Company settings saved',
    onSuccess: () => options.onSaved?.(),
  });
}

/**
 * Removes a motorcycle and everything logged against it.
 *
 * This is a genuine cascade — leaving the records behind would keep them in
 * storage, invisible and unowned.
 */
export function useDeleteBike(options: { onDeleted?: () => void } = {}) {
  const { user } = useAuth();
  const { bikes } = useGarage();

  return useRecordMutation<string>({
    mutationFn: async (bikeId) => {
      if (!user) throw new AppError('auth', 'Sign in again to remove a motorcycle.');
      await bikeRepository.remove(user.uid, bikeId);
      const remaining = bikes.filter((b) => b.id !== bikeId);
      await profileRepository.setActiveBike(user.uid, remaining[0]?.id ?? null);
    },
    successMessage: 'Motorcycle removed',
    onSuccess: () => options.onDeleted?.(),
  });
}

import { useRouter } from 'expo-router';

import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import {
  bikeRepository,
  maintenanceRuleRepository,
  serviceItemRepository,
  serviceRepository,
} from '@/repositories';
import type {
  IsoDate,
  MaintenanceRule,
  ServiceItem,
  ServiceItemUnit,
  ServiceRecord,
  WorkshopEstimate,
} from '@/types';

export type ServiceItemDraft = {
  ruleId: string | null;
  category: string;
  brand: string | null;
  product: string | null;
  spec: string | null;
  quantity: number;
  unit: ServiceItemUnit;
  costMinor: number | null;
};

export type ServiceDraft = {
  id: string;
  title: string;
  workshop: string | null;
  selfService: boolean;
  date: IsoDate;
  odometerMetres: number | null;
  labourCostMinor: number;
  partsCostMinor: number;
  totalCostMinor: number;
  notes: string | null;
  itemsSummary: string | null;
  /** Rules this service resets. */
  completedRules: MaintenanceRule[];
  /** What was fitted under each rule. Only those with something recorded. */
  items: ServiceItemDraft[];
  receiptPaths: string[];
  estimate: WorkshopEstimate | null;
  existing?: ServiceRecord;
  /** Item rows already saved against this service, replaced on edit. */
  existingItems?: ServiceItem[];
};

/**
 * Saving a service.
 *
 * A completed service resets the maintenance rules it covered, and records a
 * completion row for each — always linked back to the service, so the money is
 * counted once (requirement 24 / 28).
 *
 * Rules whose completion was recorded by a *previous* version of this service and
 * then unticked are left alone: un-resetting a rule retroactively would be
 * surprising, and the rider can complete it again explicitly.
 */
export function useSaveService(options: { onSaved?: (service: ServiceRecord) => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<ServiceDraft, ServiceRecord>({
    mutationFn: async (draft) => {
      const { uid, bikeId, currency } = requireGarage(ctx);
      const now = Date.now();

      const service: ServiceRecord = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        title: draft.title,
        workshop: draft.selfService ? null : draft.workshop,
        selfService: draft.selfService,
        date: draft.date,
        odometerMetres: draft.odometerMetres,
        labourCostMinor: draft.labourCostMinor,
        partsCostMinor: draft.partsCostMinor,
        totalCostMinor: draft.totalCostMinor,
        currency: draft.existing?.currency ?? currency,
        notes: draft.notes,
        completedRuleIds: draft.completedRules.map((r) => r.id),
        itemsSummary: draft.itemsSummary,
        receiptPaths: draft.receiptPaths,
        estimate: draft.estimate,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };

      await serviceRepository.save(uid, service, draft.existing === undefined);

      // Ticked rules are reset by the service. No separate cost record is
      // written: the service total already carries that money, and writing it
      // twice is precisely the double-count this product refuses to make.
      const alreadyRecorded = new Set(draft.existing?.completedRuleIds ?? []);
      for (const rule of draft.completedRules) {
        if (alreadyRecorded.has(rule.id)) continue;
        const completedMetres = draft.odometerMetres ?? rule.lastCompletedMetres;
        await maintenanceRuleRepository.patch(uid, rule.id, {
          lastCompletedOdometer: completedMetres === null ? null : completedMetres / 1000,
          lastCompletedDate: draft.date,
        });
      }

      // Item lines are replaced wholesale rather than diffed: a service is
      // edited as one thing, and reconciling five rows by identity would be
      // more ways to get it wrong than rewriting them.
      for (const existing of draft.existingItems ?? []) {
        await serviceItemRepository.remove(uid, existing.id);
      }
      for (const item of draft.items) {
        await serviceItemRepository.save(
          uid,
          {
            id: serviceItemRepository.newId(),
            userId: uid,
            bikeId,
            createdAt: now,
            updatedAt: now,
            serviceId: draft.id,
            ruleId: item.ruleId,
            category: item.category,
            brand: item.brand,
            product: item.product,
            spec: item.spec,
            quantity: item.quantity,
            unit: item.unit,
            costMinor: item.costMinor,
            currency: draft.existing?.currency ?? currency,
          },
          true,
        );
      }

      if (draft.odometerMetres !== null) {
        await bikeRepository.syncCurrentOdometer(bikeId, draft.odometerMetres);
      }

      return service;
    },
    successMessage: (_service, draft) => (draft.existing ? 'Service updated' : 'Service record saved'),
    onSuccess: (service) => {
      options.onSaved?.(service);
      if (router.canGoBack()) router.back();
      else router.replace('/services');
    },
  });
}

export function useDeleteService(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await serviceRepository.remove(uid, id);
    },
    successMessage: 'Service record deleted',
    onSuccess: () => options.onDeleted?.(),
  });
}

export function useNewServiceId(): () => string {
  return () => serviceRepository.newId();
}

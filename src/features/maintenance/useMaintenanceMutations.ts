import { useRouter } from 'expo-router';

import { defaultWarnAheadDays, defaultWarnAheadMetres } from '@/calculations/maintenance';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import {
  bikeRepository,
  maintenanceRuleRepository,
  serviceItemRepository,
  serviceRepository,
} from '@/repositories';
import type { IsoDate, MaintenanceRule, ServiceRecord } from '@/types';
import type { ServiceItemDraft } from '@/features/services/useServiceMutations';

export type RuleDraft = {
  id: string;
  name: string;
  intervalMetres: number | null;
  intervalDays: number | null;
  warnAheadMetres: number | null;
  warnAheadDays: number | null;
  enabled: boolean;
  notes: string | null;
  existing?: MaintenanceRule;
};

export function useSaveRule(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<RuleDraft, MaintenanceRule>({
    mutationFn: async (draft) => {
      const { uid, bikeId } = requireGarage(ctx);
      const now = Date.now();

      const rule: MaintenanceRule = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        name: draft.name,
        intervalMetres: draft.intervalMetres,
        intervalDays: draft.intervalDays,
        warnAheadMetres:
          draft.warnAheadMetres ??
          (draft.intervalMetres !== null ? defaultWarnAheadMetres(draft.intervalMetres) : 0),
        warnAheadDays:
          draft.warnAheadDays ?? (draft.intervalDays !== null ? defaultWarnAheadDays(draft.intervalDays) : 0),
        enabled: draft.enabled,
        lastCompletedMetres: draft.existing?.lastCompletedMetres ?? null,
        lastCompletedDate: draft.existing?.lastCompletedDate ?? null,
        notes: draft.notes,
      };

      await maintenanceRuleRepository.save(uid, rule, draft.existing === undefined);
      return rule;
    },
    successMessage: 'Maintenance rule saved',
    onSuccess: () => {
      options.onSaved?.();
      if (router.canGoBack()) router.back();
      else router.replace('/maintenance');
    },
  });
}

export function useDeleteRule(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await maintenanceRuleRepository.remove(uid, id);
    },
    successMessage: 'Maintenance rule removed',
    onSuccess: () => options.onDeleted?.(),
  });
}

export type CompletionReason = 'routine' | 'unscheduled';

export type CompletionDraft = {
  /** Why it was done. An off-schedule change is noted on the record. */
  reason?: CompletionReason;
  /** What was fitted, if the rider recorded it. */
  items?: ServiceItemDraft[];
  rule: MaintenanceRule;
  date: IsoDate;
  odometerMetres: number;
  costMinor: number | null;
  workshop: string | null;
  notes: string | null;
  /** Set when the completion is being recorded as part of a service. */
  serviceId: string | null;
};

/**
 * Marks a rule complete.
 *
 * The rule's `lastCompleted*` fields move the next due point forward. A cost
 * entered here becomes an ordinary expense linked back to the rule, which is how
 * the shared database already models a one-off maintenance cost — so the web
 * product sees it too, and it lands in the ledger exactly once.
 *
 * When the completion belongs to a service, no expense is written at all: the
 * service already carries that money (requirement 23 / 28).
 */
export function useCompleteRule(options: { onCompleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<CompletionDraft, void>({
    mutationFn: async (draft) => {
      const { uid, bikeId, currency } = requireGarage(ctx);
      const now = Date.now();

      await maintenanceRuleRepository.patch(uid, draft.rule.id, {
        lastCompletedOdometer: draft.odometerMetres / 1000,
        lastCompletedDate: draft.date,
      });

      // Work done outside a booked service is still work done. It used to write
      // a loose expense labelled "other", which left the rider's service history
      // silently missing every unscheduled oil change — and nowhere to record
      // which oil went in. It now writes a real service record, so there is one
      // path for all maintenance and the same questions can be asked of it:
      // what was fitted, how far it ran, what it cost.
      if (draft.serviceId === null) {
        const serviceId = serviceRepository.newId();
        const service: ServiceRecord = {
          id: serviceId,
          userId: uid,
          bikeId,
          createdAt: now,
          updatedAt: now,
          title: draft.rule.name,
          workshop: draft.workshop,
          selfService: draft.workshop === null,
          date: draft.date,
          odometerMetres: draft.odometerMetres,
          labourCostMinor: 0,
          partsCostMinor: draft.costMinor ?? 0,
          totalCostMinor: draft.costMinor ?? 0,
          currency,
          notes: draft.reason === 'unscheduled' ? (draft.notes ?? 'Done outside the schedule') : draft.notes,
          completedRuleIds: [draft.rule.id],
          itemsSummary: draft.rule.name,
          receiptPaths: [],
          estimate: null,
          clientRef: `${draft.rule.id}:${draft.date}`,
        };
        await serviceRepository.save(uid, service, true);

        for (const item of draft.items ?? []) {
          await serviceItemRepository.save(
            uid,
            {
              id: serviceItemRepository.newId(),
              userId: uid,
              bikeId,
              createdAt: now,
              updatedAt: now,
              serviceId,
              ruleId: draft.rule.id,
              category: item.category,
              brand: item.brand,
              product: item.product,
              spec: item.spec,
              quantity: item.quantity,
              unit: item.unit,
              costMinor: item.costMinor,
              currency,
            },
            true,
          );
        }
      }

      await bikeRepository.syncCurrentOdometer(bikeId, draft.odometerMetres);
    },
    successMessage: (_result, draft) => `${draft.rule.name} marked complete`,
    onSuccess: () => options.onCompleted?.(),
  });
}

export function useNewRuleId(): () => string {
  return () => maintenanceRuleRepository.newId();
}

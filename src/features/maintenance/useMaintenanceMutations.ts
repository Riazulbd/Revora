import { useRouter } from 'expo-router';

import { defaultWarnAheadDays, defaultWarnAheadMetres } from '@/calculations/maintenance';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { bikeRepository, expenseRepository, maintenanceRuleRepository } from '@/repositories';
import type { Expense, IsoDate, MaintenanceRule } from '@/types';

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

export type CompletionDraft = {
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

      const standalone = draft.serviceId === null;
      if (standalone && draft.costMinor !== null && draft.costMinor > 0) {
        const expense: Expense = {
          id: expenseRepository.newId(),
          userId: uid,
          bikeId,
          createdAt: now,
          updatedAt: now,
          amountMinor: draft.costMinor,
          currency,
          category: 'other',
          derived: false,
          linkedRuleId: draft.rule.id,
          date: draft.date,
          note: draft.notes ?? draft.rule.name,
          clientRef: `${draft.rule.id}:${draft.date}`,
        };
        await expenseRepository.save(uid, expense, true);
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

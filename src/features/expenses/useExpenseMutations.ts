import { useRouter } from 'expo-router';

import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { expenseRepository } from '@/repositories';
import type { Expense, ExpenseCategory, IsoDate } from '@/types';

export type ExpenseDraft = {
  id: string;
  amountMinor: number;
  category: ExpenseCategory;
  date: IsoDate;
  note: string | null;
  existing?: Expense;
};

/**
 * A manual expense.
 *
 * Fuel, services, parts and accessories are never entered here — they link into
 * the ledger from their own records. The Add expense screen says so, and the
 * ledger builder guarantees it.
 */
export function useSaveExpense(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<ExpenseDraft, Expense>({
    mutationFn: async (draft) => {
      const { uid, bikeId, currency } = requireGarage(ctx);
      const now = Date.now();

      const expense: Expense = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        amountMinor: draft.amountMinor,
        currency: draft.existing?.currency ?? currency,
        category: draft.category,
        // A manual expense is never derived — that flag marks costs the web
        // product files here on behalf of a record this app already owns.
        derived: false,
        linkedRuleId: draft.existing?.linkedRuleId ?? null,
        date: draft.date,
        note: draft.note,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };

      await expenseRepository.save(uid, expense, draft.existing === undefined);
      return expense;
    },
    successMessage: (_e, draft) => (draft.existing ? 'Expense updated' : 'Expense added to ledger'),
    onSuccess: () => {
      options.onSaved?.();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/expenses');
    },
  });
}

export function useDeleteExpense(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await expenseRepository.remove(uid, id);
    },
    successMessage: 'Expense removed',
    onSuccess: () => options.onDeleted?.(),
  });
}

export function useNewExpenseId(): () => string {
  return () => expenseRepository.newId();
}

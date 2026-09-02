import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  ChoiceGrid,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from '@/calculations/expenses';
import { useGarageData } from '@/features/bikes/useGarageData';
import {
  useDeleteExpense,
  useNewExpenseId,
  useSaveExpense,
} from '@/features/expenses/useExpenseMutations';
import { fromMinor, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import { expenseSchema } from '@/validation/schemas';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Expense, ExpenseCategory } from '@/types';
import { todayIso } from '@/utils/date';

/**
 * A manual expense — the costs that have no record of their own.
 *
 * Fuel, services, parts and accessories are deliberately absent from the category
 * list: they link into the ledger from their own records, and offering them here
 * would be an invitation to double-count.
 */
export default function ExpenseEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-expense-add">
        <ScreenHeader title={editingId ? 'Edit expense' : 'Add expense'} />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? (analytics.expenses.find((e) => e.id === editingId) ?? null) : null;

  return <ExpenseForm key={existing?.id ?? 'new'} existing={existing} analytics={analytics} />;
}

function ExpenseForm({ existing, analytics }: { existing: Expense | null; analytics: BikeAnalytics }) {
  const router = useRouter();

  const newExpenseId = useNewExpenseId();
  const generatedId = useStableId(newExpenseId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);

  const [amount, setAmount] = useState(existing ? fromMinor(existing.amountMinor, decimals) : '');
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'parking');
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveExpense = useSaveExpense();
  const deleteExpense = useDeleteExpense({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/expenses');
    },
  });

  const submit = async () => {
    const result = expenseSchema.safeParse({
      amountMinor: toMinor(amount, currency) ?? 0,
      category,
      date,
      note: toTrimmed(note),
    });

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    await saveExpense.submit({
      id: recordId,
      amountMinor: result.data.amountMinor,
      category: result.data.category,
      date: result.data.date,
      note: result.data.note,
      ...(existing ? { existing } : {}),
    });
  };

  return (
    <Screen testID="screen-expense-add">
      <ScreenHeader title={existing ? 'Edit expense' : 'Add expense'} />

      <Stack gap={14}>
        <Field label={`Amount (${currencySymbol(currency)})`} error={errors.amountMinor ?? null}>
          <Input
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            keyboardType="decimal-pad"
            size="numeric"
            invalid={Boolean(errors.amountMinor)}
            testID="input-amount"
          />
        </Field>

        <Field label="Category">
          <ChoiceGrid
            options={EXPENSE_CATEGORIES.map((value) => ({ value, label: expenseCategoryLabel(value) }))}
            value={category}
            onChange={setCategory}
          />
        </Field>

        <FieldRow>
          <Field label="Date" flex={1}>
            <DateField value={date} onChange={setDate} maximumDate={new Date()} testID="field-expense-date" />
          </Field>
          <Field label="Note (optional)" flex={1}>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Bashundhara parking"
              size="compact"
              testID="input-expense-note"
            />
          </Field>
        </FieldRow>

        <Button
          label={existing ? 'Save changes' : 'Save expense'}
          onPress={submit}
          loading={saveExpense.isPending}
          testID="cta-save-expense"
        />

        {existing ? (
          <Button
            label="Delete expense"
            variant="secondary"
            size="medium"
            onPress={() => setDeleteOpen(true)}
            testID="cta-delete-expense"
          />
        ) : null}

        <Txt role="helper" tone="mut" align="center">
          Fuel, services and parts add themselves — don&apos;t enter them here twice.
        </Txt>
      </Stack>

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this expense?"
        message="It comes out of your ledger and monthly totals. This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteExpense.isPending}
        onConfirm={() => existing && deleteExpense.submit(existing.id)}
        testID="dialog-delete-expense"
      />
    </Screen>
  );
}

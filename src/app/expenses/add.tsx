import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  Card,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
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
import { fontFamily, useTheme } from '@/theme';

/**
 * A manual expense — the costs that have no record of their own.
 *
 * Fuel, services and parts are on the category grid, but none of them saves an
 * expense: each one draws the board's reroute notice instead
 * (`money---expense-allowance-pro--01`). Logging a service as a bare number
 * would lose its parts, its maintenance reset and its heading, and a fill
 * logged here would never reach mileage or cost per kilometre — so the screen
 * offers the right record rather than silently accepting the wrong one.
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

/** The three records an expense line must never stand in for. */
type Reroute = 'service' | 'fuel' | 'part';

const REROUTE: Record<
  Reroute,
  { tile: string; lead: string; body: string; cta: string; route: '/services/add' | '/fuel/add' | '/parts/add'; testID: string }
> = {
  service: {
    tile: 'Servicing',
    lead: 'Servicing belongs in a service record.',
    body: 'Logged there it carries parts, resets maintenance rules and lands under the right heading — an expense line here is just a number.',
    cta: 'Log a service instead',
    route: '/services/add',
    testID: 'service',
  },
  fuel: {
    tile: 'Fuel',
    lead: 'A fill belongs in the fuel log.',
    body: 'Logged there it sets your mileage, your cost per kilometre and the odometer every other figure reads from — an expense line here is just a number.',
    cta: 'Log a fill instead',
    route: '/fuel/add',
    testID: 'fuel',
  },
  part: {
    tile: 'Parts',
    lead: 'A part belongs in the parts list.',
    body: 'Logged there it carries its own service life and warranty, and it counts inside the service it was fitted during — an expense line here is just a number.',
    cta: 'Log a part instead',
    route: '/parts/add',
    testID: 'part',
  },
};

const REROUTE_KINDS: readonly Reroute[] = ['fuel', 'service', 'part'];

function ExpenseForm({ existing, analytics }: { existing: Expense | null; analytics: BikeAnalytics }) {
  const router = useRouter();

  const newExpenseId = useNewExpenseId();
  const generatedId = useStableId(newExpenseId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);

  const [amount, setAmount] = useState(existing ? fromMinor(existing.amountMinor, decimals) : '');
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'parking');
  const [reroute, setReroute] = useState<Reroute | null>(null);
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

  const notice = reroute === null ? null : REROUTE[reroute];

  return (
    <Screen testID="screen-expense-add">
      <ScreenHeader title={existing ? 'Edit expense' : 'Add expense'} />

      <Field label="Category">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} testID="grid-expense-category">
          {EXPENSE_CATEGORIES.map((value) => (
            <CategoryTile
              key={value}
              label={expenseCategoryLabel(value)}
              selected={reroute === null && category === value}
              onPress={() => {
                setReroute(null);
                setCategory(value);
              }}
              testID={`category-${value}`}
            />
          ))}
          {REROUTE_KINDS.map((kind) => (
            <CategoryTile
              key={kind}
              label={REROUTE[kind].tile}
              selected={reroute === kind}
              onPress={() => setReroute(kind)}
              testID={`category-reroute-${REROUTE[kind].testID}`}
            />
          ))}
        </View>
      </Field>

      <FieldRow style={{ marginTop: 16 }}>
        <Field label="Date" flex={1}>
          <DateField
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
            padX={14}
            testID="field-expense-date"
          />
        </Field>
        <Field label="Amount" flex={1} error={errors.amountMinor ?? null}>
          <Input
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            keyboardType="decimal-pad"
            size="numeric"
            align="left"
            padX={14}
            prefix={currencySymbol(currency)}
            invalid={Boolean(errors.amountMinor)}
            // The board draws this field at the 52px date height, not the 56px
            // the numeric size is elsewhere; the 700 17px figure is the numeric one.
            style={{ height: 52 }}
            testID="input-amount"
          />
        </Field>
      </FieldRow>

      <Field label="Note (optional)" style={{ marginTop: 16 }}>
        <Input
          value={note}
          onChangeText={setNote}
          placeholder="Bashundhara parking"
          padX={14}
          testID="input-expense-note"
        />
      </Field>

      {notice ? (
        <Card variant="tinted" style={{ marginTop: 18, gap: 10 }} testID={`reroute-${notice.testID}`}>
          <Txt role="body" style={{ lineHeight: 19.5 }}>
            <Txt role="body" style={{ fontFamily: fontFamily[700], lineHeight: 19.5 }}>
              {notice.lead}{' '}
            </Txt>
            {notice.body}
          </Txt>
          <Button
            label={notice.cta}
            size="medium"
            onPress={() => router.replace(notice.route)}
            testID={`cta-reroute-${notice.testID}`}
          />
          <Button
            label="Keep as a plain expense"
            variant="ghost"
            tone="mut"
            size="compact"
            onPress={() => {
              setReroute(null);
              setCategory('other');
            }}
            testID={`cta-keep-expense-${notice.testID}`}
          />
        </Card>
      ) : null}

      <Button
        label={existing ? 'Save changes' : 'Save expense'}
        onPress={submit}
        loading={saveExpense.isPending}
        disabled={reroute !== null}
        style={{ marginTop: 18 }}
        testID="cta-save-expense"
      />

      {existing ? (
        <Button
          label="Delete expense"
          variant="dangerSubtle"
          size="medium"
          onPress={() => setDeleteOpen(true)}
          style={{ marginTop: 12 }}
          testID="cta-delete-expense"
        />
      ) : null}

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

/**
 * One tile of the board's category grid: `height:44px; border-radius:11px`,
 * three to a row. Selected is the solid ink tile the boards use for a chosen
 * chip — white label in light, the page colour in dark.
 */
function CategoryTile({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { c, radius, dark } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        flexBasis: '30%',
        flexGrow: 1,
        height: 44,
        borderRadius: radius.tile,
        backgroundColor: selected ? c.ink : c.sur,
        borderWidth: selected ? 0 : 1,
        borderColor: c.brd,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt
        numberOfLines={1}
        style={{
          fontFamily: fontFamily[selected ? 700 : 600],
          fontSize: 13,
          color: selected ? (dark ? c.bg : '#FFFFFF') : c.ink,
        }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

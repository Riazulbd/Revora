import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  AmountHero,
  Button,
  Card,
  DateField,
  Dialog,
  Eyebrow,
  Icon,
  InputRow,
  ListCard,
  Screen,
  ScreenHeader,
  SkeletonList,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from '@/calculations/expenses';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDeleteExpense, useNewExpenseId, useSaveExpense } from '@/features/expenses/useExpenseMutations';
import { fromMinor, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import { expenseSchema } from '@/validation/schemas';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Expense, ExpenseCategory } from '@/types';
import { formatShortDate, todayIso } from '@/utils/date';
import { fontFamily, useTheme } from '@/theme';

/**
 * A manual expense (Figma `B2 Expenses — Add expense`) — the costs that have
 * no record of their own.
 *
 * Fuel, servicing and parts sit among the category chips, but none of them
 * saves an expense: each one draws the reroute notice instead. Logging a
 * service as a bare number would lose its parts, its maintenance reset and
 * its heading, and a fill logged here would never reach mileage or cost per
 * kilometre — so the screen offers the right record rather than silently
 * accepting the wrong one.
 */
export default function ExpenseEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-expense-add">
        <ScreenHeader title={editingId ? 'Edit expense' : 'Add expense'} icon="x" />
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

/** The design's chip order: the real categories, then the three reroutes. */
const CHIP_ORDER: readonly ExpenseCategory[] = [
  'registration',
  'insurance',
  'parking',
  'toll',
  'wash',
  'fine',
  'gear',
  'modification',
  'other',
];

function ExpenseForm({ existing, analytics }: { existing: Expense | null; analytics: BikeAnalytics }) {
  const router = useRouter();
  const { activeBike } = useGarage();

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
  const categories = CHIP_ORDER.filter((value) => EXPENSE_CATEGORIES.includes(value));

  return (
    <Screen testID="screen-expense-add" contentStyle={{ flexGrow: 1, gap: 16 }}>
      <ScreenHeader
        title={existing ? 'Edit expense' : 'Add expense'}
        icon="x"
        {...(existing ? { titleSuffix: `· ${formatShortDate(existing.date)}` } : {})}
        style={{ marginBottom: 0 }}
      />

      <AmountHero
        label="Amount"
        symbol={currencySymbol(currency)}
        value={amount}
        onChangeText={setAmount}
        size="medium"
        chip={{ label: `${reroute ? REROUTE[reroute].tile : expenseCategoryLabel(category)} · ${activeBike?.nickname ?? 'Your bike'}` }}
        {...(errors.amountMinor === undefined ? {} : { error: errors.amountMinor })}
        accessibilityLabel={`Amount, in ${currencySymbol(currency)}`}
        testID="input-amount"
      />

      <View style={{ gap: 10 }}>
        <Eyebrow>Category</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} testID="grid-expense-category">
          {categories.map((value) => (
            <CategoryChip
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
            <CategoryChip
              key={kind}
              label={REROUTE[kind].tile}
              reroute
              selected={reroute === kind}
              onPress={() => setReroute(kind)}
              testID={`category-reroute-${REROUTE[kind].testID}`}
            />
          ))}
        </View>
        <Txt role="helper" tone="mut">
          Fuel, servicing and parts open their own records — that&rsquo;s where they set mileage, reset maintenance and
          carry warranty.
        </Txt>
      </View>

      {notice ? (
        <Card variant="tinted" style={{ gap: 10 }} testID={`reroute-${notice.testID}`}>
          <Txt role="body">
            <Txt role="body" style={{ fontFamily: fontFamily[600] }}>
              {notice.lead}{' '}
            </Txt>
            {notice.body}
          </Txt>
          <Button label={notice.cta} size="medium" onPress={() => router.replace(notice.route)} testID={`cta-reroute-${notice.testID}`} />
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

      <ListCard testID="card-fields">
        <DateField
          variant="row"
          icon="calendar"
          label="Date"
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
          todayLabel="Today, "
          format={formatShortDate}
          testID="field-expense-date"
        />
        <InputRow
          icon="penLine"
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Bashundhara parking"
          autoCapitalize="sentences"
          testID="input-expense-note"
        />
      </ListCard>

      <View style={{ flex: 1, minHeight: 8 }} />

      <Button
        label={existing ? 'Save changes' : 'Save expense'}
        size="xlarge"
        onPress={submit}
        loading={saveExpense.isPending}
        disabled={reroute !== null}
        testID="cta-save-expense"
      />

      {existing ? (
        <Button
          label="Delete expense"
          icon="trash"
          variant="dangerSubtle"
          size="large"
          onPress={() => setDeleteOpen(true)}
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
 * Figma `Chip`: a 48px pill, `600 13px`. Selected is solid ink with a tick
 * and a `700` white label; a reroute chip sits on the inset surface with an
 * arrow, because it leads somewhere rather than picking something.
 */
function CategoryChip({
  label,
  selected,
  reroute = false,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  reroute?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { c } = useTheme();
  const ink = selected ? c.sur : c.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={reroute ? `${label}, opens its own record` : label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: reroute ? 4 : 6,
        paddingLeft: selected && !reroute ? 14 : 16,
        paddingRight: reroute ? 12 : 16,
        borderRadius: 999,
        backgroundColor: selected ? c.ink : reroute ? c.sur2 : c.sur,
        borderWidth: selected || reroute ? 0 : 1,
        borderColor: c.brd,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {selected && !reroute ? <Icon name="check" size={16} color={ink} /> : null}
      <Txt numberOfLines={1} style={{ fontFamily: fontFamily[selected ? 700 : 600], fontSize: 13, lineHeight: 16, color: ink }}>
        {label}
      </Txt>
      {reroute ? <Icon name="arrowUpRight" size={16} color={ink} /> : null}
    </Pressable>
  );
}

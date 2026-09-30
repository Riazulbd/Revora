import React, { useState } from 'react';
import { View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Eyebrow,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  StatRow,
  StatTile,
  ToggleRow,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { allowanceUnusedMinor } from '@/calculations/costs';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useUpdateCompanyAllowance } from '@/features/bikes/useBikeMutations';
import { fromMinor, toMinor } from '@/features/shared/formValues';
import { formatCurrency } from '@/utils/format';
import { formatMonthLong, monthKey } from '@/utils/date';

/**
 * The company allowance (`money---expense-allowance-pro--02`).
 *
 * The allowance changes what the *rider* pays. It never touches cost/km,
 * ownership cost or the ledger, and the closing note states that contract
 * plainly — which is why the board gives it a line of its own rather than a
 * footnote.
 */
export default function CompanyBike() {
  const { activeBike, units } = useGarage();
  const { analytics } = useGarageData();

  const currency = activeBike?.currency ?? units.currency;
  const decimals = currencyDecimals(currency);

  const [enabled, setEnabled] = useState(activeBike?.company.enabled ?? false);
  const [companyName, setCompanyName] = useState(activeBike?.company.companyName ?? '');
  const [allowance, setAllowance] = useState(
    fromMinor(activeBike?.company.monthlyAllowanceMinor ?? null, decimals),
  );
  const [error, setError] = useState<string | null>(null);

  const save = useUpdateCompanyAllowance();

  const submit = async () => {
    const parsed = enabled ? toMinor(allowance, currency) : 0;
    if (enabled && parsed === null) {
      setError('Enter the monthly allowance.');
      return;
    }
    setError(null);
    await save.submit({
      enabled,
      companyName: companyName.trim(),
      monthlyAllowanceMinor: parsed ?? 0,
    });
  };

  if (!activeBike || !analytics) return null;

  const summary = analytics.allowance;
  const month = formatMonthLong(monthKey(analytics.today));
  const unused = allowanceUnusedMinor(summary);

  return (
    <Screen testID="screen-company">
      <ScreenHeader title="Company allowance" />

      <Card variant="list">
        <ToggleRow
          title="This is a company bike"
          description="An employer covers part of the running cost"
          value={enabled}
          onChange={setEnabled}
          testID="toggle-company"
        />
      </Card>

      {enabled ? (
        <View>
          <FieldRow style={{ marginTop: 14 }}>
            <Field label="Company" flex={1.4}>
              <Input
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Meghna Traders Ltd"
                autoCapitalize="words"
                padX={14}
                testID="input-company"
              />
            </Field>

            <Field label="Monthly allowance" flex={1} error={error}>
              <Input
                value={allowance}
                onChangeText={setAllowance}
                placeholder="3000"
                keyboardType="decimal-pad"
                prefix={currencySymbol(currency)}
                padX={14}
                invalid={Boolean(error)}
                testID="input-allowance"
              />
            </Field>
          </FieldRow>

          <Card style={{ marginTop: 16, gap: 12 }} testID="card-allowance-summary">
            <Eyebrow>{month} · After allowance</Eyebrow>

            <StatRow>
              <StatTile
                label="FUEL SPEND"
                value={formatCurrency(summary.fuelSpendMinor, currency)}
                testID="tile-fuel-spend"
              />
              <StatTile
                label="ALLOWANCE"
                value={formatCurrency(summary.allowanceMinor, currency)}
                testID="tile-allowance"
              />
              <StatTile
                label="YOU PAY"
                value={formatCurrency(summary.riderFuelCostMinor, currency)}
                tone="good"
                testID="tile-you-pay"
              />
            </StatRow>

            <Txt role="meta" tone="mut" testID="text-allowance-unused">
              {unused > 0
                ? `${formatCurrency(unused, currency)} of allowance unused this month.`
                : `The allowance is fully used this month — you pay ${formatCurrency(summary.riderFuelCostMinor, currency)} of the fuel.`}
            </Txt>
          </Card>

          <Banner
            variant="plain"
            message="The allowance offsets what you pay. Cost / km and ownership cost keep using the full amount — the bike costs what it costs, whoever pays."
            style={{ marginTop: 14 }}
            testID="note-allowance-contract"
          />
        </View>
      ) : null}

      <Button label="Save" onPress={submit} loading={save.isPending} style={{ marginTop: 16 }} testID="cta-save-company" />
    </Screen>
  );
}

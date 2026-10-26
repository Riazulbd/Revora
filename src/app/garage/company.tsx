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
  RowIcon,
  Screen,
  ScreenHeader,
  StatRow,
  StatTile,
  Toggle,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { allowanceSplit, allowanceUnusedMinor } from '@/calculations/costs';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useUpdateCompanyAllowance } from '@/features/bikes/useBikeMutations';
import { fromMinor, toMinor } from '@/features/shared/formValues';
import { formatCurrencySymbol } from '@/utils/format';
import { monthName } from '@/utils/date';
import { useTheme } from '@/theme';

/**
 * The company allowance (Figma `C5 Garage — Company allowance`).
 *
 * The allowance changes what the *rider* pays. It never touches cost/km,
 * ownership cost or the ledger, and the closing note states that contract
 * plainly — which is why it gets a card of its own rather than a footnote.
 */
export default function CompanyBike() {
  const { c } = useTheme();
  const { activeBike, units } = useGarage();
  const { analytics } = useGarageData();

  const currency = activeBike?.currency ?? units.currency;
  const decimals = currencyDecimals(currency);

  const [enabled, setEnabled] = useState(activeBike?.company.enabled ?? false);
  const [companyName, setCompanyName] = useState(activeBike?.company.companyName ?? '');
  const [allowance, setAllowance] = useState(fromMinor(activeBike?.company.monthlyAllowanceMinor ?? null, decimals));
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
  const month = monthName(analytics.today);
  const unused = allowanceUnusedMinor(summary);
  const split = allowanceSplit(summary);

  return (
    <Screen testID="screen-company" contentStyle={{ gap: 16 }}>
      <ScreenHeader title="Company allowance" style={{ marginBottom: 0 }} />

      {/* Figma `Toggle card`. */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="card-company-toggle">
        <RowIcon icon="briefcase" tone="info" />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt role="rowTitleLarge">This is a company bike</Txt>
          <Txt role="meta" tone="mut">
            An employer covers part of the running cost
          </Txt>
        </View>
        <Toggle value={enabled} onChange={setEnabled} accessibilityLabel="This is a company bike" testID="toggle-company" />
      </Card>

      {enabled ? (
        <>
          <FieldRow>
            <Field label="Company" flex={1.5}>
              <Input
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Meghna Traders Ltd"
                autoCapitalize="words"
                inset="sur"
                testID="input-company"
              />
            </Field>
            <Field label="Monthly allowance" flex={1} error={error}>
              <Input
                value={allowance}
                onChangeText={setAllowance}
                placeholder="3,000"
                keyboardType="decimal-pad"
                prefix={currencySymbol(currency)}
                inset="sur"
                invalid={Boolean(error)}
                testID="input-allowance"
              />
            </Field>
          </FieldRow>

          {/* Figma `Summary card`: the month after the allowance, and how the fuel bill splits. */}
          <Card style={{ gap: 14 }} testID="card-allowance-summary">
            <Eyebrow>{`${month} · After allowance`}</Eyebrow>
            <StatRow>
              <StatTile label="Fuel spend" value={formatCurrencySymbol(summary.fuelSpendMinor, currency)} testID="tile-fuel-spend" />
              <StatTile label="Allowance" value={formatCurrencySymbol(summary.allowanceMinor, currency)} testID="tile-allowance" />
              <StatTile variant="good" label="You pay" value={formatCurrencySymbol(summary.riderFuelCostMinor, currency)} testID="tile-you-pay" />
            </StatRow>

            {split ? (
              <View style={{ gap: 6 }}>
                <View
                  style={{ height: 34, flexDirection: 'row', borderRadius: 999, overflow: 'hidden', backgroundColor: c.sur2 }}
                  accessible
                  accessibilityLabel={`Allowance covers ${Math.round(split.coveredShare * 100)} percent, you pay ${Math.round(split.riderShare * 100)} percent`}
                >
                  <View style={{ flex: Math.max(split.coveredShare, 0.001), backgroundColor: c.ink, justifyContent: 'center', paddingLeft: 12 }}>
                    {split.coveredShare >= 0.18 ? (
                      <Txt role="smallStrong" color={c.sur} numberOfLines={1}>
                        {`${Math.round(split.coveredShare * 100)}%`}
                      </Txt>
                    ) : null}
                  </View>
                  <View style={{ flex: Math.max(split.riderShare, 0.001), backgroundColor: c.accBright, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 }}>
                    {split.riderShare >= 0.18 ? (
                      <Txt role="smallStrong" color="#FFFFFF" numberOfLines={1}>
                        {`${Math.round(split.riderShare * 100)}%`}
                      </Txt>
                    ) : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt role="micro">{`Allowance covers ${Math.round(split.coveredShare * 100)}%`}</Txt>
                  <Txt role="micro" tone="acc">{`You ${Math.round(split.riderShare * 100)}%`}</Txt>
                </View>
              </View>
            ) : null}

            <Txt role="bodySmall" tone="mut" testID="text-allowance-unused">
              {summary.fuelSpendMinor === 0
                ? `Nothing spent on fuel in ${month} yet.`
                : unused > 0
                  ? `${formatCurrencySymbol(unused, currency)} of allowance unused this month.`
                  : `The allowance is fully used this month — you pay ${formatCurrencySymbol(summary.riderFuelCostMinor, currency)} of the fuel.`}
            </Txt>
          </Card>

          <Banner
            tone="neutral"
            message="The allowance offsets what you pay. Cost / km and ownership cost keep using the full amount — the bike costs what it costs, whoever pays."
            testID="note-allowance-contract"
          />
        </>
      ) : null}

      <Button label="Save" size="xlarge" onPress={submit} loading={save.isPending} testID="cta-save-company" />
    </Screen>
  );
}

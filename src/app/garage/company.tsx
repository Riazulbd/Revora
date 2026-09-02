import React, { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  Field,
  Input,
  ProgressBar,
  Screen,
  ScreenHeader,
  Stack,
  ToggleRow,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useUpdateCompanyAllowance } from '@/features/bikes/useBikeMutations';
import { fromMinor, toMinor } from '@/features/shared/formValues';
import { formatCurrency } from '@/utils/format';
import { formatMonthLong, monthKey } from '@/utils/date';
import { useTheme } from '@/theme';

/**
 * The company allowance.
 *
 * The allowance changes what the *rider* pays. It never touches cost/km,
 * ownership cost or the ledger, and the screen states that contract plainly.
 */
export default function CompanyBike() {
  const { c, radius } = useTheme();
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

  return (
    <Screen testID="screen-company">
      <ScreenHeader title="Company bike" />

      <Stack>
        <Card variant="list" style={{ paddingVertical: 4 }}>
          <ToggleRow
            title="Company allowance"
            description="Track employer contribution separately"
            value={enabled}
            onChange={setEnabled}
            testID="toggle-company"
          />
        </Card>

        {enabled ? (
          <View style={{ gap: 14 }}>
            <Field label="Company name">
              <Input
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="TechScape Ltd"
                autoCapitalize="words"
                testID="input-company"
              />
            </Field>

            <Field label={`Monthly allowance (${currencySymbol(currency)})`} error={error}>
              <Input
                value={allowance}
                onChangeText={setAllowance}
                placeholder="3000"
                keyboardType="decimal-pad"
                size="compact"
                invalid={Boolean(error)}
                testID="input-allowance"
              />
            </Field>

            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <Txt role="smallStrong" tone="mut">
                  Allowance used · {month}
                </Txt>
                <Txt role="rowTitle" numberOfLines={1}>
                  {formatCurrency(summary.usedMinor, currency)} /{' '}
                  {formatCurrency(summary.allowanceMinor, currency)}
                </Txt>
              </View>

              <ProgressBar fraction={summary.usedFraction} />

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: summary.riderFuelCostMinor === 0 ? c.goodS : c.sur2,
                  borderRadius: radius.tile,
                  paddingHorizontal: 13,
                  paddingVertical: 10,
                  gap: 10,
                }}
              >
                <Txt role="smallStrong">Rider fuel cost this month</Txt>
                <Txt
                  role="mediumStrong"
                  tone={summary.riderFuelCostMinor === 0 ? 'good' : 'ink'}
                  numberOfLines={1}
                >
                  {summary.riderFuelCostMinor === 0
                    ? `${formatCurrency(0, currency)} · covered`
                    : formatCurrency(summary.riderFuelCostMinor, currency)}
                </Txt>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: c.sur2,
                  borderRadius: radius.tile,
                  paddingHorizontal: 13,
                  paddingVertical: 10,
                  gap: 10,
                }}
              >
                <Txt role="smallStrong" tone="mut">
                  True operating cost · {month}
                </Txt>
                <Txt role="mediumStrong" numberOfLines={1}>
                  {formatCurrency(summary.trueOperatingCostMinor, currency)}
                </Txt>
              </View>

              <Txt role="micro" tone="mut" style={{ lineHeight: 16 }}>
                The allowance never hides real costs — ownership cost and cost/km always use the full amount.
              </Txt>
            </Card>
          </View>
        ) : null}

        <Button label="Save" onPress={submit} loading={save.isPending} testID="cta-save-company" />
      </Stack>
    </Screen>
  );
}

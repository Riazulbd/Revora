import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Icon, Sheet, Txt } from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { exportFuelCsv } from '@/features/premium/exportCsv';
import type { CurrencyCode, FuelAdjustment, FuelEntry, UnitPreferences } from '@/types';
import { useTheme } from '@/theme';

/**
 * The Pro gate.
 *
 * Entitlement is read from the profile document, which only a trusted server can
 * write (see firestore.rules). Nothing here flips a local flag, so there is no
 * client-side path to Pro (requirement 33 / mistake 27).
 */
export type ProGate = {
  isPro: boolean;
  visible: boolean;
  feature: string;
  open: (feature: string) => void;
  close: () => void;
  exportFuelCsv: (
    entries: readonly FuelEntry[],
    adjustments: readonly FuelAdjustment[],
    currency: CurrencyCode,
    units: UnitPreferences,
  ) => Promise<void>;
};

export function useProGate(): ProGate {
  const { isPro } = useGarage();
  const [visible, setVisible] = useState(false);
  const [feature, setFeature] = useState('This feature');

  const open = useCallback((next: string) => {
    setFeature(next);
    setVisible(true);
  }, []);

  return {
    isPro,
    visible,
    feature,
    open,
    close: () => setVisible(false),
    exportFuelCsv: async (...args) => {
      if (!isPro) { open('CSV fuel-history export'); return; }
      await exportFuelCsv(...args);
    },
  };
}

export function ProUpsellSheet({ gate }: { gate: ProGate }) {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <Sheet visible={gate.visible} onClose={gate.close} title={gate.feature} testID="sheet-pro">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            backgroundColor: c.accS,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={20} color={c.acc} />
        </View>
        <Txt role="body" tone="mut" style={{ flex: 1 }}>
          {gate.feature} is part of <Txt role="body">Revora Pro</Txt>, along with multiple motorcycles,
          advanced statistics and the assistant.
        </Txt>
      </View>

      <View style={{ gap: 10 }}>
        <Button
          label="See Pro plan"
          onPress={() => {
            gate.close();
            router.push('/plan');
          }}
        />
        <Button label="Not now" variant="secondary" onPress={gate.close} />
      </View>
    </Sheet>
  );
}

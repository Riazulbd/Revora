import React from 'react';

import { RecordRow } from '@/components';
import { adjustmentReasonPhrase } from '@/calculations/fuellog';
import type { FuelAdjustment, UnitPreferences } from '@/types';
import { formatVolume, NO_VALUE } from '@/utils/format';
import { formatShortDate } from '@/utils/date';

/**
 * An adjustment on the fuel log — the board's third row: "2 Sep · … " over
 * "Adjustment · spillage −0.3 L", with a muted dash where a fill would show
 * what it cost.
 *
 * The odometer sits as `—` on purpose. An adjustment records fuel that left the
 * tank between fills; no reading is taken when it happens, and interpolating one
 * from the fills around it would be a figure the rider never gave us.
 */
export function FuelAdjustmentRow({
  adjustment,
  units,
  testID,
}: {
  adjustment: FuelAdjustment;
  units: UnitPreferences;
  testID?: string;
}) {
  const sign = adjustment.millilitres > 0 ? '+' : '−';
  const amount = formatVolume(Math.abs(adjustment.millilitres), units.volume);

  return (
    <RecordRow
      variant="flush"
      testID={testID}
      title={`${formatShortDate(adjustment.date)} · ${NO_VALUE}`}
      subtitle={`Adjustment · ${adjustmentReasonPhrase(adjustment)} ${sign}${amount}`}
      amount={NO_VALUE}
      amountTone="mut"
    />
  );
}

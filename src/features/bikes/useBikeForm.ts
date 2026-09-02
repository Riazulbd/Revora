import { useCallback, useState } from 'react';

import { bikeSchema } from '@/validation/schemas';
import { toInteger, toMetres, toMinor, toMl, toTrimmed } from '@/features/shared/formValues';
import type { UnitPreferences } from '@/types';
import { emptyBikeForm, type BikeFormErrors, type BikeFormState } from './BikeFormFields';

export type ParsedBike = {
  manufacturer: string;
  model: string;
  nickname: string;
  year: number | null;
  tankCapacityMl: number | null;
  purchasePriceMinor: number | null;
  odometerMetres: number;
  engineNumber: string | null;
  chassisNumber: string | null;
};

/**
 * Parses and validates the motorcycle form.
 *
 * Optional fields that are simply blank stay `null`; a field that was filled in
 * but cannot be read produces a message rather than silently becoming null,
 * which is how a typo in the purchase price would otherwise vanish.
 */
export function useBikeForm(initial: BikeFormState = emptyBikeForm, units: UnitPreferences) {
  const [value, setValue] = useState<BikeFormState>(initial);
  const [errors, setErrors] = useState<BikeFormErrors>({});

  const parse = useCallback((): ParsedBike | null => {
    const next: BikeFormErrors = {};

    const year = value.year.trim() === '' ? null : toInteger(value.year);
    if (value.year.trim() !== '' && year === null) next.year = 'Enter a year like 2025.';

    const odometerMetres = toMetres(value.odometer, units.distance);
    if (odometerMetres === null) next.odometer = 'Enter the current reading.';

    const tankCapacityMl = value.tankCapacity.trim() === '' ? null : toMl(value.tankCapacity, units.volume);
    if (value.tankCapacity.trim() !== '' && tankCapacityMl === null) {
      next.tankCapacity = 'Enter a number.';
    }

    const purchasePriceMinor =
      value.purchasePrice.trim() === '' ? null : toMinor(value.purchasePrice, units.currency);
    if (value.purchasePrice.trim() !== '' && purchasePriceMinor === null) {
      next.purchasePrice = 'Enter an amount.';
    }

    const nickname =
      value.nickname.trim() !== ''
        ? value.nickname.trim()
        : [value.manufacturer.trim(), value.model.trim()].filter(Boolean).join(' ');

    const candidate = {
      manufacturer: value.manufacturer.trim(),
      model: value.model.trim(),
      nickname,
      year,
      tankCapacityMl,
      purchasePriceMinor,
      odometerMetres: odometerMetres ?? 0,
    };

    const result = bikeSchema.safeParse(candidate);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      if (flat.nickname?.[0]) next.nickname = flat.nickname[0];
      if (flat.year?.[0]) next.year = flat.year[0];
      if (flat.tankCapacityMl?.[0]) next.tankCapacity = flat.tankCapacityMl[0];
      if (flat.purchasePriceMinor?.[0]) next.purchasePrice = flat.purchasePriceMinor[0];
      if (flat.odometerMetres?.[0]) next.odometer = flat.odometerMetres[0];
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !result.success) return null;

    return {
      ...result.data,
      engineNumber: toTrimmed(value.engineNumber),
      chassisNumber: toTrimmed(value.chassisNumber),
    };
  }, [value, units]);

  return { value, setValue, errors, parse };
}

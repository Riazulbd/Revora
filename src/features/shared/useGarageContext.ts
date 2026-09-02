import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { AppError } from '@/services/errors';
import type { Bike, CurrencyCode, UnitPreferences } from '@/types';

/**
 * The context every write needs: who is signed in, which motorcycle is selected,
 * and which units and currency their figures are in.
 *
 * Screens are only reachable with both a uid and a bike, so the throw here is a
 * programming-error guard, not a user-facing path.
 */
export type GarageContext = {
  uid: string;
  bike: Bike;
  bikeId: string;
  units: UnitPreferences;
  currency: CurrencyCode;
};

export function useGarageContext(): GarageContext | null {
  const { user } = useAuth();
  const { activeBike, units } = useGarage();

  if (!user || !activeBike) return null;

  return {
    uid: user.uid,
    bike: activeBike,
    bikeId: activeBike.id,
    units,
    currency: activeBike.currency,
  };
}

export function requireGarage(ctx: GarageContext | null): GarageContext {
  if (!ctx) {
    throw new AppError('validation', 'Add a motorcycle before saving this.');
  }
  return ctx;
}

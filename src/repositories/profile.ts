import { getDoc, setDoc, deleteDoc } from '@react-native-firebase/firestore';

import { toAppError } from '@/services/errors';
import type { SubscribeFn } from '@/services/liveQuery';
import type { UnitPreferences, UserProfile } from '@/types';
import { entitlementDoc, subscribeDoc, userDoc } from './base';
import { parseEntitlement, parseUserProfile } from './parsers';

/**
 * The signed-in rider's profile at `users/{uid}`, and their entitlement at
 * `entitlements/{uid}`.
 *
 * They are separate documents on purpose. The shared ruleset closes every client
 * write path to the entitlement — it is written only by the billing functions,
 * after a purchase has been verified — so there is no path from this app, or any
 * modified copy of it, to a free Pro plan (requirement 33 / mistake 27).
 */

export const profileRepository = {
  subscribe(uid: string): SubscribeFn<UserProfile | null> {
    return subscribeDoc<UserProfile>({ ref: userDoc(uid), parse: parseUserProfile });
  },

  /** The entitlement is read separately and merged into the profile by the provider. */
  subscribeEntitlement(uid: string): SubscribeFn<UserProfile['entitlement'] | null> {
    return subscribeDoc<UserProfile['entitlement']>({
      ref: entitlementDoc(uid),
      parse: (_id, data) => parseEntitlement(data),
    });
  },

  async get(uid: string): Promise<UserProfile | null> {
    try {
      const snapshot = await getDoc(userDoc(uid));
      const data = snapshot.data();
      return data ? parseUserProfile(snapshot.id, data) : null;
    } catch (error) {
      throw toAppError(error);
    }
  },

  /**
   * Creates the profile if it is missing, leaving any existing document — and
   * crucially anything the web product wrote — untouched.
   *
   * `currency` is required by the shared ruleset and sits at the top level, not
   * inside `units`, because that is where the web product reads it.
   */
  async ensure(input: { uid: string; displayName: string; email: string | null }): Promise<UserProfile> {
    const existing = await profileRepository.get(input.uid);
    if (existing) return existing;

    const now = Date.now();
    const units: UnitPreferences = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l' };

    try {
      await setDoc(
        userDoc(input.uid),
        {
          userId: input.uid,
          createdAt: now,
          updatedAt: now,
          displayName: input.displayName,
          email: input.email,
          currency: units.currency,
          units,
          activeBikeId: null,
          onboardingCompletedAt: null,
          notifications: { maintenanceDue: true, documentExpiry: true, permissionRequestedAt: null },
        },
        { merge: true },
      );
    } catch (error) {
      throw toAppError(error);
    }

    return {
      id: input.uid,
      userId: input.uid,
      createdAt: now,
      updatedAt: now,
      displayName: input.displayName,
      email: input.email,
      photoPath: null,
      units,
      activeBikeId: null,
      entitlement: { tier: 'free', source: 'none', expiresAt: null, updatedAt: 0 },
      onboardingCompletedAt: null,
      notifications: { maintenanceDue: true, documentExpiry: true, permissionRequestedAt: null },
    };
  },

  /**
   * A partial update. `userId` and `createdAt` are frozen after creation by the
   * shared ruleset, so they are never sent.
   */
  async update(
    uid: string,
    changes: Partial<Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'entitlement'>>,
  ): Promise<void> {
    const { units, ...rest } = changes;
    try {
      await setDoc(
        userDoc(uid),
        {
          ...rest,
          ...(units ? { units, currency: units.currency } : {}),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    } catch (error) {
      throw toAppError(error);
    }
  },

  setUnits(uid: string, units: UnitPreferences): Promise<void> {
    return profileRepository.update(uid, { units });
  },

  setActiveBike(uid: string, bikeId: string | null): Promise<void> {
    return profileRepository.update(uid, { activeBikeId: bikeId });
  },

  /**
   * Used only by account deletion. The shared ruleset forbids deleting the
   * profile from a client — that goes through the server's deleteMyAccount
   * function — so a denial here is expected and is not treated as a failure.
   */
  async remove(uid: string): Promise<void> {
    try {
      await deleteDoc(userDoc(uid));
    } catch (error) {
      throw toAppError(error);
    }
  },
};

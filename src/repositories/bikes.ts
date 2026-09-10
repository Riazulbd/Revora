import { getDoc, setDoc } from '@react-native-firebase/firestore';

import { toAppError } from '@/services/errors';
import { callBackend } from '@/services/backend';
import type { SubscribeFn } from '@/services/liveQuery';
import type { Bike } from '@/types';
import {
  deleteRecord,
  listCollection,
  newId,
  patchRecord,
  recordDoc,
  subscribeCollection,
  writeRecord,
} from './base';
import { parseBike } from './parsers';
import { serialiseBike } from './serialisers';
import { perBikeRepositories } from './records';
import { metresToKm } from './wire';

/**
 * The garage.
 *
 * Bikes are the owning entity, so — unlike every other collection — they carry
 * no `bikeId`, and reads are scoped by `userId` alone.
 */

export const FREE_PLAN_BIKE_LIMIT = 1;

const LIST_OPTIONS = { orderByField: 'createdAt', direction: 'asc' as const, limit: 50 };

export const bikeRepository = {
  newId: () => newId('bikes'),

  subscribe(uid: string): SubscribeFn<Bike[]> {
    return subscribeCollection<Bike>({
      uid,
      name: 'bikes',
      bikeId: null,
      parse: parseBike,
      options: LIST_OPTIONS,
    });
  },

  list(uid: string): Promise<Bike[]> {
    return listCollection<Bike>({
      uid,
      name: 'bikes',
      bikeId: null,
      parse: parseBike,
      options: LIST_OPTIONS,
    });
  },

  async get(bikeId: string): Promise<Bike | null> {
    try {
      const snapshot = await getDoc(recordDoc('bikes', bikeId));
      const data = snapshot.data();
      return data ? parseBike(snapshot.id, data) : null;
    } catch (error) {
      throw toAppError(error);
    }
  },

  async save(uid: string, bike: Bike, isNew: boolean): Promise<void> {
    if (isNew) {
      await callBackend('createBike', { id: bike.id, bike: serialiseBike(bike) }, uid);
      return;
    }
    await writeRecord({ uid, name: 'bikes', id: bike.id, data: serialiseBike(bike), isNew });
  },

  async patch(uid: string, bikeId: string, changes: Partial<Bike>): Promise<void> {
    const existing = await bikeRepository.get(bikeId);
    if (!existing) throw toAppError({ code: 'firestore/not-found' });
    // The shared ruleset validates the whole bike on update, so a partial change
    // has to be sent as a complete, valid document.
    const merged: Bike = { ...existing, ...changes, id: bikeId };
    try {
      await setDoc(
        recordDoc('bikes', bikeId),
        { ...serialiseBike(merged), updatedAt: Date.now() },
        { merge: true },
      );
    } catch (error) {
      throw toAppError(error);
    }
  },

  /**
   * Keeps the shared `currentOdometer` in step with the reading history.
   *
   * Revora derives the current odometer so that editing an old fuel log corrects
   * it automatically; the web product reads this stored field. Writing it back
   * on every save is what stops the two views of the same motorcycle drifting
   * apart. It only ever moves forward.
   */
  async syncCurrentOdometer(bikeId: string, derivedMetres: number): Promise<void> {
    const existing = await bikeRepository.get(bikeId);
    if (!existing) return;
    if (derivedMetres <= existing.storedOdometerMetres) return;
    await bikeRepository.patch(existing.userId, bikeId, { storedOdometerMetres: derivedMetres });
  },

  /**
   * Re-points the shared `currentOdometer` at the history, in either direction.
   *
   * This is the one place the stored figure is allowed to move backwards, and it
   * exists because a rider who typed 6,000 instead of 5,588 must be able to fix
   * it. `syncCurrentOdometer` above stays forward-only: a correction is a
   * deliberate act on a specific reading, whereas an ordinary save must never be
   * able to drag the odometer down by accident.
   *
   * The caller passes the figure derived from the records *excluding* this
   * stored one — otherwise it would only ever confirm itself.
   */
  async resyncCurrentOdometer(bikeId: string, derivedMetres: number): Promise<void> {
    const existing = await bikeRepository.get(bikeId);
    if (!existing) return;
    const next = Math.max(derivedMetres, existing.initialOdometerMetres);
    if (next === existing.storedOdometerMetres) return;
    await bikeRepository.patch(existing.userId, bikeId, { storedOdometerMetres: next });
  },

  archive(uid: string, bikeId: string): Promise<void> {
    return patchRecord({ name: 'bikes', id: bikeId, changes: { archived: true } });
  },

  /**
   * Removes a motorcycle and every record that belongs to it.
   *
   * Deleting the bike alone would orphan its fuel logs, which would then be
   * invisible to both apps but still stored.
   */
  async remove(uid: string, bikeId: string): Promise<void> {
    for (const repo of perBikeRepositories) {
      await repo.removeAllForBike(uid, bikeId);
    }
    await deleteRecord({ name: 'bikes', id: bikeId });
  },
};

/** Exposed for the odometer sync, which reasons in kilometres. */
export const bikeOdometerKm = (bike: Bike) => metresToKm(bike.storedOdometerMetres);

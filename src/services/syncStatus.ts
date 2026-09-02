import { useEffect, useState } from 'react';

import { flushPendingWrites } from './firebase';
import { log } from './logger';

/**
 * "Saved · Syncing · Waiting for connection".
 *
 * Firestore accepts a write locally and durably the moment it is made, then
 * flushes it when a connection returns. This tracks how many of those writes are
 * still in flight so the rider is told the truth about their data rather than
 * being shown a spinner that means nothing (requirement 37).
 */

export type SyncState = 'idle' | 'pending' | 'synced' | 'failed';

type Listener = (state: SyncState) => void;

let inFlight = 0;
let state: SyncState = 'idle';
const listeners = new Set<Listener>();

function publish(next: SyncState) {
  state = next;
  for (const listener of listeners) listener(next);
}

/**
 * Records that a write has been accepted locally, and resolves the tracker once
 * the server has acknowledged it.
 */
export function trackWrite(): void {
  inFlight += 1;
  publish('pending');

  flushPendingWrites()
    .then(() => {
      inFlight = Math.max(0, inFlight - 1);
      if (inFlight === 0) publish('synced');
    })
    .catch((error) => {
      inFlight = Math.max(0, inFlight - 1);
      log.warn('sync', 'pending writes did not flush', { error: String(error) });
      if (inFlight === 0) publish('failed');
    });
}

export function useSyncState(): SyncState {
  const [value, setValue] = useState<SyncState>(state);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

/** Test seam. */
export function resetSyncState() {
  inFlight = 0;
  publish('idle');
}

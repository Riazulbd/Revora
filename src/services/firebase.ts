import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import {
  CACHE_SIZE_UNLIMITED,
  disableNetwork,
  enableNetwork,
  getFirestore,
  initializeFirestore,
  waitForPendingWrites,
} from '@react-native-firebase/firestore';
import { getStorage } from '@react-native-firebase/storage';

import { log } from './logger';

/**
 * Firebase wiring.
 *
 * The app talks to the same Firebase project as the Revora web product, so an
 * account created on the web signs in here and sees the same garage. Access is
 * enforced entirely by firestore.rules / storage.rules on the server — the
 * client only ever presents its own ID token. No admin credential, service
 * account or server secret exists in this bundle.
 *
 * Configuration comes from google-services.json (Android) and
 * GoogleService-Info.plist (iOS), which the native SDKs read at startup. Those
 * values identify the project; they are not access keys.
 */

let initialised = false;

function ensureInitialised() {
  if (initialised) return;
  initialised = true;
  try {
    // Native Firestore keeps a durable on-disk cache and an ordered write queue.
    // That is what makes "log a fill at the pump with no signal" work: the write
    // is accepted locally, survives an app restart, and flushes on reconnect.
    initializeFirestore(getApp(), {
      persistence: true,
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });
  } catch (error) {
    // initializeFirestore throws if Firestore was already touched. That is fine:
    // persistence is on by default on the native SDKs.
    log.debug('firebase', 'firestore already initialised', { error: String(error) });
  }
}

export function db() {
  ensureInitialised();
  return getFirestore(getApp());
}

export function auth() {
  return getAuth(getApp());
}

export function storage() {
  return getStorage(getApp());
}

/** Resolves once every queued local write has reached the server. */
export function flushPendingWrites(): Promise<void> {
  return waitForPendingWrites(db());
}

/** Used by the offline-behaviour test harness, never by product code paths. */
export const network = {
  goOffline: () => disableNetwork(db()),
  goOnline: () => enableNetwork(db()),
};

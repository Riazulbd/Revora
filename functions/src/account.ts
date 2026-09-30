import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { accountId } from './domain';

/**
 * Account deletion.
 *
 * `firestore.rules` closes `allow delete` on `users/{uid}` and says deletion
 * goes through this function. It has to be a function: a client can delete its
 * own records one at a time, but it cannot delete its own Cloud Storage prefix
 * reliably, cannot reach the server-written collections (`entitlements`,
 * `aiUsage`, the locks) at all, and — once the Firebase identity is gone — has
 * no token left to finish with. Half a deletion is worse than none: it leaves a
 * rider signed out while their records are still on a server.
 *
 * Two properties this is written to hold:
 *
 *   · **Only the caller.** Every read is filtered by `request.auth.uid`, which
 *     the callable protocol derives from a verified ID token. No uid is ever
 *     taken from `request.data`, so there is no argument to tamper with.
 *
 *   · **Idempotent.** Each step is a delete, and deleting what is already gone
 *     is a no-op. The client aborts at 115 seconds while the function may run
 *     for longer, so a retry is the normal case, not the exception — it simply
 *     resumes wherever the previous attempt stopped.
 */

/**
 * Every collection whose documents carry the owner's `userId`.
 *
 * The first block is the rider's own logbook — the collections the repositories
 * in `src/repositories/` read and write. The second is written on the rider's
 * behalf by the server: they never appear in the app, but they are still that
 * rider's data and erasure has to reach them.
 *
 * `feedback` is deleted here even though the ruleset forbids a rider deleting
 * one. That rule stops a rider editing what they said out from under support;
 * it is not a reason to keep their message, contact address and device details
 * after they have asked to be erased.
 */
export const OWNED_COLLECTIONS = [
  'bikes',
  'fuelEntries',
  'fuelAdjustments',
  'odometerEntries',
  'gaugeSamples',
  'maintenanceRules',
  'services',
  'serviceItems',
  'parts',
  'accessories',
  'expenses',
  'reminders',
  'documents',
  'warranties',
  'safetyChecks',
  'captures',
  'feedback',
  'aiRequests',
  'aiReports',
  'aiUsage',
] as const;

/**
 * Collections holding exactly one document per rider, keyed by uid. The profile
 * is not in this list: it is deleted last, on its own, because while it exists
 * the account is still recoverable if a later step fails.
 */
export const UID_KEYED_COLLECTIONS = ['entitlements', 'billingLocks', 'garageLocks'] as const;

/**
 * `purchaseTokens` is deliberately NOT deleted.
 *
 * It is the anti-sharing control: a token records which account claimed it, and
 * `assertOwner` refuses any second claim. Erasing the rows would let the same
 * Google Play purchase be replayed onto a fresh account — the exact property
 * `test:billing` exists to prove impossible. The rows hold no free text the
 * rider wrote; they hold Google's purchase payload and the uid that claimed it.
 * `deletionRequests/{uid}` records that the account behind them is closed.
 */

/** Firestore caps a batch at 500 writes; a page below that leaves headroom. */
const PAGE = 400;

/**
 * The two backends with no local emulator. Tests replace them wholesale, the
 * same way `play` is replaced in the billing suite.
 */
export const accountBackends = {
  /** Erases `users/{uid}/…` — receipts, document scans, bike and safety photos. */
  async eraseStorage(uid: string): Promise<void> {
    let bucket;
    try {
      bucket = getStorage().bucket();
    } catch {
      // Cloud Storage is optional infrastructure: the app keeps photos on the
      // device until a bucket exists. No bucket means nothing to erase.
      logger.info('No Cloud Storage bucket configured; nothing to erase');
      return;
    }
    try {
      await bucket.deleteFiles({ prefix: `users/${uid}/`, force: true });
    } catch (error) {
      if ((error as { code?: number }).code === 404) return;
      // Deliberately fatal. Photos are the rider's data; failing here and
      // letting the retry finish is right, quietly leaving them behind is not.
      throw error;
    }
  },

  /** Deletes the Firebase identity. Already gone counts as done. */
  async eraseIdentity(uid: string): Promise<void> {
    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') return;
      throw error;
    }
  },
};

/** Deletes one page at a time until the query returns nothing. */
async function deleteMatching(
  db: Firestore,
  collection: string,
  uid: string,
): Promise<number> {
  let removed = 0;
  for (;;) {
    const page = await db.collection(collection).where('userId', '==', uid).limit(PAGE).get();
    if (page.empty) return removed;
    const batch = db.batch();
    for (const doc of page.docs) batch.delete(doc.ref);
    await batch.commit();
    removed += page.size;
    if (page.size < PAGE) return removed;
  }
}

/**
 * Erases everything belonging to `uid`, in an order chosen so that an
 * interrupted run is always safe to resume:
 *
 *   records → server-side per-rider documents → Cloud Storage → profile → identity
 *
 * The identity goes last because it is the only step that cannot be retried
 * from the client: once the rider has no account, they cannot sign in to ask
 * again. The profile goes second-to-last for the same reason — while
 * `users/{uid}` exists, support can still see that a deletion was in flight.
 */
export async function eraseAccount(uid: string): Promise<{ deleted: number }> {
  const db = getFirestore();
  let deleted = 0;

  for (const collection of OWNED_COLLECTIONS) {
    deleted += await deleteMatching(db, collection, uid);
  }

  const perRider = db.batch();
  for (const collection of UID_KEYED_COLLECTIONS) perRider.delete(db.doc(`${collection}/${uid}`));
  // The obfuscated-account-id → uid mapping Google Play was given for this
  // rider. Keyed by the hash, not the uid, so it needs naming separately.
  perRider.delete(db.doc(`playAccounts/${accountId(uid)}`));
  await perRider.commit();

  await accountBackends.eraseStorage(uid);

  await db.doc(`users/${uid}`).delete();

  // The retained accounting record the ruleset already reserves. No name, no
  // email, no logbook — only that this uid closed its account and when, which
  // is what a billing or support question about a vanished subscription needs.
  await db.doc(`deletionRequests/${uid}`).set(
    { userId: uid, completedAt: Date.now(), documentsDeleted: deleted },
    { merge: true },
  );

  await accountBackends.eraseIdentity(uid);

  logger.info('Account deleted', { documentsDeleted: deleted });
  return { deleted };
}

/**
 * How recently the rider must have proved who they are.
 *
 * Firebase's client-side `deleteUser` refuses without a recent sign-in, and
 * moving deletion to the server would quietly drop that protection: an ID token
 * is valid for an hour, so a token lifted from a borrowed phone would otherwise
 * be enough to erase somebody's logbook. The client re-authenticates and
 * force-refreshes its token before calling, which resets `auth_time`.
 */
const RECENT_LOGIN_MS = 10 * 60 * 1000;

export const deleteMyAccount = onCall(
  { region: 'us-central1', timeoutSeconds: 540, maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to Revora.');
    const uid = request.auth.uid;

    // An anonymous rider — "Continue offline — no account" — holds no credential
    // to re-authenticate with, so requiring a recent sign-in would lock them out
    // of deleting their own records permanently. Their session IS the account.
    const anonymous = request.auth.token.firebase?.sign_in_provider === 'anonymous';
    const authenticatedAt = Number(request.auth.token.auth_time ?? 0) * 1000;
    if (!anonymous && Date.now() - authenticatedAt > RECENT_LOGIN_MS) {
      throw new HttpsError('failed-precondition', 'For your security, confirm who you are and try again.');
    }

    return eraseAccount(uid);
  },
);

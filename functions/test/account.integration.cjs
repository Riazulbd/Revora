// Run only against the Firestore emulator. Auth and Cloud Storage have no
// emulator here, so `accountBackends` is replaced the same way `play` is in the
// billing suite — what is under test is which documents survive.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required');
// Its own project id, which is a separate namespace inside the one emulator.
// node:test runs each file in its own process and they interleave, so sharing
// `revora-rules-test` would let this suite and the billing suite wipe each
// other's fixtures — a flake that looks like a bug in whichever ran second.
// FIREBASE_CONFIG as well as GCLOUD_PROJECT: `emulators:exec` sets both, and
// `initializeApp()` reads FIREBASE_CONFIG first — setting only GCLOUD_PROJECT
// leaves both suites in one namespace and they wipe each other silently.
process.env.GCLOUD_PROJECT = 'revora-account-test';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'revora-account-test' });
process.env.GOOGLE_PLAY_PACKAGE_NAME = 'app.revora.android.dev';
const functions = require('../lib/index');
const { getFirestore } = require('firebase-admin/firestore');
const { deleteApp, getApp } = require('firebase-admin/app');
const { accountBackends, OWNED_COLLECTIONS, UID_KEYED_COLLECTIONS } = require('../lib/account');
const { accountId, hash } = require('../lib/domain');

const db = getFirestore();
const mine = 'rider-a';
const theirs = 'rider-b';
let erased;

/** A signed-in caller. `auth_time` is seconds, as Firebase issues it. */
const request = (uid = mine, overrides = {}) => ({
  data: {},
  auth: {
    uid,
    token: {
      auth_time: Math.floor(Date.now() / 1000),
      firebase: { sign_in_provider: 'password' },
      ...overrides,
    },
  },
});

const exists = (path) => db.doc(path).get().then((snap) => snap.exists);

async function seed(uid) {
  const batch = db.batch();
  for (const collection of OWNED_COLLECTIONS) {
    // Two rows each, so a collection that is only half-swept is visible.
    batch.set(db.doc(`${collection}/${uid}-1`), { userId: uid, bikeId: 'bike-1', marker: collection });
    batch.set(db.doc(`${collection}/${uid}-2`), { userId: uid, bikeId: 'bike-1', marker: collection });
  }
  for (const collection of UID_KEYED_COLLECTIONS) {
    batch.set(db.doc(`${collection}/${uid}`), { userId: uid });
  }
  batch.set(db.doc(`users/${uid}`), { userId: uid, currency: 'BDT', displayName: 'Rider' });
  batch.set(db.doc(`playAccounts/${accountId(uid)}`), { userId: uid });
  batch.set(db.doc(`purchaseTokens/${hash(`token-${uid}`)}`), { userId: uid, purchaseToken: `token-${uid}` });
  await batch.commit();
}

/** Every path seeded for one rider, so "untouched" can be asserted exhaustively. */
function seededPaths(uid) {
  return [
    ...OWNED_COLLECTIONS.flatMap((c) => [`${c}/${uid}-1`, `${c}/${uid}-2`]),
    ...UID_KEYED_COLLECTIONS.map((c) => `${c}/${uid}`),
    `users/${uid}`,
    `playAccounts/${accountId(uid)}`,
    `purchaseTokens/${hash(`token-${uid}`)}`,
  ];
}

beforeEach(async () => {
  const collections = [...new Set([
    ...OWNED_COLLECTIONS, ...UID_KEYED_COLLECTIONS,
    'users', 'playAccounts', 'purchaseTokens', 'deletionRequests',
  ])];
  for (const collection of collections) await db.recursiveDelete(db.collection(collection));
  erased = { storage: [], identity: [] };
  accountBackends.eraseStorage = async (uid) => { erased.storage.push(uid); };
  accountBackends.eraseIdentity = async (uid) => { erased.identity.push(uid); };
  await seed(mine);
  await seed(theirs);
});
after(async () => { await deleteApp(getApp()); });

test('an unauthenticated call is refused and deletes nothing', async () => {
  await assert.rejects(functions.deleteMyAccount.run({ data: {} }), /Sign in to Revora/);
  await assert.rejects(functions.deleteMyAccount.run({ data: { userId: mine }, auth: null }), /Sign in to Revora/);
  for (const path of [...seededPaths(mine), ...seededPaths(theirs)]) {
    assert.equal(await exists(path), true, `${path} must survive an unauthenticated call`);
  }
  assert.deepEqual(erased, { storage: [], identity: [] });
});

test('deletion reaches only the caller; another rider is untouched', async () => {
  // A uid in the payload is not a uid: only the verified token decides.
  const result = await functions.deleteMyAccount.run({ ...request(mine), data: { userId: theirs } });
  assert.equal(result.deleted, OWNED_COLLECTIONS.length * 2);

  for (const collection of OWNED_COLLECTIONS) {
    const left = await db.collection(collection).where('userId', '==', mine).get();
    assert.equal(left.size, 0, `${collection} still holds the caller's rows`);
  }
  for (const collection of UID_KEYED_COLLECTIONS) {
    assert.equal(await exists(`${collection}/${mine}`), false, collection);
  }
  assert.equal(await exists(`users/${mine}`), false, 'the profile rules refuse to let a client delete');
  assert.equal(await exists(`playAccounts/${accountId(mine)}`), false);
  assert.deepEqual(erased, { storage: [mine], identity: [mine] });

  for (const path of seededPaths(theirs)) {
    assert.equal(await exists(path), true, `${path} belongs to another rider and must survive`);
  }
});

test('the purchase token is retained so the subscription cannot be replayed', async () => {
  await functions.deleteMyAccount.run(request(mine));
  const token = await db.doc(`purchaseTokens/${hash(`token-${mine}`)}`).get();
  assert.equal(token.exists, true, 'erasing the token would let the purchase be claimed again');
  assert.equal(token.data().userId, mine);
  const record = await db.doc(`deletionRequests/${mine}`).get();
  assert.equal(record.exists, true);
  assert.equal(record.data().userId, mine);
  assert.equal(record.data().documentsDeleted, OWNED_COLLECTIONS.length * 2);
  assert.equal(record.data().displayName, undefined, 'the accounting record carries no personal detail');
});

test('a second call is a no-op, not a failure', async () => {
  await functions.deleteMyAccount.run(request(mine));
  const again = await functions.deleteMyAccount.run(request(mine));
  assert.equal(again.deleted, 0);
  assert.deepEqual(erased.identity, [mine, mine], 'an identity already gone still counts as done');
});

test('a stale session must re-confirm, except where there is nothing to confirm with', async () => {
  const stale = { auth_time: Math.floor((Date.now() - 20 * 60 * 1000) / 1000) };
  await assert.rejects(
    functions.deleteMyAccount.run(request(mine, stale)),
    /confirm who you are/,
  );
  assert.equal(await exists(`users/${mine}`), true);

  // An offline rider has no password and no Google account to re-prove with;
  // refusing them would make their records undeletable forever.
  await functions.deleteMyAccount.run(
    request(mine, { ...stale, firebase: { sign_in_provider: 'anonymous' } }),
  );
  assert.equal(await exists(`users/${mine}`), false);
});

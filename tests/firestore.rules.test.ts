import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, Timestamp } from 'firebase/firestore';

/**
 * The isolation matrix, verified against the production ruleset.
 *
 * `firestore.rules` is the live ruleset plus the additive mobile block. These
 * tests pin the two properties no client-side code can enforce for itself:
 * rider A can never reach rider B, and nobody can write their own entitlement
 * (requirement 69 / 77 / 33).
 */

const PROJECT_ID = 'revora-rules-test';
const A = 'rider-a';
const B = 'rider-b';
const now = 1_760_000_000_000;
const stamp = { createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now) };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const uid of [A, B]) {
      await setDoc(doc(db, 'users', uid), { userId: uid, displayName: uid, currency: 'BDT', ...stamp });
      await setDoc(doc(db, 'bikes', `${uid}-bike`), {
        userId: uid,
        nickname: 'Bike',
        manufacturer: 'Honda',
        model: 'Hornet',
        initialOdometer: 0,
        currentOdometer: 0,
        archived: false,
        ...stamp,
      });
      await setDoc(doc(db, 'fuelEntries', `${uid}-fuel`), {
        userId: uid,
        bikeId: `${uid}-bike`,
        date: '2026-08-30',
        odometer: 5180,
        liters: 9,
        tankStatus: 'full',
        missedPreviousFill: false,
        ...stamp,
      });
    }
  });
});

const asA = () => env.authenticatedContext(A).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

describe('a rider reaches only their own records', () => {
  it('reads their own profile, bikes and fuel', async () => {
    const db = asA();
    await assertSucceeds(getDoc(doc(db, 'users', A)));
    await assertSucceeds(getDocs(query(collection(db, 'bikes'), where('userId', '==', A))));
    await assertSucceeds(getDocs(query(collection(db, 'fuelEntries'), where('userId', '==', A))));
  });

  it('writes and deletes a record of their own', async () => {
    const db = asA();
    await assertSucceeds(
      setDoc(doc(db, 'fuelEntries', 'new-fill'), {
        userId: A,
        bikeId: `${A}-bike`,
        date: '2026-09-01',
        odometer: 5200,
        liters: 8,
        tankStatus: 'full',
        missedPreviousFill: false,
        ...stamp,
      }),
    );
    await assertSucceeds(deleteDoc(doc(db, 'fuelEntries', `${A}-fuel`)));
  });
});

describe('rider A can never reach rider B', () => {
  it('cannot read B’s profile, bike or fuel', async () => {
    const db = asA();
    await assertFails(getDoc(doc(db, 'users', B)));
    await assertFails(getDoc(doc(db, 'bikes', `${B}-bike`)));
    await assertFails(getDoc(doc(db, 'fuelEntries', `${B}-fuel`)));
  });

  it('cannot query for B’s records', async () => {
    await assertFails(getDocs(query(collection(asA(), 'fuelEntries'), where('userId', '==', B))));
  });

  it('cannot write into, or delete from, B’s records', async () => {
    const db = asA();
    await assertFails(setDoc(doc(db, 'fuelEntries', `${B}-fuel`), { liters: 999 }, { merge: true }));
    await assertFails(deleteDoc(doc(db, 'fuelEntries', `${B}-fuel`)));
  });

  it('cannot create a record claiming to be B', async () => {
    await assertFails(
      setDoc(doc(asA(), 'fuelEntries', 'spoof'), {
        userId: B,
        bikeId: `${B}-bike`,
        date: '2026-09-01',
        odometer: 1,
        liters: 1,
        tankStatus: 'full',
        missedPreviousFill: false,
        ...stamp,
      }),
    );
  });

  it('cannot hand an existing record to another account', async () => {
    await assertFails(setDoc(doc(asA(), 'fuelEntries', `${A}-fuel`), { userId: B }, { merge: true }));
  });
});

describe('signed-out clients and closed collections', () => {
  it('a signed-out client reaches nothing', async () => {
    await assertFails(getDoc(doc(asAnon(), 'users', A)));
    await assertFails(getDocs(query(collection(asAnon(), 'bikes'), where('userId', '==', A))));
  });

  it('no client can write an entitlement — Pro cannot be self-granted', async () => {
    await assertFails(setDoc(doc(asA(), 'entitlements', A), { tier: 'pro' }));
    await assertSucceeds(getDoc(doc(asA(), 'entitlements', A)));
    await assertFails(getDoc(doc(asA(), 'entitlements', B)));
  });

  it('server-only collections stay dark', async () => {
    for (const name of ['aiCache', 'aiUsage', 'budget', 'purchaseTokens']) {
      await assertFails(getDoc(doc(asA(), name, 'anything')));
    }
  });

  it('an unknown collection is denied by default', async () => {
    await assertFails(setDoc(doc(asA(), 'randomCollection', 'x'), { userId: A }));
  });
});

describe('the additive mobile collections behave like the rest', () => {
  it('accepts an owner’s document and refuses a stranger’s', async () => {
    const db = asA();
    await assertSucceeds(
      setDoc(doc(db, 'documents', 'd1'), {
        userId: A,
        bikeId: `${A}-bike`,
        kind: 'insurance',
        title: 'Insurance — 3rd party',
        keepOfflineCopy: true,
        ...stamp,
      }),
    );
    await assertFails(
      setDoc(doc(db, 'documents', 'd2'), {
        userId: B,
        bikeId: `${B}-bike`,
        kind: 'insurance',
        title: 'Not mine',
        keepOfflineCopy: false,
        ...stamp,
      }),
    );
  });
});

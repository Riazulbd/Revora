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
const asB = () => env.authenticatedContext(B).firestore();
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
    for (const name of ['aiCache', 'aiUsage', 'budget', 'purchaseTokens', 'playAccounts', 'billingLocks', 'playNotifications', 'garageLocks']) {
      await assertFails(getDoc(doc(asA(), name, 'anything')));
      await assertFails(setDoc(doc(asA(), name, 'anything'), { userId: A }));
    }
  });

  it('an unknown collection is denied by default', async () => {
    await assertFails(setDoc(doc(asA(), 'randomCollection', 'x'), { userId: A }));
  });
});

describe('feedback is write-once and private to its author', () => {
  const message = {
    userId: A, kind: 'problem', message: 'The odometer will not save.', contactEmail: 'a@example.com',
    tier: 'free', appVersion: '1.3', platform: 'android', osVersion: '15', deviceModel: 'Pixel 8',
    notifiedAt: null, ...stamp,
  };

  it('accepts a rider’s own message and lets them read it back', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'feedback', 'fb-1'), message));
    await assertSucceeds(getDoc(doc(asA(), 'feedback', 'fb-1')));
  });

  it('refuses to let it be edited or deleted afterwards', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'feedback', 'fb-2'), message));
    await assertFails(setDoc(doc(asA(), 'feedback', 'fb-2'), { message: 'rewritten' }, { merge: true }));
    await assertFails(deleteDoc(doc(asA(), 'feedback', 'fb-2')));
  });

  it('refuses another rider’s message, a forged author and a self-claimed relay', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'feedback', 'fb-3'), message));
    await assertFails(getDoc(doc(asB(), 'feedback', 'fb-3')));
    await assertFails(setDoc(doc(asB(), 'feedback', 'fb-4'), { ...message, userId: A }));
    // notifiedAt is the relay's to set; a client claiming it is refused.
    await assertFails(setDoc(doc(asA(), 'feedback', 'fb-5'), { ...message, notifiedAt: now }));
  });

  it('refuses an empty message, an overlong one and an unknown kind', async () => {
    await assertFails(setDoc(doc(asA(), 'feedback', 'fb-6'), { ...message, message: '' }));
    await assertFails(setDoc(doc(asA(), 'feedback', 'fb-7'), { ...message, message: 'x'.repeat(4001) }));
    await assertFails(setDoc(doc(asA(), 'feedback', 'fb-8'), { ...message, kind: 'rant' }));
  });
});

describe('a motorcycle stored before the archived flag existed', () => {
  // The web product, and Revora before the Free-plan limit, wrote bikes with no
  // `archived` field. Every odometer update patches the bike document, so if the
  // unarchive guard cannot read that field the rider simply cannot save.
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'bikes', `${A}-legacy`), {
        userId: A, nickname: 'Legacy', manufacturer: 'Honda', model: 'Hornet',
        initialOdometer: 0, currentOdometer: 4700, ...stamp,
      });
    });
  });

  it('still accepts an odometer update', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'bikes', `${A}-legacy`), {
      nickname: 'Legacy', manufacturer: 'Honda', model: 'Hornet',
      initialOdometer: 0, currentOdometer: 5588, archived: false, updatedAt: now,
    }, { merge: true }));
  });
});

describe('motorcycle plan enforcement cannot be bypassed by direct writes', () => {
  it('rejects direct bike creation, including when a client claims Pro on its profile', async () => {
    const db = asA();
    await assertSucceeds(setDoc(doc(db, 'users', A), { entitlement: { tier: 'pro' } }, { merge: true }));
    await assertFails(setDoc(doc(db, 'bikes', 'extra-bike'), {
      userId: A, nickname: 'Extra bike', manufacturer: 'Honda', model: 'Hornet',
      initialOdometer: 0, currentOdometer: 0, archived: false, ...stamp,
    }));
  });
  it('permits existing bike edits and archival but cannot reactivate archived extras', async () => {
    const db = asA();
    await assertSucceeds(setDoc(doc(db, 'bikes', `${A}-bike`), { nickname: 'Edited' }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'bikes', `${A}-bike`), { archived: true }, { merge: true }));
    await assertFails(setDoc(doc(db, 'bikes', `${A}-bike`), { archived: false }, { merge: true }));
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

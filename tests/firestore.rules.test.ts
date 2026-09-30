import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, Timestamp } from 'firebase/firestore';

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

/* ------------------------------------------------------------------ *
 * The isolation matrix, collection by collection.
 *
 * The three describes above prove the property for users, bikes and
 * fuelEntries. Everything below extends the same six probes to every other
 * rider-owned collection in the ruleset, so a new collection added without an
 * owner check fails here rather than in a rider's hands.
 * ------------------------------------------------------------------ */

/** Wire shapes — exactly the fields firestore.rules validates. */
const OWNED: Record<string, Record<string, unknown>> = {
  fuelAdjustments: { bikeId: 'bike', date: '2026-09-01', liters: -1, reason: 'leak', approximate: false },
  odometerEntries: { bikeId: 'bike', date: '2026-09-01', odometer: 5200, source: 'manual' },
  gaugeSamples: { bikeId: 'bike', bars: 3, totalBars: 6, litersToFill: 6, filledToFull: true },
  services: { bikeId: 'bike', title: 'Oil change', date: '2026-09-01', odometer: 5200 },
  serviceItems: { bikeId: 'bike', serviceId: 'svc', name: 'Engine oil', quantity: 1 },
  maintenanceRules: {
    bikeId: 'bike', name: 'Oil', intervalType: 'distance',
    warnAheadKm: 300, warnAheadDays: 14, enabled: true,
  },
  parts: { bikeId: 'bike', name: 'Brake pads' },
  accessories: { bikeId: 'bike', name: 'Tail box' },
  expenses: { bikeId: 'bike', title: 'Parking', date: '2026-09-01', amount: 60, category: 'parking' },
  reminders: { bikeId: 'bike', title: 'Insurance due', dueAt: '2026-10-01' },
  documents: { bikeId: 'bike', title: 'Insurance', kind: 'insurance', keepOfflineCopy: false },
  warranties: { bikeId: 'bike', title: 'Battery', claimStatus: 'none' },
  safetyChecks: { bikeId: 'bike', summary: 'Tread low', area: 'tyres', status: 'watch', date: '2026-09-01' },
  captures: { bikeId: 'bike', label: 'Receipt', kind: 'receipt', status: 'queued' },
};

/** `OWNED[name]` under noUncheckedIndexedAccess; every name here exists. */
const owned = (name: keyof typeof OWNED): Record<string, unknown> => OWNED[name] as Record<string, unknown>;

const seedAsServer = async (name: string, id: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), name, id), data);
  });

describe('every other rider-owned collection isolates A from B', () => {
  for (const [name, fixture] of Object.entries(OWNED)) {
    it(`${name}: A owns its own row and cannot touch B’s`, async () => {
      await seedAsServer(name, 'owned-by-b', { ...fixture, userId: B, ...stamp });
      const db = asA();

      // Control: the fixture is valid, so every denial below is an ownership
      // decision and not a validation failure wearing its coat.
      await assertSucceeds(setDoc(doc(db, name, 'owned-by-a'), { ...fixture, userId: A, ...stamp }));
      await assertSucceeds(getDoc(doc(db, name, 'owned-by-a')));

      await assertFails(getDoc(doc(db, name, 'owned-by-b')));
      await assertFails(getDocs(query(collection(db, name), where('userId', '==', B))));
      await assertFails(getDocs(query(collection(db, name))));
      await assertFails(setDoc(doc(db, name, 'owned-by-b'), { ...fixture, userId: B, ...stamp }));
      await assertFails(deleteDoc(doc(db, name, 'owned-by-b')));
      await assertFails(setDoc(doc(db, name, 'spoofed'), { ...fixture, userId: B, ...stamp }));
      await assertFails(setDoc(doc(db, name, 'owned-by-a'), { userId: B }, { merge: true }));
      await assertFails(
        setDoc(doc(db, name, 'owned-by-a'), { createdAt: Timestamp.fromMillis(0) }, { merge: true }),
      );
    });
  }

  it('a signed-out client reaches none of them', async () => {
    for (const [name, fixture] of Object.entries(OWNED)) {
      await seedAsServer(name, 'owned-by-b', { ...fixture, userId: B, ...stamp });
      await assertFails(getDoc(doc(asAnon(), name, 'owned-by-b')));
      await assertFails(setDoc(doc(asAnon(), name, 'anon-write'), { ...fixture, userId: B, ...stamp }));
    }
  });
});

describe('the AI audit trail is readable by its owner and forgeable by nobody', () => {
  const request = { userId: A, bikeId: `${A}-bike`, prompt: 'Why is my mileage down?', ...stamp };

  it('aiRequests: A reads its own, cannot read B’s, cannot write any', async () => {
    await seedAsServer('aiRequests', 'req-a', request);
    await seedAsServer('aiRequests', 'req-b', { ...request, userId: B });
    const db = asA();
    await assertSucceeds(getDoc(doc(db, 'aiRequests', 'req-a')));
    await assertFails(getDoc(doc(db, 'aiRequests', 'req-b')));
    await assertFails(setDoc(doc(db, 'aiRequests', 'forged'), request));
    await assertFails(setDoc(doc(db, 'aiRequests', 'req-a'), { prompt: 'edited' }, { merge: true }));
    await assertFails(deleteDoc(doc(db, 'aiRequests', 'req-a')));
  });

  it('aiReports: filed once, by its author, always open', async () => {
    const report = { userId: A, aiRequestId: 'req-a', reason: 'incorrect', status: 'open', ...stamp };
    const db = asA();
    await assertSucceeds(setDoc(doc(db, 'aiReports', 'rep-1'), report));
    await assertSucceeds(getDoc(doc(db, 'aiReports', 'rep-1')));
    await assertFails(setDoc(doc(db, 'aiReports', 'rep-1'), { reason: 'other' }, { merge: true }));
    await assertFails(deleteDoc(doc(db, 'aiReports', 'rep-1')));
    await assertFails(setDoc(doc(db, 'aiReports', 'rep-2'), { ...report, userId: B }));
    await assertFails(getDoc(doc(asB(), 'aiReports', 'rep-1')));
    // A rider cannot file a report that is already resolved, nor invent a reason.
    await assertFails(setDoc(doc(db, 'aiReports', 'rep-3'), { ...report, status: 'closed' }));
    await assertFails(setDoc(doc(db, 'aiReports', 'rep-4'), { ...report, reason: 'boring' }));
  });
});

describe('shared reference data is readable, never writable', () => {
  it('bikeModels and fuelGaugeProfiles cannot be edited by a rider', async () => {
    for (const name of ['bikeModels', 'fuelGaugeProfiles']) {
      await seedAsServer(name, 'row', { manufacturer: 'Honda', model: 'Hornet' });
      await assertSucceeds(getDoc(doc(asA(), name, 'row')));
      await assertFails(setDoc(doc(asA(), name, 'row'), { model: 'Rewritten' }, { merge: true }));
      await assertFails(setDoc(doc(asA(), name, 'new-row'), { model: 'Invented' }));
      await assertFails(deleteDoc(doc(asA(), name, 'row')));
      await assertFails(getDoc(doc(asAnon(), name, 'row')));
    }
  });

  it('deletionRequests stays dark like the other server-only collections', async () => {
    await seedAsServer('deletionRequests', 'req', { userId: A, ...stamp });
    await assertFails(getDoc(doc(asA(), 'deletionRequests', 'req')));
    await assertFails(setDoc(doc(asA(), 'deletionRequests', 'mine'), { userId: A }));
    await assertFails(deleteDoc(doc(asA(), 'deletionRequests', 'req')));
  });
});

describe('the entitlement document is closed to every client write path', () => {
  const served = { tier: 'free', source: 'none', expiresAt: null, updatedAt: now };

  beforeEach(async () => {
    await seedAsServer('entitlements', A, served);
    await seedAsServer('entitlements', B, served);
  });

  it('cannot be created, updated, merged or deleted — own or anybody else’s', async () => {
    const db = asA();
    await assertFails(setDoc(doc(db, 'entitlements', 'fresh-uid'), { tier: 'pro' }));
    await assertFails(setDoc(doc(db, 'entitlements', A), { tier: 'pro', source: 'grant', expiresAt: null }));
    await assertFails(setDoc(doc(db, 'entitlements', A), { tier: 'pro' }, { merge: true }));
    await assertFails(updateDoc(doc(db, 'entitlements', A), { tier: 'pro' }));
    await assertFails(updateDoc(doc(db, 'entitlements', A), { expiresAt: now + 31_536_000_000 }));
    await assertFails(deleteDoc(doc(db, 'entitlements', A)));
    await assertFails(setDoc(doc(db, 'entitlements', B), { tier: 'pro' }, { merge: true }));
    await assertFails(deleteDoc(doc(db, 'entitlements', B)));
    await assertFails(setDoc(doc(asAnon(), 'entitlements', A), { tier: 'pro' }));
  });

  it('survives every refused write byte for byte', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const snapshot = await getDoc(doc(context.firestore(), 'entitlements', A));
      expect(snapshot.data()).toEqual(served);
    });
  });

  it('cannot be read by another rider, nor listed', async () => {
    await assertSucceeds(getDoc(doc(asA(), 'entitlements', A)));
    await assertFails(getDoc(doc(asA(), 'entitlements', B)));
    await assertFails(getDocs(query(collection(asA(), 'entitlements'))));
  });
});

describe('userId and createdAt are set once, on every collection that has them', () => {
  it('a bike cannot be handed over, back-dated, created directly or un-archived', async () => {
    const db = asA();
    const bike = {
      nickname: 'Bike', manufacturer: 'Honda', model: 'Hornet',
      initialOdometer: 0, currentOdometer: 0, archived: false,
    };
    await assertFails(setDoc(doc(db, 'bikes', 'brand-new'), { ...bike, userId: A, ...stamp }));
    await assertFails(setDoc(doc(db, 'bikes', `${A}-bike`), { userId: B }, { merge: true }));
    await assertFails(
      setDoc(doc(db, 'bikes', `${A}-bike`), { createdAt: Timestamp.fromMillis(0) }, { merge: true }),
    );
    await assertSucceeds(setDoc(doc(db, 'bikes', `${A}-bike`), { archived: true }, { merge: true }));
    await assertFails(setDoc(doc(db, 'bikes', `${A}-bike`), { archived: false }, { merge: true }));
    // Archiving again is idempotent; only the return journey is closed.
    await assertSucceeds(setDoc(doc(db, 'bikes', `${A}-bike`), { archived: true }, { merge: true }));
  });

  it('a profile cannot be re-owned, back-dated or deleted', async () => {
    const db = asA();
    await assertSucceeds(setDoc(doc(db, 'users', A), { displayName: 'Riaz' }, { merge: true }));
    await assertFails(setDoc(doc(db, 'users', A), { userId: B }, { merge: true }));
    await assertFails(setDoc(doc(db, 'users', A), { createdAt: Timestamp.fromMillis(0) }, { merge: true }));
    await assertFails(deleteDoc(doc(db, 'users', A)));
    await assertFails(setDoc(doc(db, 'users', B), { displayName: 'Not mine' }, { merge: true }));
    await assertFails(setDoc(doc(db, 'users', 'someone-new'), { userId: A, currency: 'BDT', ...stamp }));
  });
});

describe('every enum field is pinned to its vocabulary', () => {
  const cases: [string, Record<string, unknown>, string, string][] = [
    ['fuelEntries', {
      bikeId: 'bike', date: '2026-09-01', odometer: 5200, liters: 8,
      tankStatus: 'full', missedPreviousFill: false,
    }, 'tankStatus', 'brimmed'],
    ['fuelAdjustments', owned('fuelAdjustments'), 'reason', 'borrowed'],
    ['odometerEntries', owned('odometerEntries'), 'source', 'guess'],
    ['serviceItems', owned('serviceItems'), 'unit', 'gallon'],
    ['maintenanceRules', owned('maintenanceRules'), 'intervalType', 'mileage'],
    ['expenses', owned('expenses'), 'category', 'toll'],
    ['reminders', owned('reminders'), 'kind', 'promo'],
    ['documents', owned('documents'), 'kind', 'passport'],
    ['warranties', owned('warranties'), 'claimStatus', 'pending'],
    ['safetyChecks', owned('safetyChecks'), 'area', 'suspension'],
    ['safetyChecks', owned('safetyChecks'), 'status', 'broken'],
    ['captures', owned('captures'), 'kind', 'video'],
    ['captures', owned('captures'), 'status', 'failed'],
  ];

  for (const [name, fixture, field, bad] of cases) {
    it(`${name}.${field} refuses “${bad}”, on create and on update`, async () => {
      const db = asA();
      const id = `${name}-${field}`;
      await assertSucceeds(setDoc(doc(db, name, id), { ...fixture, userId: A, ...stamp }));
      await assertFails(setDoc(doc(db, name, `${id}-bad`), { ...fixture, userId: A, [field]: bad, ...stamp }));
      await assertFails(setDoc(doc(db, name, id), { [field]: bad }, { merge: true }));
    });
  }
});

describe('free text is capped so no document becomes bulk storage', () => {
  const long = 'x'.repeat(4100);

  it('a rider cannot grow their own profile without limit', async () => {
    const db = asA();
    await assertFails(setDoc(doc(db, 'users', A), { displayName: long }, { merge: true }));
    await assertFails(setDoc(doc(db, 'users', A), { email: long }, { merge: true }));
    await assertFails(setDoc(doc(db, 'users', A), { currency: long }, { merge: true }));
  });

  it('a bike photo path and a clientRef are capped', async () => {
    const db = asA();
    await assertFails(setDoc(doc(db, 'bikes', `${A}-bike`), { photoPath: long }, { merge: true }));
    await assertFails(setDoc(doc(db, 'fuelEntries', `${A}-fuel`), { clientRef: long }, { merge: true }));
  });

  it('the collections that were unvalidated on update now cap their text too', async () => {
    const db = asA();
    for (const [name, field] of [
      ['parts', 'fittedBy'],
      ['accessories', 'photoPath'],
      ['reminders', 'href'],
      ['captures', 'completedRecordType'],
      ['documents', 'notes'],
      ['warranties', 'coverage'],
      ['safetyChecks', 'note'],
      ['services', 'performedBy'],
      ['expenses', 'notes'],
      ['maintenanceRules', 'notes'],
      ['serviceItems', 'brand'],
    ] as const) {
      const id = `cap-${name}-${field}`;
      await assertSucceeds(setDoc(doc(db, name, id), { ...owned(name), userId: A, ...stamp }));
      await assertFails(setDoc(doc(db, name, id), { [field]: long }, { merge: true }));
    }
  });
});

describe('an edit cannot smuggle past the validation a create had to pass', () => {
  it('parts, accessories, gaugeSamples and reminders are validated on update', async () => {
    const db = asA();
    for (const name of ['parts', 'accessories', 'gaugeSamples', 'reminders'] as const) {
      await assertSucceeds(setDoc(doc(db, name, `edit-${name}`), { ...owned(name), userId: A, ...stamp }));
    }
    await assertFails(setDoc(doc(db, 'parts', 'edit-parts'), { name: '' }, { merge: true }));
    await assertFails(setDoc(doc(db, 'parts', 'edit-parts'), { cost: -1 }, { merge: true }));
    await assertFails(setDoc(doc(db, 'accessories', 'edit-accessories'), { name: '' }, { merge: true }));
    await assertFails(
      setDoc(doc(db, 'accessories', 'edit-accessories'), { installationCost: -5 }, { merge: true }),
    );
    await assertFails(setDoc(doc(db, 'gaugeSamples', 'edit-gaugeSamples'), { bars: -1 }, { merge: true }));
    await assertFails(
      setDoc(doc(db, 'gaugeSamples', 'edit-gaugeSamples'), { totalBars: 1 }, { merge: true }),
    );
    await assertFails(setDoc(doc(db, 'reminders', 'edit-reminders'), { title: '' }, { merge: true }));
  });

  it('numbers that would corrupt a derived figure are refused everywhere', async () => {
    const db = asA();
    const fuel = {
      userId: A, bikeId: `${A}-bike`, date: '2026-09-01', odometer: 5200,
      liters: 8, tankStatus: 'full', missedPreviousFill: false, ...stamp,
    };
    await assertFails(setDoc(doc(db, 'fuelEntries', 'zero-fill'), { ...fuel, liters: 0 }));
    await assertFails(setDoc(doc(db, 'fuelEntries', 'back-odo'), { ...fuel, odometer: -1 }));
    await assertFails(
      setDoc(doc(db, 'fuelAdjustments', 'zero-adj'), { ...owned('fuelAdjustments'), userId: A, liters: 0, ...stamp }),
    );
    await assertFails(
      setDoc(doc(db, 'expenses', 'negative'), { ...owned('expenses'), userId: A, amount: -1, ...stamp }),
    );
    await assertFails(
      setDoc(doc(db, 'serviceItems', 'zero-qty'), { ...owned('serviceItems'), userId: A, quantity: 0, ...stamp }),
    );
  });
});

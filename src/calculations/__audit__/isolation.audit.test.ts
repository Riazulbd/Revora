/**
 * QA audit — cross-account isolation matrix for EVERY client-reachable
 * collection in firestore.rules, against the Firestore emulator.
 *
 * The shipped suite (tests/firestore.rules.test.ts) proves isolation for users,
 * bikes, fuelEntries, feedback, entitlements and documents(create). This file
 * runs the same eight probes across all the other rider-owned collections.
 *
 * Each collection first proves its fixture is VALID by creating it as rider A —
 * otherwise a "cannot create as B" denial could be a validation failure in
 * disguise rather than an ownership check.
 *
 * Needs the emulator. Run with:
 *   export JAVA_HOME=/opt/homebrew/opt/openjdk@21; export PATH="$JAVA_HOME/bin:$PATH"
 *   firebase emulators:exec --only firestore --project revora-rules-test \
 *     "npx jest --config jest.rules.config.js --testMatch '**\/__audit__/isolation.audit.test.ts'"
 * Under the default jest-expo project (npm test) it is skipped, never failed.
 */
const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const maybe = EMULATOR ? describe : describe.skip;

const A = 'rider-a';
const B = 'rider-b';
const NOW = 1_789_430_400_000; // 2026-09-16T00:00:00Z

// Wire-shape fixtures: exactly the fields firestore.rules validates for each
// collection (rules operate on the stored shape, not the app's typed shape).
// Every fixture omits userId/createdAt/updatedAt; the harness adds them.
const FIXTURES: Record<string, Record<string, unknown>> = {
  fuelEntries: { bikeId: 'bike', date: '2026-09-01', odometer: 5200, liters: 8, tankStatus: 'full', missedPreviousFill: false },
  fuelAdjustments: { bikeId: 'bike', date: '2026-09-01', liters: -1, reason: 'leak', approximate: false },
  odometerEntries: { bikeId: 'bike', date: '2026-09-01', odometer: 5200, source: 'manual' },
  gaugeSamples: { bikeId: 'bike', bars: 3, totalBars: 6, litersToFill: 6, filledToFull: true },
  services: { bikeId: 'bike', title: 'Oil change', date: '2026-09-01', odometer: 5200 },
  serviceItems: { bikeId: 'bike', serviceId: 'svc', name: 'Engine oil', quantity: 1 },
  maintenanceRules: { bikeId: 'bike', name: 'Oil', intervalType: 'distance', warnAheadKm: 300, warnAheadDays: 14, enabled: true },
  parts: { bikeId: 'bike', name: 'Brake pads' },
  accessories: { bikeId: 'bike', name: 'Tail box' },
  expenses: { bikeId: 'bike', title: 'Parking', date: '2026-09-01', amount: 60, category: 'parking' },
  reminders: { bikeId: 'bike', title: 'Insurance', dueAt: '2026-10-01' },
  documents: { bikeId: 'bike', title: 'Insurance', kind: 'insurance', keepOfflineCopy: false },
  warranties: { bikeId: 'bike', title: 'Battery', claimStatus: 'none' },
  safetyChecks: { bikeId: 'bike', summary: 'ok', area: 'tyres', status: 'ok', date: '2026-09-01' },
  captures: { bikeId: 'bike', label: 'Receipt', kind: 'receipt', status: 'queued' },
};

maybe('ISO cross-account matrix — every rider-owned collection', () => {
  let env: any;
  let fs: any;

  beforeAll(async () => {
    const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
    fs = require('firebase/firestore');
    env = await initializeTestEnvironment({
      projectId: 'revora-rules-test',
      firestore: {
        rules: require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', '..', 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => { await env.clearFirestore(); });

  const asA = () => env.authenticatedContext(A).firestore();
  const asB = () => env.authenticatedContext(B).firestore();
  const stamp = () => ({ createdAt: fs.Timestamp.fromMillis(NOW), updatedAt: fs.Timestamp.fromMillis(NOW) });
  const seedAsServer = async (name: string, id: string, data: Record<string, unknown>) => {
    await env.withSecurityRulesDisabled(async (ctx: any) => {
      await fs.setDoc(fs.doc(ctx.firestore(), name, id), data);
    });
  };

  for (const [name, fixture] of Object.entries(FIXTURES)) {
    describe(name, () => {
      const bDoc = `${name}-of-b`;
      beforeEach(async () => {
        await seedAsServer(name, bDoc, { ...fixture, userId: B, ...stamp() });
      });

      test('control: fixture is valid — A creates its own copy', async () => {
        const { assertSucceeds } = require('@firebase/rules-unit-testing');
        await assertSucceeds(fs.setDoc(fs.doc(asA(), name, `${name}-of-a`), { ...fixture, userId: A, ...stamp() }));
      });

      test('A cannot read B’s document', async () => {
        const { assertFails } = require('@firebase/rules-unit-testing');
        await assertFails(fs.getDoc(fs.doc(asA(), name, bDoc)));
      });

      test('A cannot query for B’s documents, nor list the collection unfiltered', async () => {
        const { assertFails } = require('@firebase/rules-unit-testing');
        await assertFails(fs.getDocs(fs.query(fs.collection(asA(), name), fs.where('userId', '==', B))));
        await assertFails(fs.getDocs(fs.collection(asA(), name)));
      });

      test('A cannot update B’s document', async () => {
        const { assertFails } = require('@firebase/rules-unit-testing');
        await assertFails(fs.setDoc(fs.doc(asA(), name, bDoc), { bikeId: 'hijacked', updatedAt: fs.Timestamp.fromMillis(NOW + 1) }, { merge: true }));
      });

      test('A cannot delete B’s document', async () => {
        const { assertFails } = require('@firebase/rules-unit-testing');
        await assertFails(fs.deleteDoc(fs.doc(asA(), name, bDoc)));
      });

      test('A cannot create a document claiming userId B', async () => {
        const { assertFails } = require('@firebase/rules-unit-testing');
        await assertFails(fs.setDoc(fs.doc(asA(), name, `${name}-spoof`), { ...fixture, userId: B, ...stamp() }));
      });

      test('A cannot hand its own document to B', async () => {
        const { assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
        await assertSucceeds(fs.setDoc(fs.doc(asA(), name, `${name}-mine`), { ...fixture, userId: A, ...stamp() }));
        await assertFails(fs.setDoc(fs.doc(asA(), name, `${name}-mine`), { userId: B }, { merge: true }));
      });

      test('B, the owner, can read and update the same document (rules are not simply closed)', async () => {
        const { assertSucceeds } = require('@firebase/rules-unit-testing');
        await assertSucceeds(fs.getDoc(fs.doc(asB(), name, bDoc)));
        await assertSucceeds(fs.setDoc(fs.doc(asB(), name, bDoc), { updatedAt: fs.Timestamp.fromMillis(NOW + 1) }, { merge: true }));
      });
    });
  }
});

maybe('ISO users, bikes, entitlements, aiRequests, aiReports, reference data', () => {
  let env: any;
  let fs: any;
  let rut: any;

  beforeAll(async () => {
    rut = require('@firebase/rules-unit-testing');
    fs = require('firebase/firestore');
    env = await rut.initializeTestEnvironment({
      projectId: 'revora-rules-test',
      firestore: {
        rules: require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', '..', 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  const asA = () => env.authenticatedContext(A).firestore();
  const stamp = () => ({ createdAt: fs.Timestamp.fromMillis(NOW), updatedAt: fs.Timestamp.fromMillis(NOW) });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx: any) => {
      const db = ctx.firestore();
      for (const uid of [A, B]) {
        await fs.setDoc(fs.doc(db, 'users', uid), { userId: uid, displayName: uid, currency: 'BDT', ...stamp() });
        await fs.setDoc(fs.doc(db, 'bikes', `${uid}-bike`), {
          userId: uid, nickname: 'Bike', manufacturer: 'Honda', model: 'Hornet',
          initialOdometer: 0, currentOdometer: 0, archived: false, ...stamp(),
        });
        await fs.setDoc(fs.doc(db, 'aiRequests', `${uid}-req`), { userId: uid, prompt: 'x', ...stamp() });
      }
      // A server-written Pro entitlement for B, and a Free one for A.
      await fs.setDoc(fs.doc(db, 'entitlements', B), { tier: 'pro', source: 'google_play', subscriptionStatus: 'SUBSCRIPTION_STATE_ACTIVE', expiresAt: NOW + 86_400_000, updatedAt: NOW });
      await fs.setDoc(fs.doc(db, 'entitlements', A), { tier: 'free', source: 'none', expiresAt: null, updatedAt: NOW });
      await fs.setDoc(fs.doc(db, 'bikeModels', 'honda-hornet'), { manufacturer: 'Honda', model: 'Hornet', tankLitres: 12 });
    });
  });

  test('ISO-U1 users: A cannot update, delete or create B’s profile; A cannot delete its own', async () => {
    const db = asA();
    await rut.assertFails(fs.setDoc(fs.doc(db, 'users', B), { displayName: 'pwned' }, { merge: true }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'users', B)));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'users', 'rider-c'), { userId: 'rider-c', currency: 'BDT', ...stamp() }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'users', A)));
    await rut.assertSucceeds(fs.setDoc(fs.doc(db, 'users', A), { displayName: 'me' }, { merge: true }));
  });

  test('ISO-B1 bikes: A cannot update or delete B’s bike, or list bikes unfiltered', async () => {
    const db = asA();
    await rut.assertFails(fs.setDoc(fs.doc(db, 'bikes', `${B}-bike`), { nickname: 'stolen' }, { merge: true }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'bikes', `${B}-bike`)));
    await rut.assertFails(fs.getDocs(fs.collection(db, 'bikes')));
    await rut.assertFails(fs.getDocs(fs.query(fs.collection(db, 'bikes'), fs.where('userId', '==', B))));
  });

  test('ISO-E1 entitlements: A cannot update its own Free doc to Pro, delete it, or write B’s', async () => {
    const db = asA();
    // Merge-update onto an existing server-written document (the realistic attack).
    await rut.assertFails(fs.setDoc(fs.doc(db, 'entitlements', A), { tier: 'pro' }, { merge: true }));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'entitlements', A), { tier: 'pro', source: 'grant', expiresAt: null, updatedAt: NOW }));
    await rut.assertFails(fs.updateDoc(fs.doc(db, 'entitlements', A), { tier: 'pro' }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'entitlements', A)));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'entitlements', B), { tier: 'free' }, { merge: true }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'entitlements', B)));
    await rut.assertFails(fs.getDoc(fs.doc(db, 'entitlements', B)));
    await rut.assertFails(fs.getDocs(fs.collection(db, 'entitlements')));
    // The document survived every attempt with its server content intact.
    await env.withSecurityRulesDisabled(async (ctx: any) => {
      const snap = await fs.getDoc(fs.doc(ctx.firestore(), 'entitlements', A));
      expect(snap.data()).toEqual({ tier: 'free', source: 'none', expiresAt: null, updatedAt: NOW });
    });
  });

  test('ISO-E2 a Pro claim written onto users/{uid}.entitlement is accepted by rules but is NOT the entitlement doc', async () => {
    // Rules let a rider put arbitrary extra fields on their own profile. The
    // client must therefore never read Pro from users/{uid}; GarageProvider reads
    // entitlements/{uid} (verified by code inspection). This pins that the
    // profile write does not touch entitlements/{uid}.
    const db = asA();
    await rut.assertSucceeds(fs.setDoc(fs.doc(db, 'users', A), { entitlement: { tier: 'pro' } }, { merge: true }));
    await env.withSecurityRulesDisabled(async (ctx: any) => {
      const snap = await fs.getDoc(fs.doc(ctx.firestore(), 'entitlements', A));
      expect(snap.data()?.tier).toBe('free');
    });
  });

  test('ISO-AI1 aiRequests: A reads own, cannot read B’s, cannot create/update/delete any', async () => {
    const db = asA();
    await rut.assertSucceeds(fs.getDoc(fs.doc(db, 'aiRequests', `${A}-req`)));
    await rut.assertFails(fs.getDoc(fs.doc(db, 'aiRequests', `${B}-req`)));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'aiRequests', 'forged'), { userId: A, prompt: 'x', ...stamp() }));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'aiRequests', `${A}-req`), { prompt: 'edited' }, { merge: true }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'aiRequests', `${A}-req`)));
  });

  test('ISO-AI2 aiReports: A files own, cannot file as B, cannot read B’s, cannot edit/delete', async () => {
    const db = asA();
    const report = { userId: A, aiRequestId: `${A}-req`, reason: 'incorrect', status: 'open' };
    await rut.assertSucceeds(fs.setDoc(fs.doc(db, 'aiReports', 'r1'), report));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'aiReports', 'r2'), { ...report, userId: B }));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'aiReports', 'r3'), { ...report, status: 'resolved' }));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'aiReports', 'r1'), { status: 'resolved' }, { merge: true }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'aiReports', 'r1')));
    await env.withSecurityRulesDisabled(async (ctx: any) => {
      await fs.setDoc(fs.doc(ctx.firestore(), 'aiReports', 'rb'), { ...report, userId: B });
    });
    await rut.assertFails(fs.getDoc(fs.doc(db, 'aiReports', 'rb')));
  });

  test('ISO-R1 reference data: readable signed-in, never writable; unreadable signed-out', async () => {
    const db = asA();
    await rut.assertSucceeds(fs.getDoc(fs.doc(db, 'bikeModels', 'honda-hornet')));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'bikeModels', 'honda-hornet'), { tankLitres: 999 }, { merge: true }));
    await rut.assertFails(fs.deleteDoc(fs.doc(db, 'bikeModels', 'honda-hornet')));
    await rut.assertFails(fs.setDoc(fs.doc(db, 'fuelGaugeProfiles', 'x'), { bars: 6 }));
    await rut.assertFails(fs.getDoc(fs.doc(env.unauthenticatedContext().firestore(), 'bikeModels', 'honda-hornet')));
  });

  test('ISO-S1 signed-out client cannot touch any rider collection', async () => {
    const anon = env.unauthenticatedContext().firestore();
    for (const name of Object.keys(FIXTURES)) {
      await rut.assertFails(fs.getDocs(fs.query(fs.collection(anon, name), fs.where('userId', '==', A))));
      await rut.assertFails(fs.setDoc(fs.doc(anon, name, 'anon'), { ...FIXTURES[name], userId: A, ...stamp() }));
    }
    await rut.assertFails(fs.getDoc(fs.doc(anon, 'entitlements', A)));
  });
});

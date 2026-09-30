/**
 * QA audit — firestore.rules for `captures` (Fast Capture queue) and the
 * app's actual `feedback` write shape (serverTimestamp()).
 *
 * Runs only under the Firestore emulator:
 *
 *   export JAVA_HOME=/opt/homebrew/opt/openjdk@21; export PATH="$JAVA_HOME/bin:$PATH"
 *   npx firebase emulators:exec --only firestore --project revora-rules-test \
 *     "npx jest --config jest.rules.config.js --testMatch '<rootDir>/src/calculations/__audit__/captures.rules.audit.test.ts'"
 *
 * Under the ordinary `npm test` run there is no emulator, so the suite skips
 * itself rather than failing the calculation suite.
 */

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

// A describe.skip body still executes, and the web Firebase SDK cannot be
// parsed by the jest-expo transform — so the whole block is gated by an `if`.
if (!EMULATOR) {
  describe.skip('captures + feedback rules (emulator)', () => {
    it('needs FIRESTORE_EMULATOR_HOST — see the header for the command', () => undefined);
  });
}

if (EMULATOR) describe('captures + feedback rules (emulator)', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const rut = require('@firebase/rules-unit-testing') as typeof import('@firebase/rules-unit-testing');
  const fsdk = require('firebase/firestore') as typeof import('firebase/firestore');
  const { assertFails, assertSucceeds, initializeTestEnvironment } = rut;
  const { deleteDoc, doc, getDoc, setDoc, serverTimestamp, Timestamp } = fsdk;

  const A = 'rider-a';
  const B = 'rider-b';
  const now = 1_760_000_000_000;
  const stamp = { createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now) };

  // Exactly what captureRepository.save() sends for a new queued note
  // (see OFF-14): serialiser fields + userId/createdAt/updatedAt, merge:true.
  const queuedNote = {
    userId: A,
    bikeId: 'bike-1',
    kind: 'note',
    status: 'queued',
    label: 'Front brake spongy',
    detail: 'Note',
    photoPath: null,
    completedRecordId: null,
    completedRecordType: null,
    ...stamp,
  };

  let env: import('@firebase/rules-unit-testing').RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'revora-rules-test',
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, '..', '..', '..', 'firestore.rules'), 'utf8'),
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
  });

  const asA = () => env.authenticatedContext(A).firestore();
  const asB = () => env.authenticatedContext(B).firestore();
  const asAnon = () => env.unauthenticatedContext().firestore();

  it('CAP-R1 owner creates a queued capture with the app payload, and reads it back', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'cap-1'), queuedNote, { merge: true }));
    await assertSucceeds(getDoc(doc(asA(), 'captures', 'cap-1')));
  });

  it('CAP-R2 owner completes it with exactly the patch useCompleteCapture would send (merge, no userId/createdAt)', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'cap-2'), queuedNote, { merge: true }));
    await assertSucceeds(
      setDoc(
        doc(asA(), 'captures', 'cap-2'),
        {
          status: 'completed',
          completedRecordId: 'fuel-9',
          completedRecordType: 'fuel',
          detail: 'Fuel · 7.5 L',
          updatedAt: Timestamp.fromMillis(now + 1),
        },
        { merge: true },
      ),
    );
    const after = await getDoc(doc(asA(), 'captures', 'cap-2'));
    expect(after.data()?.status).toBe('completed');
    expect(after.data()?.completedRecordId).toBe('fuel-9');
  });

  it('CAP-R3 owner deletes their own capture', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'cap-3'), queuedNote, { merge: true }));
    await assertSucceeds(deleteDoc(doc(asA(), 'captures', 'cap-3')));
  });

  it('CAP-R4 rider B cannot read, patch or delete A’s capture; anon reaches nothing', async () => {
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'cap-4'), queuedNote, { merge: true }));
    await assertFails(getDoc(doc(asB(), 'captures', 'cap-4')));
    await assertFails(setDoc(doc(asB(), 'captures', 'cap-4'), { status: 'completed' }, { merge: true }));
    await assertFails(deleteDoc(doc(asB(), 'captures', 'cap-4')));
    await assertFails(getDoc(doc(asAnon(), 'captures', 'cap-4')));
    await assertFails(setDoc(doc(asAnon(), 'captures', 'cap-5'), queuedNote));
  });

  it('CAP-R5 B cannot create a capture claiming A, and A cannot hand one to B', async () => {
    await assertFails(setDoc(doc(asB(), 'captures', 'cap-6'), queuedNote));
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'cap-7'), queuedNote, { merge: true }));
    await assertFails(setDoc(doc(asA(), 'captures', 'cap-7'), { userId: B }, { merge: true }));
    await assertFails(setDoc(doc(asA(), 'captures', 'cap-7'), { createdAt: Timestamp.fromMillis(1) }, { merge: true }));
  });

  it('CAP-R6 validation: label ≤120, detail ≤500, photoPath ≤512, known kind/status, bikeId + timestamps required', async () => {
    // 120 chars passes, 121 fails.
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'v1'), { ...queuedNote, label: 'x'.repeat(120) }));
    await assertFails(setDoc(doc(asA(), 'captures', 'v2'), { ...queuedNote, label: 'x'.repeat(121) }));
    await assertFails(setDoc(doc(asA(), 'captures', 'v3'), { ...queuedNote, label: '' }));
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'v4'), { ...queuedNote, detail: 'd'.repeat(500) }));
    await assertFails(setDoc(doc(asA(), 'captures', 'v5'), { ...queuedNote, detail: 'd'.repeat(501) }));
    await assertSucceeds(setDoc(doc(asA(), 'captures', 'v6'), { ...queuedNote, photoPath: 'p'.repeat(512) }));
    await assertFails(setDoc(doc(asA(), 'captures', 'v7'), { ...queuedNote, photoPath: 'p'.repeat(513) }));
    await assertFails(setDoc(doc(asA(), 'captures', 'v8'), { ...queuedNote, kind: 'video' }));
    await assertFails(setDoc(doc(asA(), 'captures', 'v9'), { ...queuedNote, status: 'archived' }));
    const { bikeId: _b, ...noBike } = queuedNote;
    await assertFails(setDoc(doc(asA(), 'captures', 'v10'), noBike));
    const { createdAt: _c, ...noCreated } = queuedNote;
    await assertFails(setDoc(doc(asA(), 'captures', 'v11'), noCreated));
  });

  it('CAP-R7 a receipt capture whose photoPath is a device file:// URI is accepted (what the app stores today)', async () => {
    await assertSucceeds(
      setDoc(doc(asA(), 'captures', 'r1'), {
        ...queuedNote,
        kind: 'receipt',
        label: 'Receipt photo',
        detail: 'Queued · complete later',
        photoPath: 'file:///data/user/0/app.revora.android/cache/ImageManipulator/7f3a.jpg',
      }),
    );
  });

  it('FBK-R1 the app’s feedback write (serverTimestamp() stamps, notifiedAt null) is accepted; a client-set notifiedAt is not', async () => {
    const message = {
      kind: 'problem',
      message: 'Mileage shows — after editing a fill',
      contactEmail: null,
      tier: 'free',
      appVersion: '1.3.0',
      platform: 'android',
      osVersion: '14',
      deviceModel: 'Pixel 7',
      userId: A,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      notifiedAt: null,
    };
    await assertSucceeds(setDoc(doc(asA(), 'feedback', 'fb-app-1'), message));
    await assertFails(setDoc(doc(asA(), 'feedback', 'fb-app-2'), { ...message, notifiedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(asB(), 'feedback', 'fb-app-3'), message));
  });
});

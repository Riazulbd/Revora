/**
 * QA audit — section 11 / 13 (offline, persistence, sync, Fast Capture,
 * account linking). Code half.
 *
 * Every Firebase native module is mocked; these tests pin what the JS layer
 * guarantees on its own. Anything that depends on the native SDK's behaviour
 * (queue durability, promise timing offline, token refresh) is a device check
 * and is deliberately NOT asserted here.
 *
 * Expected values are literals; none is derived from the module under test.
 */
/* eslint-disable import/first -- jest.mock factories must precede the modules they replace */
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// @testing-library/react-native 14 needs the uninstalled `test-renderer` peer,
// so hooks are driven with react-test-renderer directly.
function renderHook<T>(
  hook: () => T,
  options: { wrapper?: (props: { children: React.ReactNode }) => React.ReactElement } = {},
): { result: { current: T }; rerender: (_: unknown) => void; unmount: () => void } {
  const result = { current: undefined as unknown as T };
  const Probe = () => {
    result.current = hook();
    return null;
  };
  const tree = () => (options.wrapper ? React.createElement(options.wrapper, null, React.createElement(Probe)) : React.createElement(Probe));
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(tree());
  });
  return {
    result,
    rerender: () => act(() => renderer.update(tree())),
    unmount: () => act(() => renderer.unmount()),
  };
}

async function waitFor(assertion: () => void, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - started > timeoutMs) throw error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Native mocks
// ---------------------------------------------------------------------------

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({ name: '[DEFAULT]' }) }));

jest.mock('@react-native-firebase/firestore', () => {
  let generated = 0;
  return {
    CACHE_SIZE_UNLIMITED: -1,
    initializeFirestore: jest.fn(),
    getFirestore: jest.fn(() => ({ kind: 'db' })),
    disableNetwork: jest.fn(),
    enableNetwork: jest.fn(),
    waitForPendingWrites: jest.fn(() => Promise.resolve()),
    collection: jest.fn((_db: unknown, name: string) => ({ collectionName: name })),
    doc: jest.fn((...args: unknown[]) => {
      // doc(collectionRef) mints an id; doc(db, name, id) addresses a document.
      if (args.length === 1) {
        generated += 1;
        return { id: `gen-${generated}` };
      }
      return { path: `${String(args[1])}/${String(args[2])}` };
    }),
    setDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    getDocsFromServer: jest.fn(),
    onSnapshot: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    writeBatch: jest.fn(),
    addDoc: jest.fn(),
    serverTimestamp: jest.fn(() => ({ __server: true })),
    Timestamp: {
      fromMillis: (ms: number) => ({ __ms: ms, toMillis: () => ms }),
    },
  };
});

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => mockAuthState.instance),
  createUserWithEmailAndPassword: jest.fn(),
  getIdToken: jest.fn(() => Promise.resolve('fresh-id-token')),
  onAuthStateChanged: jest.fn(),
  reauthenticateWithCredential: jest.fn(() => Promise.resolve()),
  sendEmailVerification: jest.fn(() => Promise.resolve()),
  sendPasswordResetEmail: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(() => Promise.resolve()),
  linkWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn((email: string, password: string) => ({ provider: 'password', email, password })) },
  GoogleAuthProvider: { credential: jest.fn((idToken: string) => ({ provider: 'google.com', idToken })) },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'success', data: { idToken: 'google-id-token' } })),
  },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(() => ({ kind: 'storage' })),
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  putFile: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...segments: (string | { uri: string })[]) {
      this.uri = segments.map((s) => (typeof s === 'string' ? s : s.uri)).join('/');
    }
    create() {
      mockFs.created.push(this.uri);
    }
  }
  class File {
    uri: string;
    exists = false;
    constructor(...segments: (string | { uri: string })[]) {
      this.uri = segments.map((s) => (typeof s === 'string' ? s : s.uri)).join('/');
    }
    delete() {
      mockFs.deleted.push(this.uri);
    }
    copy(destination: File) {
      if (mockFs.failCopy) throw new Error('ENOSPC');
      mockFs.copies.push([this.uri, destination.uri]);
    }
  }
  return { Directory, File, Paths: { document: 'file:///data/user/0/app.revora/files' } };
});

jest.mock('@/components', () => ({
  useToast: () => ({ show: mockToastShow }),
}));

const mockToastShow = jest.fn();
const mockFs: { created: string[]; deleted: string[]; copies: [string, string][]; failCopy: boolean } = {
  created: [],
  deleted: [],
  copies: [],
  failCopy: false,
};
const mockAuthState: { instance: { currentUser: unknown } } = { instance: { currentUser: null } };

// ---------------------------------------------------------------------------
// Imports under test (after the mocks are registered)
// ---------------------------------------------------------------------------

import {
  CACHE_SIZE_UNLIMITED,
  deleteDoc,
  initializeFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  createUserWithEmailAndPassword,
  getIdToken,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { getDownloadURL, putFile } from '@react-native-firebase/storage';

import { db } from '@/services/firebase';
import { AppError, toAppError } from '@/services/errors';
import { createQueryClient } from '@/services/queryClient';
import { resetSyncState, trackWrite, useSyncState } from '@/services/syncStatus';
import { closeAllLiveQueries, useLiveQuery } from '@/services/liveQuery';
import { imageUrl, uploadImage, uploadImageOrKeepLocal } from '@/services/storage';
import { authService } from '@/services/auth';
import { patchRecord, writeRecord } from '@/repositories/base';
import { captureRepository } from '@/repositories/records';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { useStableId } from '@/features/shared/useStableId';
import type { CaptureItem } from '@/types';

const asMock = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.Mock;

function wrapperWith(client = createQueryClient()) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return Wrapper;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFs.created = [];
  mockFs.deleted = [];
  mockFs.copies = [];
  mockFs.failCopy = false;
  resetSyncState();
});

// ---------------------------------------------------------------------------
// OFF-01 / OFF-02 — persistence settings
// ---------------------------------------------------------------------------

describe('OFF-01 Firestore persistence is enabled with an unlimited cache', () => {
  it('initialises Firestore once with persistence: true and cacheSizeBytes: CACHE_SIZE_UNLIMITED', () => {
    db();
    db();
    // Expected: exactly one initialisation (the module guards with a flag),
    // and the options object is {persistence: true, cacheSizeBytes: -1} where
    // -1 is what the mocked CACHE_SIZE_UNLIMITED constant carries.
    expect(asMock(initializeFirestore)).toHaveBeenCalledTimes(1);
    expect(asMock(initializeFirestore).mock.calls[0]?.[1]).toEqual({
      persistence: true,
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });
    expect(CACHE_SIZE_UNLIMITED).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// OFF-03 — stable ids across re-renders
// ---------------------------------------------------------------------------

describe('OFF-03 useStableId hands back the same id on every render', () => {
  it('calls the factory once and returns the same id after re-renders', () => {
    let calls = 0;
    const factory = () => {
      calls += 1;
      return `id-${calls}`;
    };
    const { result, rerender } = renderHook(() => useStableId(factory));
    const first = result.current;
    rerender({});
    rerender({});
    // Expected: factory invoked exactly 1 time; id stays 'id-1' across 3 renders.
    expect(calls).toBe(1);
    expect(first).toBe('id-1');
    expect(result.current).toBe('id-1');
  });
});

// ---------------------------------------------------------------------------
// OFF-04 / OFF-05 — useRecordMutation in-flight guard and side effects
// ---------------------------------------------------------------------------

describe('OFF-04 useRecordMutation refuses a second submit while the first is in flight', () => {
  it('runs mutationFn once for two overlapping submits and returns null for the second', async () => {
    let resolveFirst: (v: string) => void = () => undefined;
    const mutationFn = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const { result } = renderHook(
      () => useRecordMutation<{ n: number }, string>({ mutationFn, successMessage: 'Saved' }),
      { wrapper: wrapperWith() },
    );

    let firstResult: string | null = 'unset';
    let secondResult: string | null = 'unset';
    await act(async () => {
      const p1 = result.current.submit({ n: 1 });
      const p2 = result.current.submit({ n: 2 });
      secondResult = await p2;
      resolveFirst('doc-1');
      firstResult = await p1;
    });

    // Expected: 1 call to mutationFn (input n=1); second submit → null.
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect((mutationFn.mock.calls as unknown as [{ n: number }][])[0]?.[0]).toEqual({ n: 1 });
    expect(secondResult).toBeNull();
    expect(firstResult).toBe('doc-1');
    // Success toast shown exactly once with the configured message.
    expect(mockToastShow).toHaveBeenCalledTimes(1);
    expect(mockToastShow).toHaveBeenCalledWith('Saved');
  });

  it('allows a submit after the previous one has settled (guard is released)', async () => {
    const mutationFn = jest.fn(() => Promise.resolve('ok'));
    const { result } = renderHook(() => useRecordMutation<void, string>({ mutationFn }), {
      wrapper: wrapperWith(),
    });
    await act(async () => {
      await result.current.submit();
      await result.current.submit();
    });
    // Expected: two sequential submits → 2 calls.
    expect(mutationFn).toHaveBeenCalledTimes(2);
  });
});

describe('OFF-05 useRecordMutation maps a failure into a rider-facing toast and resolves null', () => {
  it('shows the AppError message as an error toast and never throws to the caller', async () => {
    const mutationFn = jest.fn(() => Promise.reject(new AppError('validation', 'Enter a litres figure.')));
    const { result } = renderHook(() => useRecordMutation<void, void>({ mutationFn }), {
      wrapper: wrapperWith(),
    });
    let outcome: void | null = undefined;
    await act(async () => {
      outcome = await result.current.submit();
    });
    // Expected: validation errors are not retryable → 1 call; toast('…', 'error'); null result.
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(mockToastShow).toHaveBeenCalledWith('Enter a litres figure.', 'error');
    expect(outcome).toBeNull();
  });

  it('stamps the sync tracker (pending → synced) only after the mutation resolves', async () => {
    let resolveWrite: () => void = () => undefined;
    const mutationFn = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const { result } = renderHook(
      () => ({ mutation: useRecordMutation<void, void>({ mutationFn }), sync: useSyncState() }),
      { wrapper: wrapperWith() },
    );
    expect(result.current.sync).toBe('idle');
    await act(async () => {
      const p = result.current.mutation.submit();
      // While the promise is unresolved, nothing has told the tracker anything.
      await Promise.resolve();
      expect(result.current.sync).toBe('idle');
      resolveWrite();
      await p;
    });
    // Expected: trackWrite ran after resolution; flush mock resolves → 'synced'.
    await waitFor(() => expect(result.current.sync).toBe('synced'));
  });
});

// ---------------------------------------------------------------------------
// OFF-06 — sync tracker counting
// ---------------------------------------------------------------------------

describe('OFF-06 trackWrite counts in-flight writes and reports the truth', () => {
  it('stays pending until every tracked write has flushed, then reports synced', async () => {
    const { waitForPendingWrites } = jest.requireMock('@react-native-firebase/firestore') as {
      waitForPendingWrites: jest.Mock;
    };
    const resolvers: (() => void)[] = [];
    waitForPendingWrites.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { result } = renderHook(() => useSyncState());

    act(() => {
      trackWrite();
      trackWrite();
    });
    expect(result.current).toBe('pending');

    await act(async () => {
      resolvers[0]?.();
      await Promise.resolve();
    });
    // Expected: 2 tracked, 1 flushed → inFlight 1 → still 'pending'.
    expect(result.current).toBe('pending');

    await act(async () => {
      resolvers[1]?.();
      await Promise.resolve();
    });
    // Expected: 2 tracked, 2 flushed → inFlight 0 → 'synced'.
    expect(result.current).toBe('synced');
  });

  it('reports failed when the flush rejects and nothing else is in flight', async () => {
    const { waitForPendingWrites } = jest.requireMock('@react-native-firebase/firestore') as {
      waitForPendingWrites: jest.Mock;
    };
    waitForPendingWrites.mockImplementation(() => Promise.reject(new Error('stream closed')));
    const { result } = renderHook(() => useSyncState());
    await act(async () => {
      trackWrite();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// OFF-07 — mutation retry policy
// ---------------------------------------------------------------------------

describe('OFF-07 mutation retry policy retries only retryable AppErrors, at most twice', () => {
  const client = createQueryClient();
  const retry = client.getDefaultOptions().mutations?.retry as (n: number, e: unknown) => boolean;
  const retryDelay = client.getDefaultOptions().mutations?.retryDelay as (n: number) => number;

  it('retry decision table', () => {
    const offline = new AppError('offline', 'x'); // retryable defaults true
    const unknown = new AppError('unknown', 'x'); // retryable defaults true
    const validation = new AppError('validation', 'x'); // retryable defaults false
    const permission = new AppError('permission', 'x');
    // Expected: offline/unknown retried at failureCount 0 and 1, refused at 2;
    // validation/permission never retried; a bare Error never retried.
    expect(retry(0, offline)).toBe(true);
    expect(retry(1, offline)).toBe(true);
    expect(retry(2, offline)).toBe(false);
    expect(retry(0, unknown)).toBe(true);
    expect(retry(0, validation)).toBe(false);
    expect(retry(0, permission)).toBe(false);
    expect(retry(0, new Error('boom'))).toBe(false);
  });

  it('back-off: 1000·2^attempt capped at 8000 ms', () => {
    // attempt 0 → 1000·1 = 1000; 1 → 2000; 2 → 4000; 3 → 8000; 4 → min(16000, 8000) = 8000.
    expect(retryDelay(0)).toBe(1000);
    expect(retryDelay(1)).toBe(2000);
    expect(retryDelay(2)).toBe(4000);
    expect(retryDelay(3)).toBe(8000);
    expect(retryDelay(4)).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// OFF-08 — error mapping for the offline / auth paths
// ---------------------------------------------------------------------------

describe('OFF-08 toAppError maps the codes the offline and linking paths produce', () => {
  it('firestore/unavailable → offline, retryable, with the "saved on this device" sentence', () => {
    const e = toAppError({ code: 'firestore/unavailable' });
    expect(e.kind).toBe('offline');
    expect(e.retryable).toBe(true);
    expect(e.message).toBe(
      "Can't reach Revora right now. Your changes are saved on this device and will sync automatically.",
    );
  });

  it('firestore/unauthenticated → auth, "Your session expired…" (token expiry mid-sync surfaces here)', () => {
    const e = toAppError({ code: 'firestore/unauthenticated' });
    expect(e.kind).toBe('auth');
    expect(e.retryable).toBe(false);
    expect(e.message).toBe('Your session expired. Sign in again to continue.');
  });

  it('auth/credential-already-in-use → auth, generic sentence (the Google link path overrides it)', () => {
    const e = toAppError({ code: 'auth/credential-already-in-use' });
    expect(e.kind).toBe('auth');
    expect(e.message).toBe('Those credentials already belong to another account.');
  });

  it('auth/network-request-failed is the only auth code marked retryable', () => {
    expect(toAppError({ code: 'auth/network-request-failed' }).retryable).toBe(true);
    expect(toAppError({ code: 'auth/wrong-password' }).retryable).toBe(false);
  });

  it('a raw Error whose message mentions the network becomes an offline error', () => {
    const e = toAppError(new Error('Network request failed'));
    expect(e.kind).toBe('offline');
    expect(e.retryable).toBe(true);
  });

  it('a raw FirebaseError code is never rendered verbatim', () => {
    const e = toAppError({ code: 'firestore/permission-denied', message: '[firestore/permission-denied] x' });
    expect(e.message).not.toMatch(/firestore\//);
    expect(e.message).toBe("You don't have access to that record.");
  });
});

// ---------------------------------------------------------------------------
// OFF-09 / OFF-10 — writes are merges and never resend the frozen fields
// ---------------------------------------------------------------------------

describe('OFF-09 writeRecord: create stamps ownership, update never resends userId/createdAt', () => {
  it('new record: payload carries userId + createdAt + updatedAt and uses merge:true', async () => {
    await writeRecord({ name: 'fuelEntries', id: 'f1', data: { liters: 7, userId: 'attacker' }, isNew: true, uid: 'rider-a' });
    const [ref, payload, options] = asMock(setDoc).mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(ref).toEqual({ path: 'fuelEntries/f1' });
    // Expected: the uid argument wins over whatever the data carried.
    expect(payload.userId).toBe('rider-a');
    expect(payload.liters).toBe(7);
    expect(payload.createdAt).toBeDefined();
    expect(payload.updatedAt).toBeDefined();
    expect(options).toEqual({ merge: true });
  });

  it('existing record: userId and createdAt are stripped even if the caller passed them', async () => {
    await writeRecord({
      name: 'fuelEntries',
      id: 'f1',
      data: { liters: 8, userId: 'rider-a', createdAt: 1 },
      isNew: false,
      uid: 'rider-a',
    });
    const payload = asMock(setDoc).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['liters', 'updatedAt']);
  });

  it('patchRecord strips userId/createdAt from the change set', async () => {
    await patchRecord({ name: 'captures', id: 'c1', changes: { status: 'completed', userId: 'x', createdAt: 5 } });
    const [ref, payload, options] = asMock(setDoc).mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(ref).toEqual({ path: 'captures/c1' });
    expect(Object.keys(payload).sort()).toEqual(['status', 'updatedAt']);
    expect(options).toEqual({ merge: true });
  });
});

// ---------------------------------------------------------------------------
// OFF-11 / OFF-12 — photo upload failure keeps a durable local copy
// ---------------------------------------------------------------------------

describe('OFF-11 uploadImageOrKeepLocal keeps a durable local copy when the upload fails', () => {
  const input = {
    uid: 'rider-a',
    kind: 'receipt' as const,
    recordId: 'fuel-42',
    localUri: 'file:///data/user/0/app.revora/cache/ImageManipulator/abc.jpg',
  };

  it('success: returns the cloud path users/{uid}/receipt/{id}.jpg and strips file:// for putFile', async () => {
    asMock(putFile).mockResolvedValueOnce(undefined);
    const out = await uploadImageOrKeepLocal(input);
    expect(out).toEqual({ path: 'users/rider-a/receipt/fuel-42.jpg', uploaded: true });
    expect(asMock(putFile).mock.calls[0]?.[1]).toBe('/data/user/0/app.revora/cache/ImageManipulator/abc.jpg');
  });

  it('upload rejects: copies the cache file into the documents dir and returns that URI, uploaded:false', async () => {
    asMock(putFile).mockRejectedValueOnce({ code: 'storage/bucket-not-found' });
    const out = await uploadImageOrKeepLocal(input);
    // Expected destination: Paths.document + '/revora/receipt/fuel-42.jpg'.
    expect(out).toEqual({
      path: 'file:///data/user/0/app.revora/files/revora/receipt/fuel-42.jpg',
      uploaded: false,
    });
    expect(mockFs.created).toEqual(['file:///data/user/0/app.revora/files/revora/receipt']);
    expect(mockFs.copies).toEqual([
      [
        'file:///data/user/0/app.revora/cache/ImageManipulator/abc.jpg',
        'file:///data/user/0/app.revora/files/revora/receipt/fuel-42.jpg',
      ],
    ]);
  });

  it('upload rejects AND the copy fails: falls back to the original cache URI rather than losing the photo', async () => {
    asMock(putFile).mockRejectedValueOnce(new Error('network'));
    mockFs.failCopy = true;
    const out = await uploadImageOrKeepLocal(input);
    expect(out).toEqual({ path: input.localUri, uploaded: false });
  });

  it('uploadImage wraps a failure in the rider-facing "still saved on this device" sentence', async () => {
    asMock(putFile).mockRejectedValueOnce(new Error('boom'));
    await expect(uploadImage(input)).rejects.toMatchObject({
      name: 'AppError',
      message: "Couldn't upload that photo. It's still saved on this device.",
    });
  });
});

describe('OFF-12 imageUrl renders a local or http path directly without touching Storage', () => {
  it('file:// and http(s) paths are returned as-is', async () => {
    expect(await imageUrl('file:///x/y.jpg')).toBe('file:///x/y.jpg');
    expect(await imageUrl('https://cdn/x.jpg')).toBe('https://cdn/x.jpg');
    expect(await imageUrl(null)).toBeNull();
    expect(getDownloadURL).not.toHaveBeenCalled();
  });

  it('a cloud path that cannot be resolved becomes null (placeholder), never a throw', async () => {
    asMock(getDownloadURL).mockRejectedValueOnce({ code: 'storage/object-not-found' });
    expect(await imageUrl('users/a/receipt/1.jpg')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// OFF-13 — one Firestore listener per query key, closed on sign-out
// ---------------------------------------------------------------------------

describe('OFF-13 useLiveQuery shares one listener per key and closeAllLiveQueries drops it', () => {
  it('two consumers of the same key open one subscription; the last unmount closes it', async () => {
    const unsubscribe = jest.fn();
    let emit: (rows: number[]) => void = () => undefined;
    const subscribe = jest.fn((onData: (v: number[]) => void) => {
      emit = onData;
      return unsubscribe;
    });
    const client = createQueryClient();
    const wrapper = wrapperWith(client);
    const key = ['captures', 'rider-a', 'bike-1', 100];

    const a = renderHook(() => useLiveQuery<number[]>({ queryKey: key, subscribe }), { wrapper });
    const b = renderHook(() => useLiveQuery<number[]>({ queryKey: key, subscribe }), { wrapper });

    await act(async () => {
      emit([1, 2, 3]);
    });
    await waitFor(() => expect(a.result.current.data).toEqual([1, 2, 3]));
    expect(b.result.current.data).toEqual([1, 2, 3]);
    // Expected: 1 subscribe for 2 hooks.
    expect(subscribe).toHaveBeenCalledTimes(1);

    a.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(0);
    b.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('closeAllLiveQueries unsubscribes every open listener (what sign-out and delete-account call)', async () => {
    const unsubscribe = jest.fn();
    // The native bridge delivers the first snapshot asynchronously; emitting on
    // a microtask mirrors that. (A *synchronous* first emit closes and reopens
    // the listener once — see OFF-13c.)
    const subscribe = jest.fn((onData: (v: string) => void) => {
      void Promise.resolve().then(() => onData('first'));
      return unsubscribe;
    });
    const wrapper = wrapperWith();
    const h = renderHook(() => useLiveQuery<string>({ queryKey: ['profile', 'rider-a'], subscribe }), { wrapper });
    await waitFor(() => expect(h.result.current.data).toBe('first'));
    expect(subscribe).toHaveBeenCalledTimes(1);
    closeAllLiveQueries();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    h.unmount();
    // A second release for an already-dropped entry is a no-op, not a double close.
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('OFF-13c observation: a listener whose first snapshot arrives synchronously is closed and reopened once', async () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.fn((onData: (v: string) => void) => {
      onData('sync');
      return unsubscribe;
    });
    const h = renderHook(() => useLiveQuery<string>({ queryKey: ['profile', 'rider-sync'], subscribe }), {
      wrapper: wrapperWith(),
    });
    await waitFor(() => expect(h.result.current.data).toBe('sync'));
    // Observed: the queryFn's acquire→release runs to zero refs before the
    // effect acquires, so subscribe runs twice and one unsubscribe has already
    // happened. Data is intact; it is listener churn only. Recorded, not fixed.
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    h.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// OFF-14 — Fast Capture write shape (what the ruleset will be asked to accept)
// ---------------------------------------------------------------------------

describe('OFF-14 captureRepository.save writes exactly the fields firestore.rules validates', () => {
  it('a queued note capture is stored with userId, bikeId, kind, status, label and explicit nulls', async () => {
    const item: CaptureItem = {
      id: 'cap-1',
      userId: 'rider-a',
      bikeId: 'bike-1',
      createdAt: 1_760_000_000_000,
      updatedAt: 1_760_000_000_000,
      kind: 'note',
      status: 'queued',
      label: 'Front brake spongy',
      detail: 'Note',
      photoPath: null,
      completedRecordId: null,
      completedRecordType: null,
    };
    await captureRepository.save('rider-a', item, true);
    const [ref, payload, options] = asMock(setDoc).mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(ref).toEqual({ path: 'captures/cap-1' });
    expect(options).toEqual({ merge: true });
    expect(payload.userId).toBe('rider-a');
    expect(payload.bikeId).toBe('bike-1');
    expect(payload.kind).toBe('note');
    expect(payload.status).toBe('queued');
    expect(payload.label).toBe('Front brake spongy');
    expect(payload.detail).toBe('Note');
    // compact() drops undefined only — null survives, so the rules' `== null`
    // branches see an explicit null rather than a missing key.
    expect(payload.photoPath).toBeNull();
    expect(payload.completedRecordId).toBeNull();
    expect(payload.completedRecordType).toBeNull();
    expect(payload.createdAt).toBeDefined();
    expect(payload.updatedAt).toBeDefined();
  });

  it('remove issues a deleteDoc on captures/{id} (no tombstone of our own — Firestore queues it)', async () => {
    await captureRepository.remove('rider-a', 'cap-1');
    expect(asMock(deleteDoc).mock.calls[0]?.[0]).toEqual({ path: 'captures/cap-1' });
  });
});

// ---------------------------------------------------------------------------
// OFF-15 / OFF-16 / OFF-17 — account linking keeps the uid; deletion re-auths
// ---------------------------------------------------------------------------

describe('OFF-15 linkEmailAccount links onto the current anonymous user instead of creating a new one', () => {
  it('calls linkWithCredential(currentUser, EmailAuthProvider.credential) and never createUserWithEmailAndPassword', async () => {
    const anon = { uid: 'anon-123', isAnonymous: true, email: null, displayName: null, emailVerified: false, providerData: [], reload: jest.fn(() => Promise.resolve()) };
    mockAuthState.instance = { currentUser: anon };
    asMock(linkWithCredential).mockResolvedValueOnce({ user: { ...anon, email: 'r@x.com', reload: jest.fn(() => Promise.resolve()) } });

    const user = await authService.linkEmailAccount({ email: '  r@x.com ', password: 'password1', displayName: ' Riaz ' });

    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(asMock(linkWithCredential).mock.calls[0]?.[0]).toBe(anon);
    expect(asMock(EmailAuthProvider.credential).mock.calls[0]).toEqual(['r@x.com', 'password1']);
    // Expected: the uid the rider's records already carry.
    expect(user.uid).toBe('anon-123');
  });

  it('refuses with a sign-in sentence when there is no current user to link onto', async () => {
    mockAuthState.instance = { currentUser: null };
    await expect(authService.linkEmailAccount({ email: 'a@b.c', password: 'password1', displayName: 'A' })).rejects.toMatchObject({
      kind: 'auth',
      message: 'Sign in again to finish setting up your account.',
    });
    expect(linkWithCredential).not.toHaveBeenCalled();
  });
});

describe('OFF-16 linkGoogleAccount keeps the uid and refuses a Google account that already owns records', () => {
  const anon = { uid: 'anon-777', isAnonymous: true, email: null, displayName: null, emailVerified: false, providerData: [], reload: jest.fn(() => Promise.resolve()) };

  it('links via linkWithCredential(currentUser, Google credential) — not signInWithCredential', async () => {
    mockAuthState.instance = { currentUser: anon };
    asMock(linkWithCredential).mockResolvedValueOnce({ user: { ...anon, reload: jest.fn(() => Promise.resolve()) } });
    const user = await authService.linkGoogleAccount();
    expect(signInWithCredential).not.toHaveBeenCalled();
    expect(asMock(linkWithCredential).mock.calls[0]?.[0]).toBe(anon);
    expect(asMock(linkWithCredential).mock.calls[0]?.[1]).toEqual({ provider: 'google.com', idToken: 'google-id-token' });
    expect(user?.uid).toBe('anon-777');
  });

  it('auth/credential-already-in-use → the specific "already has its own Revora records" message', async () => {
    mockAuthState.instance = { currentUser: anon };
    asMock(linkWithCredential).mockRejectedValueOnce({ code: 'auth/credential-already-in-use' });
    await expect(authService.linkGoogleAccount()).rejects.toMatchObject({
      kind: 'auth',
      message:
        'That Google account already has its own Revora records. To use those instead, sign out and choose Continue with Google.',
    });
  });

  it('a dismissed Google picker resolves null and links nothing', async () => {
    mockAuthState.instance = { currentUser: anon };
    const { GoogleSignin } = jest.requireMock('@react-native-google-signin/google-signin') as { GoogleSignin: { signIn: jest.Mock } };
    GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
    expect(await authService.linkGoogleAccount()).toBeNull();
    expect(linkWithCredential).not.toHaveBeenCalled();
  });
});

describe('OFF-17 reauthenticate uses a method the account actually has, then refreshes the token', () => {
  it('password path: EmailAuthProvider.credential(user.email, password) → reauthenticate → forced token refresh', async () => {
    const user = { uid: 'u1', email: 'r@x.com', providerData: [{ providerId: 'password' }] };
    mockAuthState.instance = { currentUser: user };
    await authService.reauthenticate({ password: 'hunter22' });
    expect(asMock(EmailAuthProvider.credential).mock.calls[0]).toEqual(['r@x.com', 'hunter22']);
    expect(asMock(reauthenticateWithCredential).mock.calls[0]?.[0]).toBe(user);
    // Forced, not cached: deleteMyAccount reads `auth_time` off the ID token,
    // and a cached one is up to an hour old — it would refuse the deletion the
    // rider has just re-confirmed.
    expect(asMock(getIdToken).mock.calls[0]).toEqual([user, true]);
  });

  it('google path: Google credential → reauthenticate; a dismissed picker aborts before any refresh', async () => {
    const user = { uid: 'u2', email: 'g@x.com', providerData: [{ providerId: 'google.com' }] };
    mockAuthState.instance = { currentUser: user };
    await authService.reauthenticate({ viaGoogle: true });
    expect(asMock(reauthenticateWithCredential).mock.calls[0]?.[1]).toEqual({ provider: 'google.com', idToken: 'google-id-token' });
    expect(getIdToken).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    const { GoogleSignin } = jest.requireMock('@react-native-google-signin/google-signin') as { GoogleSignin: { signIn: jest.Mock } };
    GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
    await expect(authService.reauthenticate({ viaGoogle: true })).rejects.toMatchObject({
      message: 'Confirm with Google to delete your account.',
    });
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it('an anonymous rider has nothing to present, and is not asked for anything', async () => {
    const user = { uid: 'anon-1', email: null, isAnonymous: true, providerData: [] };
    mockAuthState.instance = { currentUser: user };
    await authService.reauthenticate({});
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(asMock(getIdToken).mock.calls[0]).toEqual([user, true]);
  });
});

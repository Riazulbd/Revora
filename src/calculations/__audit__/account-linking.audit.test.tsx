/**
 * QA audit — section 13 (account linking / deletion). Code half.
 *
 * Renders the real `src/app/(auth)/signup.tsx` with the design components
 * replaced by bare React Native primitives, and drives the real
 * `useDeleteAccount` hook, so the branch decisions are observed rather than
 * read. Firebase itself is not involved: the seams are `useAuth` and the
 * repositories.
 */
/* eslint-disable import/first -- jest.mock factories must precede the modules they replace */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const mockToastShow = jest.fn();
jest.mock('@/components', () => {
  const R = require('react') as typeof import('react');
  const RN = require('react-native') as typeof import('react-native');
  return {
    Screen: ({ children, testID }: { children: React.ReactNode; testID?: string }) =>
      R.createElement(RN.View, { testID }, children),
    ScreenHeader: () => null,
    Txt: ({ children }: { children: React.ReactNode }) => R.createElement(RN.Text, null, children),
    Field: ({ children, error }: { children: React.ReactNode; error: string | null }) =>
      R.createElement(RN.View, null, children, error ? R.createElement(RN.Text, { testID: 'field-error' }, error) : null),
    Input: (props: Record<string, unknown>) => R.createElement(RN.TextInput, props),
    Button: ({ label, onPress, testID, disabled }: { label: string; onPress: () => unknown; testID?: string; disabled?: boolean }) =>
      R.createElement(RN.Pressable, { onPress, testID, disabled }, R.createElement(RN.Text, null, label)),
    useToast: () => ({ show: mockToastShow }),
  };
});

type MockUser = { uid: string; isAnonymous: boolean; email: string | null } | null;
const mockAuth = {
  user: null as MockUser,
  signUp: jest.fn(() => Promise.resolve()),
  signInWithGoogle: jest.fn(() => Promise.resolve(true)),
  linkEmailAccount: jest.fn(() => Promise.resolve()),
  linkGoogleAccount: jest.fn(() => Promise.resolve(true)),
  signOut: jest.fn(),
};
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => mockAuth }));

const mockGarage = { bikes: [{ id: 'bike-1' }, { id: 'bike-2' }] };
jest.mock('@/features/bikes/GarageProvider', () => ({ useGarage: () => mockGarage }));

const mockCalls: string[] = [];
jest.mock('@/repositories', () => ({
  perBikeRepositories: ['fuelEntries', 'services', 'captures'].map((name) => ({
    name,
    removeAllForUser: jest.fn((uid: string) => {
      mockCalls.push(`removeAllForUser:${name}:${uid}`);
      return Promise.resolve(1);
    }),
  })),
  bikeRepository: { remove: jest.fn() },
  profileRepository: {
    remove: jest.fn((uid: string) => {
      mockCalls.push(`profile.remove:${uid}`);
      return Promise.resolve();
    }),
  },
}));
jest.mock('@/repositories/base', () => ({
  deleteRecord: jest.fn((input: { name: string; id: string }) => {
    mockCalls.push(`deleteRecord:${input.name}/${input.id}`);
    return Promise.resolve();
  }),
}));
jest.mock('@/services/auth', () => ({
  authService: {
    deleteAccount: jest.fn((reauth: unknown) => {
      mockCalls.push(`authService.deleteAccount:${JSON.stringify(reauth)}`);
      return Promise.resolve();
    }),
  },
}));
jest.mock('@/services/liveQuery', () => ({
  closeAllLiveQueries: jest.fn(() => {
    mockCalls.push('closeAllLiveQueries');
  }),
}));
jest.mock('@/services/syncStatus', () => ({ trackWrite: jest.fn() }));

import SignUp from '@/app/(auth)/signup';
import { useDeleteAccount } from '@/features/settings/useAccountMutations';

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function byId(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

async function fillAndSubmit(renderer: ReactTestRenderer) {
  await act(async () => {
    byId(renderer, 'input-name').props.onChangeText('Riaz');
    byId(renderer, 'input-email').props.onChangeText('riaz@example.com');
    byId(renderer, 'input-password').props.onChangeText('password123');
  });
  await act(async () => {
    await byId(renderer, 'cta-submit').props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockAuth.user = null;
});

describe('SIG-01 signup.tsx branches on isAnonymous: an offline rider is linked, not re-created', () => {
  it('anonymous user → linkEmailAccount with the parsed form, signUp untouched, then router.replace("/")', async () => {
    mockAuth.user = { uid: 'anon-1', isAnonymous: true, email: null };
    const r = render(<SignUp />);
    // The claiming copy is on screen.
    expect(JSON.stringify(r.toJSON())).toContain('Keep your records');

    await fillAndSubmit(r);

    expect(mockAuth.linkEmailAccount).toHaveBeenCalledTimes(1);
    expect(mockAuth.linkEmailAccount).toHaveBeenCalledWith({
      displayName: 'Riaz',
      email: 'riaz@example.com',
      password: 'password123',
    });
    expect(mockAuth.signUp).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('no user (fresh install) → signUp, linkEmailAccount untouched', async () => {
    mockAuth.user = null;
    const r = render(<SignUp />);
    expect(JSON.stringify(r.toJSON())).toContain('Create account');
    await fillAndSubmit(r);
    expect(mockAuth.signUp).toHaveBeenCalledTimes(1);
    expect(mockAuth.linkEmailAccount).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('a signed-in, non-anonymous user is treated like a fresh signup (no link)', async () => {
    mockAuth.user = { uid: 'real-1', isAnonymous: false, email: 'a@b.c' };
    const r = render(<SignUp />);
    await fillAndSubmit(r);
    expect(mockAuth.signUp).toHaveBeenCalledTimes(1);
    expect(mockAuth.linkEmailAccount).not.toHaveBeenCalled();
  });
});

describe('SIG-02 the Google button follows the same branch', () => {
  it('anonymous → linkGoogleAccount; not anonymous → signInWithGoogle', async () => {
    mockAuth.user = { uid: 'anon-2', isAnonymous: true, email: null };
    const r = render(<SignUp />);
    await act(async () => {
      await byId(r, 'cta-google').props.onPress();
    });
    expect(mockAuth.linkGoogleAccount).toHaveBeenCalledTimes(1);
    expect(mockAuth.signInWithGoogle).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');

    jest.clearAllMocks();
    mockAuth.user = null;
    const r2 = render(<SignUp />);
    await act(async () => {
      await byId(r2, 'cta-google').props.onPress();
    });
    expect(mockAuth.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockAuth.linkGoogleAccount).not.toHaveBeenCalled();
  });

  it('a dismissed picker (resolves false) does not navigate', async () => {
    mockAuth.user = { uid: 'anon-3', isAnonymous: true, email: null };
    mockAuth.linkGoogleAccount.mockResolvedValueOnce(false);
    const r = render(<SignUp />);
    await act(async () => {
      await byId(r, 'cta-google').props.onPress();
    });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('SIG-03 a refused link is shown as a sentence and the rider stays on the screen', () => {
  it('credential-already-in-use from the Google link reaches the toast verbatim, no navigation', async () => {
    mockAuth.user = { uid: 'anon-4', isAnonymous: true, email: null };
    const { AppError } = jest.requireActual('@/services/errors') as typeof import('@/services/errors');
    mockAuth.linkGoogleAccount.mockRejectedValueOnce(
      new AppError('auth', 'That Google account already has its own Revora records. To use those instead, sign out and choose Continue with Google.'),
    );
    const r = render(<SignUp />);
    await act(async () => {
      await byId(r, 'cta-google').props.onPress();
    });
    expect(mockToastShow).toHaveBeenCalledWith(
      'That Google account already has its own Revora records. To use those instead, sign out and choose Continue with Google.',
      'error',
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('a raw Firebase code from the email link is never shown verbatim', async () => {
    mockAuth.user = { uid: 'anon-5', isAnonymous: true, email: null };
    mockAuth.linkEmailAccount.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    const r = render(<SignUp />);
    await fillAndSubmit(r);
    expect(mockToastShow).toHaveBeenCalledWith('An account already exists for that email address.', 'error');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('a short password never reaches the auth layer', async () => {
    mockAuth.user = { uid: 'anon-6', isAnonymous: true, email: null };
    const r = render(<SignUp />);
    await act(async () => {
      byId(r, 'input-name').props.onChangeText('Riaz');
      byId(r, 'input-email').props.onChangeText('riaz@example.com');
      byId(r, 'input-password').props.onChangeText('short');
    });
    await act(async () => {
      await byId(r, 'cta-submit').props.onPress();
    });
    expect(mockAuth.linkEmailAccount).not.toHaveBeenCalled();
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });
});

describe('DEL-01 useDeleteAccount deletes data before identity, in a fixed order', () => {
  it('closeAllLiveQueries → every per-bike collection → each bike → profile → Firebase identity', async () => {
    mockAuth.user = { uid: 'rider-a', isAnonymous: false, email: 'a@b.c' };
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const captured: { current: ReturnType<typeof useDeleteAccount> | null } = { current: null };
    const Probe = () => {
      captured.current = useDeleteAccount();
      return null;
    };
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    await act(async () => {
      await captured.current?.submit({ password: 'hunter22' });
    });
    // Expected order, computed from the intent: listeners closed first, then
    // 3 mocked per-bike collections, then 2 bikes, then profile, then auth.
    expect(mockCalls).toEqual([
      'closeAllLiveQueries',
      'removeAllForUser:fuelEntries:rider-a',
      'removeAllForUser:services:rider-a',
      'removeAllForUser:captures:rider-a',
      'deleteRecord:bikes/bike-1',
      'deleteRecord:bikes/bike-2',
      'profile.remove:rider-a',
      'authService.deleteAccount:{"password":"hunter22"}',
    ]);
    expect(mockToastShow).toHaveBeenCalledWith('Your account and every record in it have been deleted.');
  });

  it('a failure before the identity step leaves the identity intact and tells the rider', async () => {
    mockAuth.user = { uid: 'rider-b', isAnonymous: false, email: 'b@b.c' };
    const { profileRepository } = jest.requireMock('@/repositories') as { profileRepository: { remove: jest.Mock } };
    profileRepository.remove.mockRejectedValueOnce({ code: 'firestore/permission-denied' });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const captured: { current: ReturnType<typeof useDeleteAccount> | null } = { current: null };
    const Probe = () => {
      captured.current = useDeleteAccount();
      return null;
    };
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    await act(async () => {
      await captured.current?.submit({ password: 'x' });
    });
    expect(mockCalls.some((c) => c.startsWith('authService.deleteAccount'))).toBe(false);
    expect(mockToastShow).toHaveBeenCalledWith("You don't have access to that record.", 'error');
  });
});

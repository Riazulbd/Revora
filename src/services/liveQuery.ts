import { hashKey, useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';

import { toAppError, type AppError } from './errors';
import { log } from './logger';

export type Unsubscribe = () => void;

export type SubscribeFn<T> = (onData: (value: T) => void, onError: (error: unknown) => void) => Unsubscribe;

type Entry<T> = {
  refs: number;
  unsubscribe: Unsubscribe;
  /** Resolves with the first snapshot; rejects if the listener fails first. */
  first: Promise<T>;
  settled: boolean;
  /** The most recent snapshot, so a refetch returns current data, not the first. */
  latest: { value: T } | null;
};

/**
 * Firestore listeners, reference-counted and shared.
 *
 * A screen that mounts three components reading the same collection opens one
 * listener, not three — and closing the last consumer closes it, so nothing is
 * left streaming in the background (mistake 21).
 *
 * Data flows listener → TanStack Query cache. Because Firestore emits a local
 * snapshot the instant a write is accepted, every screen reading that collection
 * updates immediately, offline included; there is no window in which a card can
 * show a stale figure after a mutation (requirement 52 / mistake 33).
 */
const registry = new Map<string, Entry<unknown>>();

function acquire<T>(hash: string, subscribe: SubscribeFn<T>, onData: (value: T) => void): Entry<T> {
  const existing = registry.get(hash) as Entry<T> | undefined;
  if (existing) {
    existing.refs += 1;
    return existing;
  }

  let resolveFirst!: (value: T) => void;
  let rejectFirst!: (error: unknown) => void;
  const first = new Promise<T>((resolve, reject) => {
    resolveFirst = resolve;
    rejectFirst = reject;
  });

  const entry: Entry<T> = {
    refs: 1,
    settled: false,
    first,
    latest: null,
    unsubscribe: () => undefined,
  };

  // Registered before subscribing: a listener that fails synchronously calls
  // release(), and release() can only clean up an entry it can find.
  registry.set(hash, entry as Entry<unknown>);

  entry.unsubscribe = subscribe(
    (value) => {
      entry.latest = { value };
      if (!entry.settled) {
        entry.settled = true;
        resolveFirst(value);
      }
      onData(value);
    },
    (error) => {
      if (!entry.settled) {
        entry.settled = true;
        rejectFirst(error);
      }
      log.warn('liveQuery', 'listener error', { hash, error: String(error) });
      // A failed listener must not leave a zombie entry behind.
      release(hash, true);
    },
  );

  // A rejected promise with no consumer yet would surface as an unhandled
  // rejection; the query below always awaits it, this is belt and braces.
  void first.catch(() => undefined);

  return entry;
}

function release(hash: string, force = false) {
  const entry = registry.get(hash);
  if (!entry) return;
  entry.refs -= 1;
  if (force || entry.refs <= 0) {
    registry.delete(hash);
    try {
      entry.unsubscribe();
    } catch (error) {
      log.warn('liveQuery', 'unsubscribe failed', { error: String(error) });
    }
  }
}

export type LiveQueryOptions<T> = {
  queryKey: QueryKey;
  subscribe: SubscribeFn<T>;
  enabled?: boolean;
};

/**
 * Subscribes to a Firestore query and mirrors it into the TanStack Query cache.
 *
 * The returned object is an ordinary `useQuery` result, so screens get the usual
 * `data` / `isPending` / `error` triple and `refetch` for pull-to-refresh.
 */
export function useLiveQuery<T>(options: LiveQueryOptions<T>): UseQueryResult<T, AppError> {
  const { queryKey, subscribe, enabled = true } = options;
  const client = useQueryClient();
  const hash = hashKey(queryKey);

  const query = useQuery<T, AppError>({
    queryKey,
    enabled,
    // The listener is the source of freshness; refetching would open a second one.
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    queryFn: async () => {
      const entry = acquire<T>(hash, subscribe, (value) => client.setQueryData(queryKey, value));
      try {
        // A refetch must return what the listener holds now, not the snapshot it
        // first delivered — otherwise pull-to-refresh would show stale rows.
        if (entry.latest !== null) return entry.latest.value;
        return await entry.first;
      } catch (error) {
        throw toAppError(error);
      } finally {
        // The effect below holds the long-lived reference.
        release(hash);
      }
    },
  });

  useEffect(() => {
    if (!enabled) return undefined;
    acquire<T>(hash, subscribe, (value) => client.setQueryData(queryKey, value));
    return () => release(hash);
    // `hash` fully describes the subscription: same key, same query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, enabled]);

  return query;
}

/** Test seam: drops every listener. Used when signing out. */
export function closeAllLiveQueries() {
  for (const hash of [...registry.keys()]) release(hash, true);
}

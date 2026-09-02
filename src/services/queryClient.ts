import { QueryClient } from '@tanstack/react-query';

import { AppError } from './errors';

/**
 * The client-side cache.
 *
 * Reads are pushed in by Firestore listeners (see liveQuery.ts), so nothing here
 * polls or refetches on its own. The retry policy exists for mutations: a write
 * that failed because the rider walked into a basement should retry, one that
 * failed because the record is gone should not.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          return error instanceof AppError ? error.retryable : false;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}

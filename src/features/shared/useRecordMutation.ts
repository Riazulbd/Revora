import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useToast } from '@/components';
import { messageFor } from '@/services/errors';
import { trackWrite } from '@/services/syncStatus';

export type RecordMutation<TInput, TResult> = {
  /** Runs the write. Resolves with null when it failed or was already running. */
  submit: (input: TInput) => Promise<TResult | null>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

/**
 * The shape every write in Revora takes.
 *
 * It does four things no screen should have to remember:
 *  · stamps the write into the sync tracker so the rider can be told
 *    "Saved" / "Syncing" / "Waiting for connection";
 *  · converts any failure into a sentence a rider can act on;
 *  · shows the design's toast on success;
 *  · refuses to run a second time while the first run is in flight, which is the
 *    other half of the double-submit guard (the first half is in `Button`).
 */
export function useRecordMutation<TInput, TResult = void>(options: {
  mutationFn: (input: TInput) => Promise<TResult>;
  successMessage?: string | ((result: TResult, input: TInput) => string);
  onSuccess?: (result: TResult, input: TInput) => void;
  /** Query keys to drop after the write. Live listeners handle the rest. */
  invalidate?: readonly unknown[][];
  errorFallback?: string;
}): RecordMutation<TInput, TResult> {
  const toast = useToast();
  const client = useQueryClient();
  const inFlight = useRef(false);

  const mutation = useMutation<TResult, Error, TInput>({
    mutationFn: options.mutationFn,
    onSuccess: (result, input) => {
      trackWrite();
      for (const key of options.invalidate ?? []) {
        void client.invalidateQueries({ queryKey: key });
      }
      const message =
        typeof options.successMessage === 'function'
          ? options.successMessage(result, input)
          : options.successMessage;
      if (message) toast.show(message);
      options.onSuccess?.(result, input);
    },
    onError: (error) => {
      toast.show(messageFor(error, options.errorFallback), 'error');
    },
  });

  const mutateAsync = mutation.mutateAsync;

  const submit = useCallback(
    async (input: TInput): Promise<TResult | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      try {
        return await mutateAsync(input);
      } catch {
        // The toast in onError has already told the rider what happened.
        return null;
      } finally {
        inFlight.current = false;
      }
    },
    [mutateAsync],
  );

  return {
    submit,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

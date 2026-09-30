import { useRouter } from 'expo-router';

import { safetyRepository, warrantyRepository } from '@/repositories';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import type { IsoDate, SafetyArea, SafetyCheck, SafetyStatus, Warranty } from '@/types';

/**
 * The two writes the redesigned Records screens need that the single-record
 * mutations cannot express.
 *
 * A walk-around is one pass of the motorcycle, but the data model stores one
 * check per area and always will — a stored "session" would be a derived thing
 * with somewhere to go stale, and the board's own footnote says so. So the form
 * writes several checks and this is the one mutation that covers them, rather
 * than firing the single-check mutation five times and navigating away after
 * the first.
 *
 * Claim status moved from a "Start a claim" button to a four-way control, so
 * the patch has to be able to set any of the four rather than only open one.
 */

export type WalkaroundMark = {
  /** Fixed before the first attempt, so a retry rewrites the same document. */
  id: string;
  area: SafetyArea;
  status: SafetyStatus;
  summary: string;
  existing?: SafetyCheck;
};

export type WalkaroundDraft = {
  date: IsoDate;
  marks: WalkaroundMark[];
};

export function useSaveWalkaround(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<WalkaroundDraft, number>({
    mutationFn: async (draft) => {
      const { uid, bikeId } = requireGarage(ctx);
      const now = Date.now();

      for (const mark of draft.marks) {
        const record: SafetyCheck = {
          id: mark.id,
          userId: uid,
          bikeId,
          createdAt: mark.existing?.createdAt ?? now,
          updatedAt: now,
          area: mark.area,
          date: draft.date,
          status: mark.status,
          summary: mark.summary,
          measurements: mark.existing?.measurements ?? null,
          note: mark.existing?.note ?? null,
          photoPath: mark.existing?.photoPath ?? null,
          clientRef: mark.existing?.clientRef ?? mark.id,
        };
        await safetyRepository.save(uid, record, mark.existing === undefined);
      }

      return draft.marks.length;
    },
    successMessage: (count) => `Check logged · ${count} area${count === 1 ? '' : 's'}`,
    onSuccess: () => {
      options.onSaved?.();
      if (router.canGoBack()) router.back();
      else router.replace('/records/safety');
    },
  });
}

export type ClaimStatus = Warranty['claimStatus'];

const CLAIM_MESSAGE: Record<ClaimStatus, string> = {
  none: 'Claim closed',
  open: 'Claim opened · gather the receipt, the warranty card and a photo of the serial number',
  settled: 'Claim marked settled',
  rejected: 'Claim marked rejected',
};

export function useSetClaimStatus(options: { onSet?: (status: ClaimStatus) => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<{ id: string; claimStatus: ClaimStatus }, ClaimStatus>({
    mutationFn: async ({ id, claimStatus }) => {
      const { uid } = requireGarage(ctx);
      await warrantyRepository.patch(uid, id, { claimStatus });
      return claimStatus;
    },
    successMessage: (status) => CLAIM_MESSAGE[status],
    onSuccess: (status) => options.onSet?.(status),
  });
}

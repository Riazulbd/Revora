import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { captureRepository } from '@/repositories';
import type { CaptureItem, CaptureKind, LedgerSource } from '@/types';

/**
 * Fast Capture.
 *
 * One tap at the pump creates a queued item; the details are filled in later.
 * The queue is a real collection, so a capture made with no signal survives the
 * app being killed and is still there tomorrow (requirement 37).
 */

export type CaptureDraft = {
  kind: CaptureKind;
  label: string;
  detail: string | null;
  photoPath: string | null;
};

export function useAddCapture(options: { onAdded?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<CaptureDraft, CaptureItem>({
    mutationFn: async (draft) => {
      const { uid, bikeId } = requireGarage(ctx);
      const now = Date.now();
      const item: CaptureItem = {
        id: captureRepository.newId(),
        userId: uid,
        bikeId,
        createdAt: now,
        updatedAt: now,
        kind: draft.kind,
        status: 'queued',
        label: draft.label,
        detail: draft.detail,
        photoPath: draft.photoPath,
        completedRecordId: null,
        completedRecordType: null,
      };
      await captureRepository.save(uid, item, true);
      return item;
    },
    successMessage: 'Saved to offline queue',
    onSuccess: () => options.onAdded?.(),
  });
}

export function useCompleteCapture(options: { onCompleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<{
    id: string;
    recordId: string;
    recordType: LedgerSource | 'odometer';
    detail: string;
  }>({
    mutationFn: async ({ id, recordId, recordType, detail }) => {
      const { uid } = requireGarage(ctx);
      await captureRepository.patch(uid, id, {
        status: 'completed',
        completedRecordId: recordId,
        completedRecordType: recordType,
        detail,
      });
    },
    successMessage: 'Capture completed',
    onSuccess: () => options.onCompleted?.(),
  });
}

export function useDeleteCapture(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await captureRepository.remove(uid, id);
    },
    successMessage: 'Removed from queue',
    onSuccess: () => options.onDeleted?.(),
  });
}

import { useRouter } from 'expo-router';

import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { documentRepository, safetyRepository, warrantyRepository } from '@/repositories';
import type {
  DocumentKind,
  IsoDate,
  SafetyArea,
  SafetyCheck,
  SafetyStatus,
  VaultDocument,
  Warranty,
} from '@/types';

/** Document vault, warranties and the safety log — the ownership record set. */

export type DocumentDraft = {
  id: string;
  kind: DocumentKind;
  customKindLabel: string | null;
  title: string;
  reference: string | null;
  issuedOn: IsoDate | null;
  expiresOn: IsoDate | null;
  keepOfflineCopy: boolean;
  filePath: string | null;
  notes: string | null;
  existing?: VaultDocument;
};

export function useSaveDocument(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<DocumentDraft, VaultDocument>({
    mutationFn: async (draft) => {
      const { uid, bikeId } = requireGarage(ctx);
      const now = Date.now();
      const record: VaultDocument = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        kind: draft.kind,
        customKindLabel: draft.customKindLabel,
        title: draft.title,
        reference: draft.reference,
        issuedOn: draft.issuedOn,
        expiresOn: draft.expiresOn,
        filePath: draft.filePath,
        keepOfflineCopy: draft.keepOfflineCopy,
        notes: draft.notes,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };
      await documentRepository.save(uid, record, draft.existing === undefined);
      return record;
    },
    successMessage: (_r, draft) =>
      draft.expiresOn ? 'Document saved · reminder set' : 'Document saved',
    onSuccess: () => {
      options.onSaved?.();
      if (router.canGoBack()) router.back();
      else router.replace('/records/vault');
    },
  });
}

export function useDeleteDocument(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();
  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await documentRepository.remove(uid, id);
    },
    successMessage: 'Document deleted',
    onSuccess: () => options.onDeleted?.(),
  });
}

export type WarrantyDraft = {
  id: string;
  title: string;
  provider: string | null;
  purchasedFrom: string | null;
  coverage: string | null;
  validUntil: IsoDate | null;
  reminderDaysBefore: number | null;
  existing?: Warranty;
};

export function useSaveWarranty(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<WarrantyDraft, Warranty>({
    mutationFn: async (draft) => {
      const { uid, bikeId } = requireGarage(ctx);
      const now = Date.now();
      const record: Warranty = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        title: draft.title,
        provider: draft.provider,
        purchasedFrom: draft.purchasedFrom,
        coverage: draft.coverage,
        validUntil: draft.validUntil,
        claimStatus: draft.existing?.claimStatus ?? 'none',
        evidencePaths: draft.existing?.evidencePaths ?? [],
        reminderDaysBefore: draft.reminderDaysBefore,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };
      await warrantyRepository.save(uid, record, draft.existing === undefined);
      return record;
    },
    successMessage: (_r, draft) => (draft.existing ? 'Warranty updated' : 'Warranty added'),
    onSuccess: () => {
      options.onSaved?.();
      if (router.canGoBack()) router.back();
      else router.replace('/records/warranties');
    },
  });
}

export function useDeleteWarranty(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();
  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await warrantyRepository.remove(uid, id);
    },
    successMessage: 'Warranty removed',
    onSuccess: () => options.onDeleted?.(),
  });
}

export function useStartWarrantyClaim(options: { onStarted?: () => void } = {}) {
  const ctx = useGarageContext();
  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await warrantyRepository.patch(uid, id, { claimStatus: 'open' });
    },
    successMessage: 'Claim opened · gather the evidence listed above',
    onSuccess: () => options.onStarted?.(),
  });
}

export type SafetyDraft = {
  id: string;
  area: SafetyArea;
  date: IsoDate;
  status: SafetyStatus;
  summary: string;
  measurements: Record<string, number> | null;
  note: string | null;
  photoPath: string | null;
  existing?: SafetyCheck;
};

export function useSaveSafetyCheck(options: { onSaved?: () => void } = {}) {
  const ctx = useGarageContext();
  const router = useRouter();

  return useRecordMutation<SafetyDraft, SafetyCheck>({
    mutationFn: async (draft) => {
      const { uid, bikeId } = requireGarage(ctx);
      const now = Date.now();
      const record: SafetyCheck = {
        id: draft.id,
        userId: uid,
        bikeId,
        createdAt: draft.existing?.createdAt ?? now,
        updatedAt: now,
        area: draft.area,
        date: draft.date,
        status: draft.status,
        summary: draft.summary,
        measurements: draft.measurements,
        note: draft.note,
        photoPath: draft.photoPath,
        clientRef: draft.existing?.clientRef ?? draft.id,
      };
      await safetyRepository.save(uid, record, draft.existing === undefined);
      return record;
    },
    successMessage: 'Condition check logged',
    onSuccess: () => {
      options.onSaved?.();
      if (router.canGoBack()) router.back();
      else router.replace('/records/safety');
    },
  });
}

export function useDeleteSafetyCheck(options: { onDeleted?: () => void } = {}) {
  const ctx = useGarageContext();
  return useRecordMutation<string>({
    mutationFn: async (id) => {
      const { uid } = requireGarage(ctx);
      await safetyRepository.remove(uid, id);
    },
    successMessage: 'Check removed',
    onSuccess: () => options.onDeleted?.(),
  });
}

export function useNewRecordIds() {
  const ctx = useGarageContext();
  return {
    document: () => (ctx ? documentRepository.newId() : 'pending'),
    warranty: () => (ctx ? warrantyRepository.newId() : 'pending'),
    safety: () => (ctx ? safetyRepository.newId() : 'pending'),
  };
}

import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  ButtonRow,
  ChipGroup,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Footnote,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  TextArea,
} from '@/components';
import { useWarranties } from '@/features/records/useRecordQueries';
import {
  useDeleteWarranty,
  useNewRecordIds,
  useSaveWarranty,
} from '@/features/records/useRecordsMutations';
import { useSetClaimStatus, type ClaimStatus } from '@/features/records/ui/RecordsWrites';
import { toInteger, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import { warrantySchema } from '@/validation/schemas';
import type { Warranty } from '@/types';

const CLAIM_OPTIONS: readonly { value: ClaimStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'open', label: 'Open' },
  { value: 'settled', label: 'Settled' },
  { value: 'rejected', label: 'Rejected' },
];

export default function WarrantyEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const warranties = useWarranties();

  if (editingId && warranties.isPending) {
    return (
      <Screen testID="screen-warranty">
        <ScreenHeader title="Warranty" />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? ((warranties.data ?? []).find((w) => w.id === editingId) ?? null) : null;

  return <WarrantyForm key={existing?.id ?? 'new'} existing={existing} />;
}

function WarrantyForm({ existing }: { existing: Warranty | null }) {
  const router = useRouter();
  const ids = useNewRecordIds();

  const generatedId = useStableId(ids.warranty);
  const recordId = existing?.id ?? generatedId;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [provider, setProvider] = useState(existing?.provider ?? '');
  const [purchasedFrom, setPurchasedFrom] = useState(existing?.purchasedFrom ?? '');
  const [coverage, setCoverage] = useState(existing?.coverage ?? '');
  const [validUntil, setValidUntil] = useState<string | null>(existing?.validUntil ?? null);
  const [reminderDays, setReminderDays] = useState(
    existing === null
      ? '30'
      : existing.reminderDaysBefore === null
        ? ''
        : String(existing.reminderDaysBefore),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveWarranty = useSaveWarranty();
  const setClaim = useSetClaimStatus();
  const deleteWarranty = useDeleteWarranty({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/records/warranties');
    },
  });

  const submit = async () => {
    const result = warrantySchema.safeParse({
      title: title.trim(),
      provider: toTrimmed(provider),
      purchasedFrom: toTrimmed(purchasedFrom),
      coverage: toTrimmed(coverage),
      validUntil,
      reminderDaysBefore: reminderDays.trim() === '' ? null : toInteger(reminderDays),
    });

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    await saveWarranty.submit({
      id: recordId,
      ...result.data,
      ...(existing ? { existing } : {}),
    });
  };

  return (
    <Screen testID="screen-warranty">
      <ScreenHeader title="Warranty" />

      <Stack gap={12}>
        <FieldRow>
          <Field label="What is covered" error={errors.title ?? null} flex={1.4}>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Battery · Hamko MF9"
              autoCapitalize="sentences"
              size="compact"
              padX={14}
              invalid={Boolean(errors.title)}
              testID="input-warranty-title"
            />
          </Field>
          <Field label="Valid until" flex={1}>
            <DateField
              value={validUntil}
              onChange={setValidUntil}
              placeholder="No expiry"
              size="compact"
              padX={14}
              testID="field-valid-until"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Provider" flex={1}>
            <Input
              value={provider}
              onChangeText={setProvider}
              placeholder="Hamko"
              autoCapitalize="words"
              size="compact"
              padX={14}
              testID="input-provider"
            />
          </Field>
          <Field label="Remind before" flex={1}>
            <Input
              value={reminderDays}
              onChangeText={setReminderDays}
              placeholder="30"
              keyboardType="number-pad"
              size="compact"
              padX={14}
              unit="days"
              testID="input-reminder-days"
            />
          </Field>
        </FieldRow>

        <Field label="Purchased from">
          <Input
            value={purchasedFrom}
            onChangeText={setPurchasedFrom}
            placeholder="Motor House Dhanmondi"
            autoCapitalize="words"
            size="compact"
            padX={14}
            testID="input-purchased-from"
          />
        </Field>

        <Field label="Coverage (optional)">
          <TextArea
            value={coverage}
            onChangeText={setCoverage}
            placeholder="Replacement · manufacturing defects"
            rows={2}
            testID="input-coverage"
          />
        </Field>

        {existing ? (
          <Field label="Claim status">
            <ChipGroup
              options={CLAIM_OPTIONS}
              value={existing.claimStatus}
              onChange={(next) => void setClaim.submit({ id: existing.id, claimStatus: next })}
              tone="warn"
              testID="chips-claim-status"
            />
          </Field>
        ) : null}

        {/* Riders ask why a lapsed warranty is still listed. It is listed
            because a buyer asking what was covered and when is exactly the
            question it answers. */}
        <Footnote style={{ marginTop: 2 }}>
          Expired warranties are kept — evidence of cover matters at resale.
        </Footnote>

        <Button
          label={existing ? 'Save changes' : 'Save warranty'}
          onPress={submit}
          size="large"
          loading={saveWarranty.isPending}
          testID="cta-save-warranty"
        />

        {existing ? (
          <ButtonRow>
            <Button
              label="Delete"
              variant="secondary"
              size="medium"
              onPress={() => setDeleteOpen(true)}
              flex
              testID="cta-delete-warranty"
            />
          </ButtonRow>
        ) : null}
      </Stack>

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this warranty?"
        message="The record and its reminder are removed. This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteWarranty.isPending}
        onConfirm={() => existing && deleteWarranty.submit(existing.id)}
        testID="dialog-delete-warranty"
      />
    </Screen>
  );
}

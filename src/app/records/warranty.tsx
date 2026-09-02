import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Banner,
  Button,
  ButtonRow,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  TextArea,
  Txt,
} from '@/components';
import { useWarranties } from '@/features/records/useRecordQueries';
import {
  useDeleteWarranty,
  useNewRecordIds,
  useSaveWarranty,
  useStartWarrantyClaim,
} from '@/features/records/useRecordsMutations';
import { toInteger, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import { warrantySchema } from '@/validation/schemas';
import type { Warranty } from '@/types';
import { daysBetween, todayIso } from '@/utils/date';

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
  const startClaim = useStartWarrantyClaim();
  const deleteWarranty = useDeleteWarranty({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/records/warranties');
    },
  });

  const days = validUntil === null ? null : daysBetween(todayIso(), validUntil);

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
      <ScreenHeader title={existing ? existing.title : 'Add warranty'} />

      <Stack gap={14}>
        <Field label="What is covered" error={errors.title ?? null}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Battery — Hamko HB12"
            autoCapitalize="sentences"
            invalid={Boolean(errors.title)}
            testID="input-warranty-title"
          />
        </Field>

        <FieldRow>
          <Field label="Provider" flex={1}>
            <Input
              value={provider}
              onChangeText={setProvider}
              placeholder="Hamko"
              autoCapitalize="words"
              size="compact"
              testID="input-provider"
            />
          </Field>
          <Field label="Purchased from" flex={1}>
            <Input
              value={purchasedFrom}
              onChangeText={setPurchasedFrom}
              placeholder="Rahim Moto Care"
              autoCapitalize="words"
              size="compact"
              testID="input-purchased-from"
            />
          </Field>
        </FieldRow>

        <Field label="Coverage (optional)">
          <TextArea
            value={coverage}
            onChangeText={setCoverage}
            placeholder="Replacement · manufacturing defects"
            rows={2}
            testID="input-coverage"
          />
        </Field>

        <FieldRow>
          <Field label="Valid until" flex={1}>
            <DateField value={validUntil} onChange={setValidUntil} placeholder="No expiry" testID="field-valid-until" />
          </Field>
          <Field label="Remind (days before)" flex={1}>
            <Input
              value={reminderDays}
              onChangeText={setReminderDays}
              placeholder="30"
              keyboardType="number-pad"
              size="compact"
              testID="input-reminder-days"
            />
          </Field>
        </FieldRow>

        {days !== null ? (
          <Banner
            tone={days < 0 ? 'bad' : days <= 30 ? 'warn' : 'good'}
            icon={days < 0 ? 'alert' : 'check'}
            message={
              days < 0
                ? `This warranty expired ${Math.abs(days)} days ago.`
                : `Covered for another ${days} days.`
            }
          />
        ) : null}

        <Button
          label={existing ? 'Save changes' : 'Save warranty'}
          onPress={submit}
          loading={saveWarranty.isPending}
          testID="cta-save-warranty"
        />

        {existing ? (
          <>
            {existing.claimStatus === 'none' ? (
              <Button
                label="Start a claim"
                variant="secondary"
                onPress={() => startClaim.submit(existing.id)}
                loading={startClaim.isPending}
                testID="cta-start-claim"
              />
            ) : (
              <Txt role="helper" tone="mut" align="center">
                Claim status: {existing.claimStatus}. Gather the purchase receipt, the warranty card and a photo
                of the serial number.
              </Txt>
            )}

            <ButtonRow>
              <Button
                label="Delete"
                variant="secondary"
                size="medium"
                onPress={() => setDeleteOpen(true)}
                style={{ flex: 1 }}
                testID="cta-delete-warranty"
              />
            </ButtonRow>
          </>
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

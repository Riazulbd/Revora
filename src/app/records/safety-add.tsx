import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  ChoiceGrid,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonList,
  Stack,
  TextArea,
  Txt,
} from '@/components';
import { useSafetyChecks } from '@/features/records/useRecordQueries';
import {
  useDeleteSafetyCheck,
  useNewRecordIds,
  useSaveSafetyCheck,
} from '@/features/records/useRecordsMutations';
import { PhotoField } from '@/features/shared/PhotoField';
import { toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { safetyCheckSchema } from '@/validation/schemas';
import { todayIso } from '@/utils/date';
import type { SafetyArea, SafetyCheck, SafetyStatus } from '@/types';

const AREAS: readonly { value: SafetyArea; label: string }[] = [
  { value: 'tyres', label: 'Tyres' },
  { value: 'chain', label: 'Chain' },
  { value: 'brakes', label: 'Brakes' },
  { value: 'battery', label: 'Battery' },
  { value: 'lights', label: 'Lights' },
];

const STATUSES: readonly { value: SafetyStatus; label: string }[] = [
  { value: 'ok', label: 'OK' },
  { value: 'watch', label: 'Watch' },
  { value: 'action', label: 'Action' },
];

export default function SafetyCheckEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const checks = useSafetyChecks();

  if (editingId && checks.isPending) {
    return (
      <Screen testID="screen-safety-add">
        <ScreenHeader title="Condition check" />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? ((checks.data ?? []).find((c) => c.id === editingId) ?? null) : null;

  return <SafetyCheckForm key={existing?.id ?? 'new'} existing={existing} />;
}

function SafetyCheckForm({ existing }: { existing: SafetyCheck | null }) {
  const router = useRouter();
  const garage = useGarageContext();
  const ids = useNewRecordIds();

  const generatedId = useStableId(ids.safety);
  const recordId = existing?.id ?? generatedId;

  const [area, setArea] = useState<SafetyArea>(existing?.area ?? 'tyres');
  const [status, setStatus] = useState<SafetyStatus>(existing?.status ?? 'ok');
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [front, setFront] = useState(
    typeof existing?.measurements?.frontPsi === 'number' ? String(existing.measurements.frontPsi) : '',
  );
  const [rear, setRear] = useState(
    typeof existing?.measurements?.rearPsi === 'number' ? String(existing.measurements.rearPsi) : '',
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(existing?.photoPath ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveCheck = useSaveSafetyCheck();
  const deleteCheck = useDeleteSafetyCheck({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/records/safety');
    },
  });

  const submit = async () => {
    const result = safetyCheckSchema.safeParse({
      area,
      date,
      status,
      summary: summary.trim(),
      note: toTrimmed(note),
    });

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    const measurements: Record<string, number> = {};
    if (area === 'tyres') {
      const f = Number(front);
      const r = Number(rear);
      if (front.trim() !== '' && Number.isFinite(f)) measurements.frontPsi = f;
      if (rear.trim() !== '' && Number.isFinite(r)) measurements.rearPsi = r;
    }

    let photoPath = photoUri;
    if (photoUri && photoUri.startsWith('file://') && garage) {
      photoPath = (await uploadImageOrKeepLocal({
        uid: garage.uid,
        kind: 'safety',
        recordId,
        localUri: photoUri,
      })).path;
    }

    await saveCheck.submit({
      id: recordId,
      area: result.data.area,
      date: result.data.date,
      status: result.data.status,
      summary: result.data.summary,
      measurements: Object.keys(measurements).length > 0 ? measurements : null,
      note: result.data.note,
      photoPath,
      ...(existing ? { existing } : {}),
    });
  };

  return (
    <Screen testID="screen-safety-add">
      <ScreenHeader title={existing ? 'Condition check' : 'Log condition check'} />

      <Stack gap={14}>
        <Field label="What did you check">
          <ChoiceGrid options={AREAS} value={area} onChange={setArea} />
        </Field>

        <Field label="How is it">
          <Segmented options={STATUSES} value={status} onChange={setStatus} testID="segment-status" />
        </Field>

        <Field label="Summary" error={errors.summary ?? null}>
          <Input
            value={summary}
            onChangeText={setSummary}
            placeholder="F 29 / R 33 psi"
            autoCapitalize="sentences"
            invalid={Boolean(errors.summary)}
            testID="input-summary"
          />
        </Field>

        {area === 'tyres' ? (
          <FieldRow>
            <Field label="Front (psi)" flex={1}>
              <Input
                value={front}
                onChangeText={setFront}
                placeholder="29"
                keyboardType="decimal-pad"
                size="compact"
                testID="input-front-psi"
              />
            </Field>
            <Field label="Rear (psi)" flex={1}>
              <Input
                value={rear}
                onChangeText={setRear}
                placeholder="33"
                keyboardType="decimal-pad"
                size="compact"
                testID="input-rear-psi"
              />
            </Field>
          </FieldRow>
        ) : null}

        <FieldRow>
          <Field label="Date" flex={1}>
            <DateField value={date} onChange={setDate} maximumDate={new Date()} testID="field-check-date" />
          </Field>
        </FieldRow>

        <Field label="Note (optional)">
          <TextArea
            value={note}
            onChangeText={setNote}
            placeholder="Tread depth, visible wear…"
            rows={3}
            testID="input-check-note"
          />
        </Field>

        <PhotoField label="Attach photo" uri={photoUri} onChange={setPhotoUri} testID="field-check-photo" />

        <Button
          label={existing ? 'Save changes' : 'Save check'}
          onPress={submit}
          loading={saveCheck.isPending}
          testID="cta-save-check"
        />

        {existing ? (
          <Button
            label="Delete check"
            variant="secondary"
            size="medium"
            onPress={() => setDeleteOpen(true)}
            testID="cta-delete-check"
          />
        ) : null}

        <Txt role="helper" tone="mut" align="center">
          This is your own condition log, not a mechanical diagnosis.
        </Txt>
      </Stack>

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this check?"
        message="It is removed from your condition log. This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteCheck.isPending}
        onConfirm={() => existing && deleteCheck.submit(existing.id)}
        testID="dialog-delete-check"
      />
    </Screen>
  );
}

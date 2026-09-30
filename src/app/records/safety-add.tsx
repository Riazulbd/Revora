import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  ChipGroup,
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
import { SAFETY_AREA_LABEL, SAFETY_AREAS } from '@/calculations/safety';
import { SAFETY_STATUS_LABEL } from '@/calculations/safetySessions';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useSafetyChecks } from '@/features/records/useRecordQueries';
import {
  useDeleteSafetyCheck,
  useNewRecordIds,
  useSaveSafetyCheck,
} from '@/features/records/useRecordsMutations';
import { RecordsWalkaroundRow } from '@/features/records/ui/RecordsWalkaroundRow';
import { useSaveWalkaround, type WalkaroundMark } from '@/features/records/ui/RecordsWrites';
import { PhotoField } from '@/features/shared/PhotoField';
import { toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { safetyCheckSchema } from '@/validation/schemas';
import { formatDistance } from '@/utils/format';
import { todayIso } from '@/utils/date';
import type { SafetyArea, SafetyCheck, SafetyStatus } from '@/types';

const AREAS: readonly { value: SafetyArea; label: string }[] = SAFETY_AREAS.map((value) => ({
  value,
  label: SAFETY_AREA_LABEL[value],
}));

const STATUSES: readonly { value: SafetyStatus; label: string }[] = (
  ['ok', 'watch', 'action'] as const
).map((value) => ({ value, label: SAFETY_STATUS_LABEL[value] }));

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

  // A new check is a walk-around — one pass of the bike, every area on one
  // screen. Opening an existing one is a different job: correcting a single
  // record, which is the only place a date, a measurement or a photo belongs.
  if (existing === null) return <WalkaroundForm />;

  return <SingleCheckForm key={existing.id} existing={existing} />;
}

type Mark = { status: SafetyStatus | null; summary: string };

function WalkaroundForm() {
  const { units } = useGarage();
  const { analytics } = useGarageData();
  const ids = useNewRecordIds();
  const { area: focusArea } = useLocalSearchParams<{ area?: string }>();

  // One id per area, chosen once, so a retry rewrites the same five documents
  // rather than adding five more.
  const [markIds] = useState<Record<SafetyArea, string>>(() => {
    const out = {} as Record<SafetyArea, string>;
    for (const area of SAFETY_AREAS) out[area] = ids.safety();
    return out;
  });

  const [marks, setMarks] = useState<Record<SafetyArea, Mark>>(() => {
    const out = {} as Record<SafetyArea, Mark>;
    for (const area of SAFETY_AREAS) out[area] = { status: null, summary: '' };
    return out;
  });
  const [errors, setErrors] = useState<Partial<Record<SafetyArea, string>>>({});

  const saveWalkaround = useSaveWalkaround();

  const marked = SAFETY_AREAS.filter((area) => marks[area].status !== null);
  const odometer = formatDistance(analytics?.odometer.currentMetres ?? null, units.distance);

  // The board orders the rows the way a rider walks the bike, but a tap that
  // came from a "never checked" tile belongs at the top of the list.
  const ordered =
    focusArea !== undefined && SAFETY_AREAS.includes(focusArea as SafetyArea)
      ? [focusArea as SafetyArea, ...SAFETY_AREAS.filter((a) => a !== focusArea)]
      : [...SAFETY_AREAS];

  const submit = async () => {
    const next: Partial<Record<SafetyArea, string>> = {};
    const drafts: WalkaroundMark[] = [];

    for (const area of marked) {
      const mark = marks[area];
      const status = mark.status;
      if (status === null) continue;

      // An area marked watch or action is a claim about the motorcycle, and a
      // claim with no words behind it helps nobody in three months' time.
      const summary = status === 'ok' ? SAFETY_STATUS_LABEL.ok : mark.summary.trim();
      const parsed = safetyCheckSchema.safeParse({
        area,
        date: todayIso(),
        status,
        summary,
        note: null,
      });

      if (!parsed.success) {
        next[area] = parsed.error.issues[0]?.message ?? 'Describe what you found.';
        continue;
      }

      drafts.push({ id: markIds[area], area, status, summary: parsed.data.summary });
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || drafts.length === 0) return;

    await saveWalkaround.submit({ date: todayIso(), marks: drafts });
  };

  return (
    <Screen testID="screen-safety-add">
      <ScreenHeader title="Walk-around check" style={{ marginBottom: 4 }} />

      <Txt role="meta" tone="mut" style={{ marginBottom: 14 }}>
        Today · {odometer} · tap one per row, top to bottom
      </Txt>

      <Stack gap={10}>
        {ordered.map((area) => (
          <RecordsWalkaroundRow
            key={area}
            area={area}
            label={SAFETY_AREA_LABEL[area]}
            status={marks[area].status}
            onStatus={(status) => setMarks((prev) => ({ ...prev, [area]: { ...prev[area], status } }))}
            summary={marks[area].summary}
            onSummary={(summary) => setMarks((prev) => ({ ...prev, [area]: { ...prev[area], summary } }))}
            error={errors[area] ?? null}
            testID={`safety-mark-${area}`}
          />
        ))}
      </Stack>

      <Button
        label="Save check"
        onPress={submit}
        size="large"
        loading={saveWalkaround.isPending}
        disabled={marked.length === 0}
        accessibilityHint={marked.length === 0 ? 'Mark at least one area first' : undefined}
        style={{ marginTop: 16 }}
        testID="cta-save-check"
      />

      <Txt role="helper" tone="mut" align="center" style={{ marginTop: 12 }}>
        An area you leave alone records nothing — it stays whatever the last check said.
      </Txt>
    </Screen>
  );
}

/** Correcting one stored check: the only place a date, a measurement or a photo belongs. */
function SingleCheckForm({ existing }: { existing: SafetyCheck }) {
  const router = useRouter();
  const garage = useGarageContext();

  const recordId = useStableId(() => existing.id);

  const [area, setArea] = useState<SafetyArea>(existing.area);
  const [status, setStatus] = useState<SafetyStatus>(existing.status);
  const [date, setDate] = useState(existing.date);
  const [summary, setSummary] = useState(existing.summary);
  const [front, setFront] = useState(
    typeof existing.measurements?.frontPsi === 'number' ? String(existing.measurements.frontPsi) : '',
  );
  const [rear, setRear] = useState(
    typeof existing.measurements?.rearPsi === 'number' ? String(existing.measurements.rearPsi) : '',
  );
  const [note, setNote] = useState(existing.note ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(existing.photoPath ?? null);
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
      existing,
    });
  };

  return (
    <Screen testID="screen-safety-add">
      <ScreenHeader title="Condition check" />

      <Stack gap={14}>
        <Field label="What did you check">
          <ChipGroup options={AREAS} value={area} onChange={setArea} testID="chips-check-area" />
        </Field>

        <Field label="How is it">
          <Segmented options={STATUSES} value={status} onChange={setStatus} testID="segment-status" />
        </Field>

        <Field label="Summary" error={errors.summary ?? null}>
          <Input
            value={summary}
            onChangeText={setSummary}
            placeholder="Front lever spongy"
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
                size="mini"
                testID="input-front-psi"
              />
            </Field>
            <Field label="Rear (psi)" flex={1}>
              <Input
                value={rear}
                onChangeText={setRear}
                placeholder="33"
                keyboardType="decimal-pad"
                size="mini"
                testID="input-rear-psi"
              />
            </Field>
          </FieldRow>
        ) : null}

        <Field label="Date">
          <DateField value={date} onChange={setDate} maximumDate={new Date()} testID="field-check-date" />
        </Field>

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
          label="Save changes"
          onPress={submit}
          size="large"
          loading={saveCheck.isPending}
          testID="cta-save-check"
        />

        <Button
          label="Delete check"
          variant="secondary"
          size="medium"
          onPress={() => setDeleteOpen(true)}
          testID="cta-delete-check"
        />

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
        onConfirm={() => deleteCheck.submit(existing.id)}
        testID="dialog-delete-check"
      />
    </Screen>
  );
}

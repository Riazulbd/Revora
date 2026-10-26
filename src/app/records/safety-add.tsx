import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  Card,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonList,
  TextArea,
  Txt,
  type SegmentedOption,
} from '@/components';
import { SAFETY_AREA_LABEL, SAFETY_AREAS } from '@/calculations/safety';
import { SAFETY_STATUS_LABEL } from '@/calculations/safetySessions';
import { useSafetyChecks } from '@/features/records/useRecordQueries';
import { useDeleteSafetyCheck, useNewRecordIds, useSaveSafetyCheck } from '@/features/records/useRecordsMutations';
import { ChipRow, RecordsChip, StatusChoice } from '@/features/records/ui/RecordsChrome';
import { useSaveWalkaround, type WalkaroundMark } from '@/features/records/ui/RecordsWrites';
import { PhotoField } from '@/features/shared/PhotoField';
import { toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { safetyCheckSchema } from '@/validation/schemas';
import { useTheme } from '@/theme';
import { formatShortDate, todayIso } from '@/utils/date';
import type { SafetyArea, SafetyCheck, SafetyStatus } from '@/types';

type Kind = 'walkaround' | 'condition';

const KINDS: readonly SegmentedOption<Kind>[] = [
  { value: 'walkaround', label: 'Walk-around' },
  { value: 'condition', label: 'Condition' },
];

/**
 * A safety check (Figma `R6 Records — Add safety check`).
 *
 * One form, two kinds. A walk-around marks several areas at once with one
 * finding — the quick pass before a ride; a condition check is one area, with
 * the measurements and the photo that belong to a single record. Either way
 * the data model stores one check per area and always will: a stored
 * "session" would be a derived thing with somewhere to go stale.
 */
export default function SafetyCheckEditorRoute() {
  const { id: editingId, area: focusArea } = useLocalSearchParams<{ id?: string; area?: string }>();
  const checks = useSafetyChecks();

  if (editingId && checks.isPending) {
    return (
      <Screen testID="screen-safety-add" contentStyle={{ gap: 16 }}>
        <ScreenHeader title="Condition check" icon="x" style={{ marginBottom: 0 }} />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? ((checks.data ?? []).find((c) => c.id === editingId) ?? null) : null;
  const focus = focusArea !== undefined && SAFETY_AREAS.includes(focusArea as SafetyArea) ? (focusArea as SafetyArea) : null;

  return <CheckForm key={existing?.id ?? 'new'} existing={existing} focus={focus} />;
}

function CheckForm({ existing, focus }: { existing: SafetyCheck | null; focus: SafetyArea | null }) {
  const router = useRouter();
  const { c } = useTheme();
  const garage = useGarageContext();
  const ids = useNewRecordIds();

  // Correcting one stored check is always a condition check: a single record.
  const [kind, setKind] = useState<Kind>(existing === null && focus === null ? 'walkaround' : 'condition');
  const [areas, setAreas] = useState<SafetyArea[]>(existing ? [existing.area] : focus ? [focus] : []);
  const [status, setStatus] = useState<SafetyStatus | null>(existing?.status ?? null);
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [dateOpen, setDateOpen] = useState(false);
  const [summary, setSummary] = useState(existing && existing.summary.toLowerCase() !== SAFETY_STATUS_LABEL[existing.status].toLowerCase() ? existing.summary : '');
  const [front, setFront] = useState(typeof existing?.measurements?.frontPsi === 'number' ? String(existing.measurements.frontPsi) : '');
  const [rear, setRear] = useState(typeof existing?.measurements?.rearPsi === 'number' ? String(existing.measurements.rearPsi) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(existing?.photoPath ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  // One id per area, chosen once, so a retry rewrites the same documents
  // rather than adding more.
  const [markIds] = useState<Record<SafetyArea, string>>(() => {
    const out = {} as Record<SafetyArea, string>;
    for (const area of SAFETY_AREAS) out[area] = ids.safety();
    return out;
  });
  const recordId = useStableId(() => existing?.id ?? markIds.tyres);

  const saveWalkaround = useSaveWalkaround();
  const saveCheck = useSaveSafetyCheck();
  const deleteCheck = useDeleteSafetyCheck({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/records/safety');
    },
  });

  const toggleArea = (area: SafetyArea) => {
    if (kind === 'condition') {
      setAreas([area]);
      return;
    }
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  };

  const switchKind = (next: Kind) => {
    setKind(next);
    if (next === 'condition' && areas.length > 1) setAreas(areas.slice(0, 1));
  };

  const tyres = areas.includes('tyres');

  const measurements = (): Record<string, number> | null => {
    if (!tyres) return null;
    const out: Record<string, number> = {};
    const f = Number(front);
    const r = Number(rear);
    if (front.trim() !== '' && Number.isFinite(f)) out.frontPsi = f;
    if (rear.trim() !== '' && Number.isFinite(r)) out.rearPsi = r;
    return Object.keys(out).length > 0 ? out : null;
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (areas.length === 0) next.areas = 'Pick what you checked.';
    if (status === null) next.status = 'Say how it is.';

    // An area marked watch or bad is a claim about the motorcycle, and a claim
    // with no words behind it helps nobody in three months' time.
    const words = status === 'ok' && summary.trim() === '' ? SAFETY_STATUS_LABEL.ok : summary.trim();
    const parsed =
      status === null
        ? null
        : safetyCheckSchema.safeParse({ area: areas[0] ?? 'tyres', date, status, summary: words, note: toTrimmed(note) });
    if (parsed !== null && !parsed.success) {
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || status === null || parsed === null || !parsed.success) return;

    if (kind === 'walkaround' && existing === null) {
      const marks: WalkaroundMark[] = areas.map((area) => ({ id: markIds[area], area, status, summary: parsed.data.summary }));
      await saveWalkaround.submit({ date, marks });
      return;
    }

    let photoPath = photoUri;
    if (photoUri && photoUri.startsWith('file://') && garage) {
      photoPath = (await uploadImageOrKeepLocal({ uid: garage.uid, kind: 'safety', recordId, localUri: photoUri })).path;
    }

    await saveCheck.submit({
      id: recordId,
      area: parsed.data.area,
      date: parsed.data.date,
      status: parsed.data.status,
      summary: parsed.data.summary,
      measurements: measurements(),
      note: parsed.data.note,
      photoPath,
      ...(existing ? { existing } : {}),
    });
  };

  const busy = saveWalkaround.isPending || saveCheck.isPending;
  const today = todayIso();

  return (
    <Screen testID="screen-safety-add" contentStyle={{ gap: 16 }}>
      <ScreenHeader title={kind === 'walkaround' ? 'Walk-around check' : 'Condition check'} icon="x" style={{ marginBottom: 0 }} />

      {existing ? null : <Segmented options={KINDS} value={kind} onChange={switchKind} size="medium" testID="segment-check-kind" />}

      {/* Figma `Areas`: what was checked, and when. */}
      <Card style={{ gap: 10 }} testID="card-check-areas">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Txt role="rowTitle">What did you check</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={`Date, ${formatShortDate(date)}`} onPress={() => setDateOpen((open) => !open)} hitSlop={12} testID="cta-check-date">
            <Txt role="micro" color={c.accText}>
              {date === today ? `Today, ${formatShortDate(date)}` : formatShortDate(date)}
            </Txt>
          </Pressable>
        </View>
        {dateOpen ? <DateField value={date} onChange={setDate} maximumDate={new Date()} todayLabel="Today, " format={formatShortDate} testID="field-check-date" /> : null}
        <ChipRow>
          {SAFETY_AREAS.map((area) => (
            <RecordsChip
              key={area}
              label={SAFETY_AREA_LABEL[area]}
              selected={areas.includes(area)}
              onPress={() => toggleArea(area)}
              height={44}
              size={14}
              tick
              testID={`chips-check-area-${area}`}
            />
          ))}
        </ChipRow>
        {errors.areas ? (
          <Txt role="micro" tone="bad">
            {errors.areas}
          </Txt>
        ) : null}
      </Card>

      {/* Figma `Status`. */}
      <Card style={{ gap: 10 }} testID="card-check-status">
        <Txt role="rowTitle">How is it</Txt>
        <StatusChoice value={status} onChange={setStatus} testID="segment-status" />
        {errors.status ? (
          <Txt role="micro" tone="bad">
            {errors.status}
          </Txt>
        ) : null}
      </Card>

      {/* Figma `Details`: pressures for the tyres, the finding, a note, a photo. */}
      <Card style={{ gap: 14 }} testID="card-check-details">
        {tyres ? (
          <FieldRow gap={10}>
            <Field label="Front (psi)" flex={1}>
              <Input value={front} onChangeText={setFront} placeholder="29" keyboardType="decimal-pad" testID="input-front-psi" />
            </Field>
            <Field label="Rear (psi)" flex={1}>
              <Input value={rear} onChangeText={setRear} placeholder="33" keyboardType="decimal-pad" testID="input-rear-psi" />
            </Field>
          </FieldRow>
        ) : null}

        <Field label="Summary" error={errors.summary ?? null}>
          <Input
            value={summary}
            onChangeText={setSummary}
            placeholder={status === 'ok' ? 'All fine (optional)' : 'Front lever spongy'}
            autoCapitalize="sentences"
            invalid={Boolean(errors.summary)}
            testID="input-summary"
          />
        </Field>

        <Field label="Note (optional)">
          <TextArea value={note} onChangeText={setNote} placeholder="Tread depth, visible wear…" rows={2} testID="input-check-note" />
        </Field>

        {/* A walk-around writes several records; a photo belongs to one. */}
        {kind === 'condition' || existing ? <PhotoField label="Attach photo" uri={photoUri} onChange={setPhotoUri} testID="field-check-photo" /> : null}
      </Card>

      <Button label={existing ? 'Save changes' : 'Save check'} size="xlarge" onPress={submit} loading={busy} testID="cta-save-check" />

      {existing ? (
        <Button label="Delete check" icon="trash" variant="ghost" tone="bad" size="medium" onPress={() => setDeleteOpen(true)} testID="cta-delete-check" />
      ) : (
        <Txt role="helper" tone="mut" align="center">
          An area you leave alone records nothing — it stays whatever the last check said.
        </Txt>
      )}

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

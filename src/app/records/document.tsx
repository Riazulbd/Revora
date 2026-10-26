import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  Card,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Icon,
  IconSquareButton,
  Input,
  PhotoPanel,
  Screen,
  ScreenHeader,
  SkeletonList,
  Toggle,
  Txt,
} from '@/components';
import { useDocuments } from '@/features/records/useRecordQueries';
import {
  useDeleteDocument,
  useNewRecordIds,
  useSaveDocument,
} from '@/features/records/useRecordsMutations';
import { AttachPhotoPanel, ChipRow, RecordsChip } from '@/features/records/ui/RecordsChrome';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { DOCUMENT_KIND_LABEL, DOCUMENT_REFERENCE_LABEL, expiryLabel, isTimeLimited } from '@/calculations/documents';
import { documentSchema } from '@/validation/schemas';
import { daysBetween, todayIso } from '@/utils/date';
import { useTheme } from '@/theme';
import type { DocumentKind, VaultDocument } from '@/types';

/** Board order: the papers a rider is most often asked for first. */
const KINDS: readonly { value: DocumentKind; label: string }[] = [
  { value: 'tax_token', label: 'Tax token' },
  { value: 'registration', label: 'Registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'licence', label: 'Licence' },
  { value: 'fitness', label: 'Fitness certificate' },
  { value: 'custom', label: 'Custom' },
];

const DEFAULT_TITLE: Record<DocumentKind, string> = {
  registration: 'Registration',
  insurance: 'Insurance',
  tax_token: 'Tax token',
  fitness: 'Fitness certificate',
  licence: 'Driving licence',
  custom: '',
};

/**
 * Add / edit a paper (Figma `R2 Records — Document detail`).
 *
 * The kind names the document — the board drops the name field and keeps the
 * chips — so only a custom document has a name of its own. A document that
 * exists because it runs out cannot be saved without the date it runs out on:
 * without it the reminder that makes it worth keeping can never fire.
 */
export default function DocumentEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const documents = useDocuments();

  if (editingId && documents.isPending) {
    return (
      <Screen testID="screen-document" contentStyle={{ gap: 16 }}>
        <ScreenHeader title="Document" style={{ marginBottom: 0 }} />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? ((documents.data ?? []).find((d) => d.id === editingId) ?? null) : null;

  return <DocumentForm key={existing?.id ?? 'new'} existing={existing} />;
}

function DocumentForm({ existing }: { existing: VaultDocument | null }) {
  const router = useRouter();
  const { c } = useTheme();
  const garage = useGarageContext();
  const ids = useNewRecordIds();
  const picker = useImagePicker();

  const generatedId = useStableId(ids.document);
  const recordId = existing?.id ?? generatedId;

  const [kind, setKind] = useState<DocumentKind>(existing?.kind ?? 'tax_token');
  const [title, setTitle] = useState(existing?.title ?? DEFAULT_TITLE.tax_token);
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [issuedOn, setIssuedOn] = useState<string | null>(existing?.issuedOn ?? null);
  const [expiresOn, setExpiresOn] = useState<string | null>(existing?.expiresOn ?? null);
  const [keepOfflineCopy, setKeepOfflineCopy] = useState(existing?.keepOfflineCopy ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [fileUri, setFileUri] = useState<string | null>(existing?.filePath ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveDocument = useSaveDocument();
  const deleteDocument = useDeleteDocument({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/records/vault');
    },
  });

  const days = expiresOn === null ? null : daysBetween(todayIso(), expiresOn);
  const timeLimited = isTimeLimited(kind);
  const custom = kind === 'custom';
  // The board's own case: a document that exists because it runs out, with no
  // date on it. Nothing can be saved from here that a reminder could ever use.
  const expiryMissing = timeLimited && expiresOn === null;

  const submit = async () => {
    const result = documentSchema.safeParse({
      kind,
      title: title.trim(),
      reference: toTrimmed(reference),
      issuedOn,
      expiresOn,
      keepOfflineCopy,
      notes: toTrimmed(notes),
    });

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    let filePath = fileUri;
    if (fileUri && fileUri.startsWith('file://') && garage) {
      filePath = (await uploadImageOrKeepLocal({
        uid: garage.uid,
        kind: 'document',
        recordId,
        localUri: fileUri,
      })).path;
    }

    await saveDocument.submit({
      id: recordId,
      kind: result.data.kind,
      customKindLabel: result.data.kind === 'custom' ? result.data.title : null,
      title: result.data.title,
      reference: result.data.reference,
      issuedOn: result.data.issuedOn,
      expiresOn: result.data.expiresOn,
      keepOfflineCopy: result.data.keepOfflineCopy,
      filePath,
      notes: result.data.notes,
      ...(existing ? { existing } : {}),
    });
  };

  // Figma `Remind`: the reminder the date buys, in the warn tint under it.
  const remind =
    expiryMissing
      ? { tone: 'bad' as const, icon: 'triangleAlert' as const, text: `A ${DOCUMENT_KIND_LABEL[kind].toLowerCase()} is issued for a term — add the date it runs out so the reminder can fire.` }
      : days === null
        ? null
        : days < 0
          ? { tone: 'bad' as const, icon: 'triangleAlert' as const, text: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago — renew this as soon as you can.` }
          : days <= 30
            ? { tone: 'warn' as const, icon: 'bell' as const, text: `Due in ${days} day${days === 1 ? '' : 's'}. We'll remind you at ${days > 7 ? '7 and 3' : '3'} days.` }
            : { tone: 'good' as const, icon: 'bell' as const, text: `Valid for another ${days} days. Reminders at 30, 7 and 3 days before.` };

  return (
    <Screen testID="screen-document" contentStyle={{ gap: 16 }}>
      <ScreenHeader
        title="Document"
        style={{ marginBottom: 0 }}
        {...(existing
          ? { action: <IconSquareButton icon="trash" color={c.badIcon} accessibilityLabel="Delete document" onPress={() => setDeleteOpen(true)} testID="cta-delete-document" /> }
          : {})}
      />

      {/* Figma `Type chips`. */}
      <ChipRow>
        {KINDS.map((option) => (
          <RecordsChip
            key={option.value}
            label={option.label}
            selected={kind === option.value}
            onPress={() => {
              setKind(option.value);
              if (option.value === 'custom') {
                if (!existing) setTitle('');
              } else {
                setTitle(DEFAULT_TITLE[option.value]);
              }
            }}
            testID={`chips-document-kind-${option.value}`}
          />
        ))}
      </ChipRow>

      {/* Figma `Photo`. */}
      {fileUri ? (
        <PhotoPanel
          uri={fileUri}
          height={168}
          accessibilityLabel="Document photo"
          onPress={() => void picker.choose('Document photo').then((uri) => uri && setFileUri(uri))}
          testID="field-document-photo"
        />
      ) : (
        <AttachPhotoPanel title="Attach document photo" hint="Front side, flat and in good light" onChange={setFileUri} testID="field-document-photo" />
      )}

      {/* Figma `Fields`. */}
      <Card style={{ gap: 14 }}>
        {custom ? (
          <Field label="Name" error={errors.title ?? null}>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Purchase invoice"
              autoCapitalize="sentences"
              invalid={Boolean(errors.title)}
              testID="input-document-title"
            />
          </Field>
        ) : null}

        <Field label={custom ? 'Number' : DOCUMENT_REFERENCE_LABEL[kind]}>
          <Input
            value={reference}
            onChangeText={setReference}
            placeholder="TP-4432871"
            autoCapitalize="characters"
            autoCorrect={false}
            testID="input-document-reference"
          />
        </Field>

        {/* A document with a term is defined by its two dates, so they sit
            together rather than with the expiry alone buried further down. */}
        <FieldRow gap={10}>
          <Field label="Issued on" flex={1}>
            <DateField value={issuedOn} onChange={setIssuedOn} placeholder="Not recorded" todayLabel={null} weight="regular" testID="field-document-issued" />
          </Field>
          <Field label={expiryLabel(kind)} flex={1} error={errors.expiresOn ?? null}>
            <DateField
              value={expiresOn}
              onChange={setExpiresOn}
              placeholder={timeLimited ? 'Pick a date' : 'No expiry'}
              todayLabel={null}
              weight={expiresOn === null ? 'regular' : 'bold'}
              testID="field-document-expiry"
            />
          </Field>
        </FieldRow>

        {remind ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderRadius: 14,
              backgroundColor: remind.tone === 'bad' ? c.badS : remind.tone === 'warn' ? c.warnS : c.goodS,
            }}
            testID="banner-expiry"
          >
            <Icon name={remind.icon} size={20} color={remind.tone === 'bad' ? c.badIcon : remind.tone === 'warn' ? c.warnIcon : c.good} />
            <Txt role="micro" color={remind.tone === 'bad' ? c.bad : remind.tone === 'warn' ? c.warn : c.good} style={{ flex: 1 }}>
              {remind.text}
            </Txt>
          </View>
        ) : null}

        <Field label="Notes (optional)">
          <Input value={notes} onChangeText={setNotes} placeholder="Where the original is kept" testID="input-document-notes" />
        </Field>
      </Card>

      {/* Figma `Offline toggle`: the promise the whole vault is built on. */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt role="rowTitle">Keep an offline copy</Txt>
          <Txt role="meta" tone="mut">
            Show it at a checkpoint without signal
          </Txt>
        </View>
        <Toggle value={keepOfflineCopy} onChange={setKeepOfflineCopy} accessibilityLabel="Keep an offline copy" testID="toggle-offline-copy" />
      </Card>

      <Button
        label={existing ? 'Save changes' : 'Save document'}
        size="xlarge"
        onPress={submit}
        loading={saveDocument.isPending}
        disabled={expiryMissing}
        {...(expiryMissing ? { accessibilityHint: 'Add the valid-until date first' } : {})}
        testID="cta-save-document"
      />

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this document?"
        message="The record and its photo are removed, and its reminders stop. This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteDocument.isPending}
        onConfirm={() => existing && deleteDocument.submit(existing.id)}
        testID="dialog-delete-document"
      />
    </Screen>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Banner,
  Button,
  ButtonRow,
  Card,
  ChoiceGrid,
  CopyButton,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  ToggleRow,
  Txt,
} from '@/components';
import { useDocuments } from '@/features/records/useRecordQueries';
import {
  useDeleteDocument,
  useNewRecordIds,
  useSaveDocument,
} from '@/features/records/useRecordsMutations';
import { PhotoField } from '@/features/shared/PhotoField';
import { toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_REFERENCE_LABEL,
  expiryLabel,
  isTimeLimited,
} from '@/calculations/documents';
import { documentSchema } from '@/validation/schemas';
import { daysBetween, todayIso } from '@/utils/date';
import type { DocumentKind, VaultDocument } from '@/types';

const KINDS: readonly { value: DocumentKind; label: string }[] = (
  ['registration', 'insurance', 'tax_token', 'fitness', 'licence', 'custom'] as const
).map((value) => ({ value, label: value === 'licence' ? 'Licence' : DOCUMENT_KIND_LABEL[value] }));

const DEFAULT_TITLE: Record<DocumentKind, string> = {
  registration: 'Registration',
  insurance: 'Insurance',
  tax_token: 'Tax token',
  fitness: 'Fitness certificate',
  licence: 'Driving licence',
  custom: '',
};

export default function DocumentEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const documents = useDocuments();

  if (editingId && documents.isPending) {
    return (
      <Screen testID="screen-document">
        <ScreenHeader title="Document" />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? ((documents.data ?? []).find((d) => d.id === editingId) ?? null) : null;

  return <DocumentForm key={existing?.id ?? 'new'} existing={existing} />;
}

function DocumentForm({ existing }: { existing: VaultDocument | null }) {
  const router = useRouter();
  const garage = useGarageContext();
  const ids = useNewRecordIds();

  const generatedId = useStableId(ids.document);
  const recordId = existing?.id ?? generatedId;

  const [kind, setKind] = useState<DocumentKind>(existing?.kind ?? 'registration');
  const [title, setTitle] = useState(existing?.title ?? DEFAULT_TITLE.registration);
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

  return (
    <Screen testID="screen-document">
      <ScreenHeader title={existing ? existing.title : 'Add document'} />

      <Stack gap={14}>
        <Field label="Type">
          <ChoiceGrid
            options={KINDS}
            value={kind}
            onChange={(next) => {
              setKind(next);
              if (!existing && DEFAULT_TITLE[next] !== '') setTitle(DEFAULT_TITLE[next]);
            }}
          />
        </Field>

        <Field label="Name" error={errors.title ?? null}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Insurance — 3rd party"
            autoCapitalize="sentences"
            invalid={Boolean(errors.title)}
            testID="input-document-title"
          />
        </Field>

        <Field label={`${DOCUMENT_REFERENCE_LABEL[kind]} (optional)`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Input
              value={reference}
              onChangeText={setReference}
              placeholder="TP-4432871"
              autoCapitalize="characters"
              autoCorrect={false}
              size="compact"
              style={{ flex: 1 }}
              testID="input-document-reference"
            />
            {reference.trim() === '' ? null : (
              <CopyButton
                label={DOCUMENT_REFERENCE_LABEL[kind]}
                value={reference.trim()}
                testID="copy-document-reference"
              />
            )}
          </View>
        </Field>

        {/* A document with a term is defined by its two dates, so they sit
            together rather than with the expiry alone buried further down. */}
        <FieldRow>
          <Field label="Issued on (optional)" flex={1}>
            <DateField
              value={issuedOn}
              onChange={setIssuedOn}
              placeholder="Not recorded"
              testID="field-document-issued"
            />
          </Field>
          <Field label={expiryLabel(kind)} error={errors.expiresOn ?? null} flex={1}>
            <DateField
              value={expiresOn}
              onChange={setExpiresOn}
              placeholder={timeLimited ? 'Required' : 'No expiry'}
              testID="field-document-expiry"
            />
          </Field>
        </FieldRow>

        <Txt role="helper" tone="mut">
          {timeLimited
            ? `A ${DOCUMENT_KIND_LABEL[kind].toLowerCase()} is issued for a term. Revora reminds you at 30, 14 and 3 days before it runs out.`
            : 'Leave the expiry blank for a document that never runs out.'}
        </Txt>

        {days !== null ? (
          <Banner
            tone={days < 0 ? 'bad' : days <= 30 ? 'warn' : 'good'}
            icon={days < 0 ? 'alert' : 'check'}
            message={
              days < 0
                ? `Expired ${Math.abs(days)} days ago — renew this as soon as you can.`
                : days <= 30
                  ? `Expiring in ${days} days — reminders at 30, 14 and 3 days.`
                  : `Valid for another ${days} days. Reminders start 30 days before expiry.`
            }
            testID="banner-expiry"
          />
        ) : null}

        <Card variant="list" style={{ paddingVertical: 4 }}>
          <ToggleRow
            title="Keep a copy on this device"
            description="The photo stays available with no connection"
            value={keepOfflineCopy}
            onChange={setKeepOfflineCopy}
            testID="toggle-offline-copy"
          />
        </Card>

        <PhotoField
          label="Attach document photo"
          uri={fileUri}
          onChange={setFileUri}
          testID="field-document-photo"
        />

        <Field label="Notes (optional)">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Where the original is kept"
            size="compact"
            testID="input-document-notes"
          />
        </Field>

        <Button
          label={existing ? 'Save changes' : 'Save document'}
          onPress={submit}
          loading={saveDocument.isPending}
          testID="cta-save-document"
        />

        {existing ? (
          <ButtonRow>
            <Button
              label="Delete"
              variant="secondary"
              size="medium"
              onPress={() => setDeleteOpen(true)}
              style={{ flex: 1 }}
              testID="cta-delete-document"
            />
          </ButtonRow>
        ) : null}
      </Stack>

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

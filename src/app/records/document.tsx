import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Banner,
  Button,
  ButtonRow,
  Card,
  ChipGroup,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Icon,
  Input,
  RowIcon,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Toggle,
  Txt,
  useCopy,
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
import { HIT_SLOP, useTheme } from '@/theme';
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
  const custom = kind === 'custom';
  // The board's own case: a document that exists because it runs out, with no
  // date on it. Nothing can be saved from here that a reminder could ever use.
  const expiryMissing = timeLimited && expiresOn === null;

  // The kind names the document — the board drops the name field entirely and
  // puts "Tax token" in the header. Only a custom document has a name of its own.
  const heading = custom
    ? title.trim() === ''
      ? 'Custom document'
      : title.trim()
    : DOCUMENT_KIND_LABEL[kind];

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
      <ScreenHeader title={heading} />

      <Stack gap={14}>
        <ChipGroup
          options={KINDS}
          value={kind}
          onChange={(next) => {
            setKind(next);
            if (next === 'custom') {
              if (!existing) setTitle('');
            } else {
              setTitle(DEFAULT_TITLE[next]);
            }
          }}
          testID="chips-document-kind"
        />

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

        <Field label={DOCUMENT_REFERENCE_LABEL[kind]}>
          <Input
            value={reference}
            onChangeText={setReference}
            placeholder="TP-4432871"
            autoCapitalize="characters"
            autoCorrect={false}
            padX={14}
            testID="input-document-reference"
            trailing={
              reference.trim() === '' ? undefined : (
                <CopySquare
                  label={DOCUMENT_REFERENCE_LABEL[kind]}
                  value={reference.trim()}
                  testID="copy-document-reference"
                />
              )
            }
          />
        </Field>

        {/* A document with a term is defined by its two dates, so they sit
            together rather than with the expiry alone buried further down. */}
        <FieldRow>
          <Field label="Issued on" flex={1}>
            <DateField
              value={issuedOn}
              onChange={setIssuedOn}
              placeholder="Not recorded"
              padX={14}
              testID="field-document-issued"
            />
          </Field>
          <Field label={expiryLabel(kind)} error={expiryMissing ? 'Pick a date.' : (errors.expiresOn ?? null)} flex={1}>
            <DateField
              value={expiresOn}
              onChange={setExpiresOn}
              placeholder={timeLimited ? 'Pick a date' : 'No expiry'}
              padX={14}
              testID="field-document-expiry"
            />
          </Field>
        </FieldRow>

        {expiryMissing ? (
          <Banner
            tone="bad"
            icon="alertTriangle"
            compact
            lead={`A ${DOCUMENT_KIND_LABEL[kind].toLowerCase()} is issued for a term.`}
            message="Without the end date this is just a photo — the reminder that makes it worth keeping can never fire. Custom documents are exempt."
            testID="banner-expiry"
          />
        ) : days !== null ? (
          <Banner
            tone={days < 0 ? 'bad' : days <= 30 ? 'warn' : 'good'}
            icon={days < 0 ? 'alert' : 'check'}
            compact
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

        <PhotoField
          label="Attach document photo"
          uri={fileUri}
          onChange={setFileUri}
          testID="field-document-photo"
        />

        <OfflineCopyRow value={keepOfflineCopy} onChange={setKeepOfflineCopy} />

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
          size="large"
          loading={saveDocument.isPending}
          disabled={expiryMissing}
          accessibilityHint={expiryMissing ? 'Add the valid-until date first' : undefined}
          testID="cta-save-document"
        />

        {existing ? (
          <ButtonRow>
            <Button
              label="Delete"
              variant="secondary"
              size="medium"
              onPress={() => setDeleteOpen(true)}
              flex
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

/**
 * The 40px copy square the board draws inside the number field.
 *
 * Smaller than the 44px target the guidelines ask for, so the slop makes up the
 * difference rather than the square growing and breaking the field's rhythm.
 */
function CopySquare({ label, value, testID }: { label: string; value: string; testID: string }) {
  const { c } = useTheme();
  const copy = useCopy();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      hitSlop={HIT_SLOP}
      onPress={() => void copy(label, value)}
      testID={testID}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.accS,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name="copy" size={16} color={c.acc} strokeWidth={2} />
    </Pressable>
  );
}

/** "Keep an offline copy" — the promise the whole vault is built on. */
function OfflineCopyRow({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const { c } = useTheme();

  return (
    <Card
      variant="list"
      style={{
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        <RowIcon tone="accent">
          <Icon name="wifiOff" size={17} color={c.acc} strokeWidth={1.8} />
        </RowIcon>
        <View style={{ flexShrink: 1 }}>
          <Txt role="rowTitle">Keep an offline copy</Txt>
          <Txt role="meta" tone="mut" style={{ marginTop: 2 }}>
            Openable with no signal — where you get stopped
          </Txt>
        </View>
      </View>
      <Toggle
        value={value}
        onChange={onChange}
        accessibilityLabel="Keep an offline copy"
        testID="toggle-offline-copy"
      />
    </Card>
  );
}

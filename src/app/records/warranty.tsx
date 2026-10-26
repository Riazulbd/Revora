import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  Card,
  DateField,
  Dialog,
  Eyebrow,
  Field,
  FieldRow,
  Icon,
  IconSquareButton,
  Input,
  RowIcon,
  Screen,
  ScreenHeader,
  SkeletonList,
  Txt,
} from '@/components';
import { warrantyRemainingLabel, warrantyState } from '@/calculations/warranties';
import { useWarranties } from '@/features/records/useRecordQueries';
import {
  useDeleteWarranty,
  useNewRecordIds,
  useSaveWarranty,
} from '@/features/records/useRecordsMutations';
import { InsetSegmented } from '@/features/records/ui/RecordsChrome';
import { useSetClaimStatus, type ClaimStatus } from '@/features/records/ui/RecordsWrites';
import { toInteger, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import { warrantySchema } from '@/validation/schemas';
import { useTheme } from '@/theme';
import { formatLongDate, todayIso } from '@/utils/date';
import type { Warranty } from '@/types';

const CLAIM_OPTIONS: readonly { value: ClaimStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'open', label: 'Open' },
  { value: 'settled', label: 'Settled' },
  { value: 'rejected', label: 'Rejected' },
];

const CLAIM_HINT: Record<ClaimStatus, string | null> = {
  none: null,
  open: 'Claim open. Keep the receipt and the old part until it is settled.',
  settled: 'Claim settled — the cover stays on record as evidence.',
  rejected: 'Claim rejected — kept on record, which still matters at resale.',
};

/**
 * Add / edit a warranty (Figma `R4 Records — Warranty detail`).
 *
 * The summary card says how much cover is left in the largest honest unit;
 * everything else is the record as typed. Expired warranties are kept —
 * evidence of cover matters at resale.
 */
export default function WarrantyEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const warranties = useWarranties();

  if (editingId && warranties.isPending) {
    return (
      <Screen testID="screen-warranty" contentStyle={{ gap: 16 }}>
        <ScreenHeader title="Warranty" style={{ marginBottom: 0 }} />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? ((warranties.data ?? []).find((w) => w.id === editingId) ?? null) : null;

  return <WarrantyForm key={existing?.id ?? 'new'} existing={existing} />;
}

function WarrantyForm({ existing }: { existing: Warranty | null }) {
  const router = useRouter();
  const { c } = useTheme();
  const ids = useNewRecordIds();
  const today = todayIso();

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

  // Figma `Summary`: what the dates add up to, in words.
  const state = existing ? warrantyState(existing, today) : null;
  const remaining = existing ? warrantyRemainingLabel(existing, today) : null;
  const summaryTitle =
    state === null
      ? null
      : state.expired
        ? `Cover ended${existing?.validUntil ? ` ${formatLongDate(existing.validUntil)}` : ''}`
        : remaining === null
          ? 'Covered, with no end date recorded'
          : `Covered for ${remaining} more`;
  const summaryLine =
    existing === null
      ? null
      : existing.validUntil === null
        ? 'Add the end date and a reminder can fire before it.'
        : existing.reminderDaysBefore === null
          ? `Ends ${formatLongDate(existing.validUntil)} · no reminder set`
          : `Reminder ${existing.reminderDaysBefore} days before ${formatLongDate(existing.validUntil)}`;
  const claimHint = existing ? CLAIM_HINT[existing.claimStatus] : null;

  return (
    <Screen testID="screen-warranty" contentStyle={{ gap: 16 }}>
      <ScreenHeader
        title="Warranty"
        style={{ marginBottom: 0 }}
        {...(existing
          ? { action: <IconSquareButton icon="trash" color={c.badIcon} accessibilityLabel="Delete warranty" onPress={() => setDeleteOpen(true)} testID="cta-delete-warranty" /> }
          : {})}
      />

      {existing && state && summaryTitle ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="card-warranty-summary">
          <RowIcon icon={/batter/i.test(existing.title) ? 'battery' : /tyre|tire/i.test(existing.title) ? 'disc' : /chain/i.test(existing.title) ? 'link' : 'badgeCheck'} tone={state.expired ? 'neutral' : state.tone === 'neutral' ? 'neutral' : state.tone} size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt role="rowTitleLarge" numberOfLines={2}>
              {summaryTitle}
            </Txt>
            {summaryLine ? (
              <Txt role="meta" tone="mut" numberOfLines={2}>
                {summaryLine}
              </Txt>
            ) : null}
          </View>
        </Card>
      ) : null}

      {/* Figma `Fields`. */}
      <Card style={{ gap: 14 }}>
        <Field label="What is covered" error={errors.title ?? null}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Battery · Hamko MF9"
            autoCapitalize="sentences"
            invalid={Boolean(errors.title)}
            testID="input-warranty-title"
          />
        </Field>

        <FieldRow gap={10}>
          <Field label="Provider" flex={1}>
            <Input value={provider} onChangeText={setProvider} placeholder="Hamko" autoCapitalize="words" testID="input-provider" />
          </Field>
          <Field label="Valid until" flex={1}>
            <DateField value={validUntil} onChange={setValidUntil} placeholder="No expiry" todayLabel={null} weight="regular" testID="field-valid-until" />
          </Field>
        </FieldRow>

        <Field label="Purchased from">
          <Input
            value={purchasedFrom}
            onChangeText={setPurchasedFrom}
            placeholder="Motor House Dhanmondi"
            autoCapitalize="words"
            testID="input-purchased-from"
          />
        </Field>

        <Field label="Coverage (optional)">
          <Input value={coverage} onChangeText={setCoverage} placeholder="Replacement · manufacturing defects" testID="input-coverage" />
        </Field>

        <Field label="Remind before">
          <Input
            value={reminderDays}
            onChangeText={setReminderDays}
            placeholder="30"
            keyboardType="number-pad"
            unit="days"
            testID="input-reminder-days"
          />
        </Field>
      </Card>

      {/* Figma `Claim`: a four-way control, and what the chosen state asks of the rider. */}
      {existing ? (
        <Card style={{ gap: 10 }} testID="card-claim">
          <Eyebrow>Claim status</Eyebrow>
          <InsetSegmented
            options={CLAIM_OPTIONS}
            value={existing.claimStatus}
            onChange={(next) => void setClaim.submit({ id: existing.id, claimStatus: next })}
            testID="chips-claim-status"
          />
          {claimHint ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: c.warnS }}>
              <Icon name="info" size={20} color={c.warnIcon} />
              <Txt role="micro" color={c.warn} style={{ flex: 1 }}>
                {claimHint}
              </Txt>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Button
        label={existing ? 'Save changes' : 'Save warranty'}
        size="xlarge"
        onPress={submit}
        loading={saveWarranty.isPending}
        testID="cta-save-warranty"
      />

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

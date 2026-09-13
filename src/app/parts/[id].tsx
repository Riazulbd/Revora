import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Badge,
  Button,
  ButtonRow,
  Card,
  DateField,
  Dialog,
  DividedList,
  ErrorState,
  Field,
  FieldRow,
  Input,
  KeyValueRow,
  ProgressBar,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  Stack,
  StatTile,
  Txt,
} from '@/components';
import { partHealth } from '@/calculations/parts';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDeletePart, useRemovePart } from '@/features/parts/usePartMutations';
import { useRecategorise } from '@/features/parts/useRecategorise';
import { conversionLosses } from '@/calculations/recategorise';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { formatCurrency, formatDistance, formatPercent, NO_VALUE } from '@/utils/format';
import { formatLongDate, todayIso } from '@/utils/date';

export default function PartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { units } = useGarage();
  const { analytics, isPending, error } = useGarageData();

  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const recategorise = useRecategorise({ onDone: () => setConvertOpen(false) });
  const [removeOdometer, setRemoveOdometer] = useState('');
  const [removeDate, setRemoveDate] = useState(todayIso());

  const entry = useMemo(
    () =>
      [...(analytics?.parts.active ?? []), ...(analytics?.parts.removed ?? [])].find(
        (p) => p.part.id === id,
      ) ?? null,
    [analytics, id],
  );

  const removePart = useRemovePart({ onRemoved: () => setRemoveOpen(false) });
  const deletePart = useDeletePart({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/parts');
    },
  });

  if (error) {
    return (
      <Screen testID="screen-part-detail">
        <ScreenHeader title="Part" />
        <ErrorState
          message={error.message}
          onRetry={undefined}
          variant="page"
        />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-part-detail">
        <ScreenHeader title="Part" />
        <SkeletonList count={3} height={120} />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen testID="screen-part-detail">
        <ScreenHeader title="Part" />
        <ErrorState
          title="This part is gone"
          message="It may have been deleted on another device."
          onRetry={() => router.replace('/parts')}
          variant="page"
        />
      </Screen>
    );
  }

  const { part, life } = entry;
  const health = partHealth(life);
  const linkedService = analytics?.services.all.find((s) => s.id === part.linkedServiceId) ?? null;
  const current = analytics?.odometer.currentMetres ?? null;

  const openRemove = () => {
    setRemoveOdometer(fromMetres(current, units.distance));
    setRemoveOpen(true);
  };

  return (
    <Screen testID="screen-part-detail">
      <ScreenHeader
        title={part.name}
        badge={<Badge label={life.isRemoved ? "REMOVED" : "ACTIVE"} tone={life.isRemoved ? "neutral" : "good"} />}
      />

      <Stack>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <Txt role="smallStrong" tone="mut">
              {life.isRemoved ? 'Actual life' : 'Remaining life'}
            </Txt>
            <Txt
              role="rowTitle"
              tone={health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : 'good'}
              numberOfLines={1}
            >
              {life.isRemoved
                ? life.actualLifeMetres === null
                  ? NO_VALUE
                  : formatDistance(life.actualLifeMetres, units.distance)
                : life.isOverdue
                  ? `Overdue by ${formatDistance(life.overdueMetres, units.distance)}`
                  : life.remainingPercent === null
                    ? 'No expected life set'
                    : `${formatPercent(life.remainingPercent)} · ${formatDistance(life.remainingMetres, units.distance)}`}
            </Txt>
          </View>

          {life.remainingPercent === null ? null : (
            <ProgressBar
              fraction={life.remainingPercent / 100}
              tone={health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : 'good'}
              style={{ marginBottom: 14 }}
            />
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile
              label="INSTALLED"
              value={formatDistance(part.installedOdometerMetres, units.distance)}
            />
            <StatTile label="USED" value={formatDistance(life.usedMetres, units.distance)} />
            <StatTile
              label="EXPECTED"
              value={
                part.expectedLifeMetres === null
                  ? NO_VALUE
                  : formatDistance(part.expectedLifeMetres, units.distance)
              }
            />
          </View>
        </Card>

        <Card variant="list">
          <DividedList>
            <KeyValueRow
              label="Cost"
              value={
                part.costMinor === 0 ? 'Not recorded' : formatCurrency(part.costMinor, part.currency)
              }
            />
            <KeyValueRow label="Fitted on" value={formatLongDate(part.installedDate)} />
            <KeyValueRow label="Fitted by" value={part.fittedBy ?? 'Self-service'} />
            <KeyValueRow
              label="Linked service"
              value={linkedService ? `${linkedService.title} · ${formatLongDate(linkedService.date)}` : 'None'}
              onPress={
                linkedService
                  ? () => router.push({ pathname: '/services/add', params: { id: linkedService.id } })
                  : undefined
              }
            />
            {part.notes ? <KeyValueRow label="Notes" value={part.notes} /> : null}
            {life.isRemoved ? (
              <KeyValueRow
                label="Removed"
                value={part.removedDate ? formatLongDate(part.removedDate) : NO_VALUE}
              />
            ) : null}
          </DividedList>
        </Card>

        {part.linkedServiceId !== null ? (
          <Txt role="helper" tone="mut">
            This part&apos;s cost sits on the linked service, so it appears once in your ledger.
          </Txt>
        ) : null}

        <ButtonRow>
          <Button
            label="Edit"
            variant="secondary"
            size="medium"
            onPress={() => router.push({ pathname: '/parts/add', params: { id: part.id } })}
            style={{ flex: 1 }}
            testID="cta-edit-part"
          />
          {life.isRemoved ? (
            <Button
              label="Delete"
              variant="secondary"
              size="medium"
              onPress={() => setDeleteOpen(true)}
              style={{ flex: 1 }}
              testID="cta-delete-part"
            />
          ) : (
            <Button
              label="Mark removed"
              variant="secondary"
              size="medium"
              onPress={openRemove}
              style={{ flex: 1 }}
              testID="cta-remove-part"
            />
          )}
        </ButtonRow>
      </Stack>

      <Sheet visible={removeOpen} onClose={() => setRemoveOpen(false)} title="Mark part removed">
        <View style={{ gap: 14 }}>
          <Txt role="body" tone="mut">
            The part moves to your removed history with the reading it came off at, so its actual life is a
            measured number.
          </Txt>
          <FieldRow>
            <Field label="Removed on" flex={1}>
              <DateField value={removeDate} onChange={setRemoveDate} maximumDate={new Date()} />
            </Field>
            <Field label={`Odometer (${distanceUnitLabel(units.distance)})`} flex={1}>
              <Input
                value={removeOdometer}
                onChangeText={setRemoveOdometer}
                keyboardType="decimal-pad"
                size="compact"
                testID="input-remove-odometer"
              />
            </Field>
          </FieldRow>
          <Button
            label="Mark removed"
            onPress={() =>
              removePart.submit({
                id: part.id,
                odometerMetres:
                  toMetres(removeOdometer, units.distance) ?? current ?? part.installedOdometerMetres,
                date: removeDate,
              })
            }
            loading={removePart.isPending}
            testID="cta-confirm-remove"
          />
        </View>
      </Sheet>

      <Button
        label="This is an accessory, not a part"
        variant="ghost"
        size="medium"
        onPress={() => setConvertOpen(true)}
        testID="cta-convert-to-accessory"
      />

      <Dialog
        visible={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Move to accessories?"
        message={`An accessory is bought once and stays on the bike, so it is left out of cost per ${units.distance} and of part-wear tracking. This discards ${conversionLosses('partToAccessory', part).join(', ')}. The cost stays in your history.`}
        confirmLabel="Move"
        busy={recategorise.isPending}
        onConfirm={() => void recategorise.submit({ direction: 'partToAccessory', part })}
        testID="dialog-convert-part"
      />

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this part?"
        message="The record and its cost are removed from your history. This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={deletePart.isPending}
        onConfirm={() => deletePart.submit(part.id)}
        testID="dialog-delete-part"
      />

    </Screen>
  );
}

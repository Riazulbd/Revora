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
  ErrorState,
  Field,
  FieldRow,
  Footnote,
  Icon,
  IconSquareButton,
  Input,
  KeyValueRow,
  ListCard,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  StatRow,
  StatTile,
  Txt,
} from '@/components';
import { partExpectedEndMetres, partHealth } from '@/calculations/parts';
import { partUsedFraction, partUsedPercent } from '@/calculations/partWear';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDeletePart, useRemovePart } from '@/features/parts/usePartMutations';
import { useRecategorise } from '@/features/parts/useRecategorise';
import { PartsDialog } from '@/features/parts/ui/PartsDialog';
import { PartsWearBar } from '@/features/parts/ui/PartsWearBar';
import { partToAccessoryBullets } from '@/features/parts/ui/PartsConversionBullets';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { fontFamily, useTheme } from '@/theme';
import { formatCurrencySymbol, formatDistance, NO_VALUE } from '@/utils/format';
import { formatFullDate, todayIso } from '@/utils/date';

/**
 * One part (Figma `D9 Parts — Part detail`): what it was fitted at, what it
 * has run, what it was expected to do.
 *
 * The three tiles are the whole story the board tells, and none of them is
 * stored — used distance is the current odometer minus the fitting reading,
 * recomputed every time this screen reads.
 */
export default function PartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
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

  const edit = () => {
    if (!entry) return;
    router.push({ pathname: '/parts/add', params: { id: entry.part.id } });
  };

  const header = (
    <ScreenHeader
      title="Part"
      style={{ marginBottom: 0 }}
      {...(entry ? { action: <IconSquareButton icon="pencil" accessibilityLabel="Edit part" onPress={edit} testID="cta-edit-part-header" /> } : {})}
    />
  );

  if (error) {
    return (
      <Screen testID="screen-part-detail" contentStyle={{ gap: 16 }}>
        {header}
        <ErrorState message={error.message} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-part-detail" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={3} height={120} />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen testID="screen-part-detail" contentStyle={{ gap: 16 }}>
        {header}
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
  const tone = health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : health === 'good' ? 'good' : 'mut';
  const toneColor = tone === 'bad' ? c.bad : tone === 'warn' ? c.warn : tone === 'good' ? c.good : c.mut;
  const usedPercent = partUsedPercent(life);
  const usedFraction = partUsedFraction(life);
  const expectedEnd = partExpectedEndMetres(part);
  const linkedService = analytics?.services.all.find((s) => s.id === part.linkedServiceId) ?? null;
  const current = analytics?.odometer.currentMetres ?? null;

  const statusLine = life.isRemoved
    ? life.actualLifeMetres === null
      ? 'Removed · nothing recorded to measure what it lasted'
      : `Removed after ${formatDistance(life.actualLifeMetres, units.distance)}`
    : life.isOverdue
      ? `Over its expected life by ${formatDistance(life.overdueMetres, units.distance)}`
      : usedPercent === null
        ? 'No expected life recorded'
        : `${usedPercent}% used · ${formatDistance(life.remainingMetres, units.distance)} left`;

  const statusIcon = life.isRemoved ? 'archive' : tone === 'bad' ? 'circleAlert' : tone === 'warn' ? 'clock' : tone === 'good' ? 'check' : 'info';

  const paid =
    part.costMinor === 0
      ? 'Nothing was recorded as paid for this part, so Costs is unchanged.'
      : `The ${formatCurrencySymbol(part.costMinor, part.currency)} you paid stays in Costs — as an accessory it leaves cost / ${distanceUnitLabel(units.distance)}.`;

  const openRemove = () => {
    setRemoveOdometer(fromMetres(current, units.distance));
    setRemoveOpen(true);
  };

  return (
    <Screen testID="screen-part-detail" contentStyle={{ gap: 16 }}>
      {header}

      {/* Figma `Title`: the name with its standing beside it. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt role="tabTitle" numberOfLines={2} style={{ flexShrink: 1 }}>
          {part.name}
        </Txt>
        <Badge
          label={life.isRemoved ? 'Removed' : 'Active'}
          tone={life.isRemoved ? 'neutral' : 'good'}
          icon={life.isRemoved ? 'archive' : 'check'}
          size="wide"
          uppercase
        />
      </View>

      {/* Figma `Tiles`: installed, used (tinted in the health), expected. */}
      <StatRow>
        <StatTile variant="outlined" eyebrow valueSize="sm" label="Installed" value={formatDistance(part.installedOdometerMetres, units.distance)} testID="tile-installed" />
        <StatTile
          variant={life.isRemoved || health === 'unknown' ? 'outlined' : health}
          bordered
          eyebrow
          valueSize="sm"
          label="Used"
          value={formatDistance(life.usedMetres, units.distance)}
          testID="tile-used"
        />
        <StatTile
          variant="outlined"
          eyebrow
          valueSize="sm"
          label="Expected"
          value={part.expectedLifeMetres === null ? NO_VALUE : formatDistance(part.expectedLifeMetres, units.distance)}
          testID="tile-expected"
        />
      </StatRow>

      {/* Figma `Status card`: the line, then the wear bar with its two ends named. */}
      <Card style={{ gap: 12 }} testID="card-part-status">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={statusIcon} size={20} color={toneColor} />
          <Txt role="cardTitle" color={toneColor} numberOfLines={2} style={{ flex: 1 }}>
            {statusLine}
          </Txt>
        </View>
        {usedFraction === null || expectedEnd === null ? (
          <Txt role="helper" tone="mut">
            No bar where no life was recorded — nothing is invented.
          </Txt>
        ) : (
          <PartsWearBar
            fraction={usedFraction}
            tone={health === 'bad' ? 'bad' : health === 'warn' ? 'warn' : 'good'}
            startLabel={`Fitted ${formatDistance(part.installedOdometerMetres, units.distance)}`}
            endLabel={`Expected end ${formatDistance(expectedEnd, units.distance)}`}
            testID="chart-wear"
          />
        )}
      </Card>

      {/* Figma `KV card`. */}
      <ListCard testID="card-part-facts">
        <KeyValueRow
          label="Cost"
          value={part.costMinor === 0 ? 'Not recorded' : formatCurrencySymbol(part.costMinor, part.currency)}
        />
        <KeyValueRow label="Fitted on" value={formatFullDate(part.installedDate)} />
        <KeyValueRow label="Fitted by" value={part.fittedBy ?? 'Self-service'} />
        <KeyValueRow
          label="Linked service"
          value={linkedService ? `${linkedService.title} · ${formatFullDate(linkedService.date)}` : 'None'}
          valueTone={linkedService ? 'acc' : 'ink'}
          {...(linkedService
            ? { onPress: () => router.push({ pathname: '/services/add', params: { id: linkedService.id } }) }
            : {})}
          testID="row-linked-service"
        />
        {part.notes ? <KeyValueRow label="Notes" value={part.notes} /> : null}
        {life.isRemoved ? (
          <KeyValueRow label="Removed" value={part.removedDate ? formatFullDate(part.removedDate) : NO_VALUE} />
        ) : null}
      </ListCard>

      {part.linkedServiceId !== null ? (
        <Footnote style={{ marginTop: 0 }}>
          This part&apos;s cost sits on the linked service, so it appears once in your ledger.
        </Footnote>
      ) : null}

      {/* Figma `Actions`. */}
      <ButtonRow>
        {/* Figma `Actions`: `padding:0; gap:8px` — each pill is exactly half the row. */}
        <Button label="Edit" icon="pencil" variant="secondary" size="xlarge" padX={12} flex onPress={edit} testID="cta-edit-part" />
        {life.isRemoved ? (
          <Button
            label="Delete"
            icon="trash"
            variant="dangerSubtle"
            size="xlarge"
            padX={12}
            flex
            onPress={() => setDeleteOpen(true)}
            testID="cta-delete-part"
          />
        ) : (
          <Button
            label="Mark removed"
            icon="archive"
            variant="secondary"
            size="xlarge"
            padX={12}
            flex
            onPress={openRemove}
            testID="cta-remove-part"
          />
        )}
      </ButtonRow>

      <Button
        label="This is an accessory, not a part"
        variant="ghost"
        size="medium"
        tone="acc"
        onPress={() => setConvertOpen(true)}
        testID="cta-convert-to-accessory"
      />

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
            size="xlarge"
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

      <PartsDialog
        visible={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Move to accessories?"
        confirmLabel="Move it"
        cancelLabel="Keep as part"
        busy={recategorise.isPending}
        onConfirm={() => void recategorise.submit({ direction: 'partToAccessory', part })}
        testID="dialog-convert-part"
      >
        <Txt role="body" tone="mut" style={{ marginTop: 8 }}>
          An accessory doesn&rsquo;t wear, so these are{' '}
          <Txt role="body" tone="bad" style={{ fontFamily: fontFamily[700] }}>
            discarded
          </Txt>
          :
        </Txt>
        <View style={{ gap: 8, marginTop: 12 }}>
          {partToAccessoryBullets(part, units.distance).map((bullet) => (
            <Txt key={bullet} role="body">
              &bull; {bullet}
            </Txt>
          ))}
        </View>
        <Txt role="body" tone="mut" style={{ marginTop: 12 }}>
          {paid}
        </Txt>
      </PartsDialog>

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this part?"
        message="The record and its cost are removed from your history. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        busy={deletePart.isPending}
        onConfirm={() => deletePart.submit(part.id)}
        testID="dialog-delete-part"
      />
    </Screen>
  );
}

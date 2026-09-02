import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Banner,
  Button,
  Icon,
  RecordRow,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  Stack,
  TextArea,
  Txt,
  type IconName,
} from '@/components';
import { useAddCapture, useDeleteCapture } from '@/features/capture/useCaptureMutations';
import { useCaptureQueue } from '@/features/records/useRecordQueries';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { useConnectivity } from '@/services/connectivity';
import { dateToIso, formatRelativeDay } from '@/utils/date';
import { useTheme } from '@/theme';
import type { CaptureItem } from '@/types';

/**
 * Fast Capture — one tap now, details later, built for gloves at the pump.
 *
 * A capture is a real stored record, not a note in memory, so it survives the app
 * being killed and syncs on its own. Tapping a queued item takes the rider to the
 * form that completes it.
 */
const ACTIONS: readonly { kind: CaptureItem['kind']; label: string; icon: IconName }[] = [
  { kind: 'fuel', label: 'Fuel stop', icon: 'fuel' },
  { kind: 'receipt', label: 'Receipt photo', icon: 'camera' },
  { kind: 'odometer', label: 'Odometer', icon: 'dashboard' },
  { kind: 'note', label: 'Quick note', icon: 'pencil' },
];

export default function FastCapture() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const connectivity = useConnectivity();
  const queue = useCaptureQueue();
  const picker = useImagePicker();

  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  const addCapture = useAddCapture();
  const deleteCapture = useDeleteCapture();

  const items = queue.data ?? [];
  const queued = items.filter((i) => i.status === 'queued');

  const handle = async (kind: CaptureItem['kind']) => {
    switch (kind) {
      case 'fuel':
        router.push('/fuel/add');
        break;
      case 'odometer':
        router.push('/garage/profile');
        break;
      case 'note':
        setNoteOpen(true);
        break;
      case 'receipt': {
        const uri = await picker.choose('Receipt photo');
        if (!uri) return;
        await addCapture.submit({
          kind: 'receipt',
          label: 'Receipt photo',
          detail: 'Queued · complete later',
          photoPath: uri,
        });
        break;
      }
    }
  };

  const openItem = (item: CaptureItem) => {
    if (item.status === 'completed') return;
    switch (item.kind) {
      case 'receipt':
        router.push('/expenses/add');
        break;
      case 'fuel':
        router.push('/fuel/add');
        break;
      case 'odometer':
        router.push('/garage/profile');
        break;
      default:
        break;
    }
  };

  return (
    <Screen testID="screen-capture">
      <ScreenHeader
        title="Fast Capture"
        subtitle="One tap now, details later. Built for gloves at the pump."
        style={{ marginBottom: 16 }}
      />

      {!connectivity.isOnline ? (
        <Banner
          icon="wifiOff"
          message={`Offline · ${queued.length} item${queued.length === 1 ? '' : 's'} queued — everything syncs into full records automatically.`}
          style={{ marginBottom: 16 }}
          testID="banner-capture-offline"
        />
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.kind}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => void handle(action.kind)}
            testID={`capture-${action.kind}`}
            style={({ pressed }) => ({
              width: '47.5%',
              aspectRatio: 1.15,
              borderWidth: 1,
              borderColor: c.brd,
              borderRadius: radius.card,
              backgroundColor: c.sur,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: c.accS,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={action.icon} size={21} color={c.acc} />
            </View>
            <Txt role="rowTitle">{action.label}</Txt>
          </Pressable>
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Txt role="eyebrow" tone="mut" uppercase>
          QUEUE
        </Txt>
        <Txt role="micro" tone="mut">
          {items.length === 0 ? 'Nothing captured yet' : 'Tap an item to complete it'}
        </Txt>
      </View>

      {queue.isPending ? (
        <SkeletonList count={2} height={64} />
      ) : items.length === 0 ? (
        <Txt role="helper" tone="mut">
          Nothing waiting. Anything you capture here stays on your phone until you finish it, so a fill-up at a
          pump with no signal is never lost.
        </Txt>
      ) : (
        <Stack gap={10}>
          {items.map((item) => (
            <RecordRow
              key={item.id}
              title={item.label}
              subtitle={`${item.detail ?? ''}${item.detail ? ' · ' : ''}${formatRelativeDay(
                dateToIso(new Date(item.createdAt)),
              )}`}
              onPress={() => (item.status === 'queued' ? openItem(item) : deleteCapture.submit(item.id))}
              trailing={
                <Badge
                  label={item.status === 'queued' ? 'QUEUED' : 'DONE'}
                  tone={item.status === 'queued' ? 'warn' : 'good'}
                />
              }
              testID={`capture-item-${item.id}`}
            />
          ))}
        </Stack>
      )}

      <Sheet visible={noteOpen} onClose={() => setNoteOpen(false)} title="Quick note" testID="sheet-note">
        <View style={{ gap: 14 }}>
          <TextArea
            value={note}
            onChangeText={setNote}
            placeholder="Front brake feels spongy near the BRTA office…"
            rows={3}
            testID="input-capture-note"
          />
          <Button
            label="Save to queue"
            onPress={async () => {
              if (note.trim() === '') return;
              await addCapture.submit({
                kind: 'note',
                label: note.trim().slice(0, 60),
                detail: 'Note',
                photoPath: null,
              });
              setNote('');
              setNoteOpen(false);
            }}
            loading={addCapture.isPending}
            testID="cta-save-note"
          />
        </View>
      </Sheet>
    </Screen>
  );
}

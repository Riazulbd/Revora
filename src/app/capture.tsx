import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import {
  Banner,
  Button,
  EmptyState,
  Footnote,
  ListCard,
  Screen,
  SectionEyebrow,
  Sheet,
  SkeletonList,
  TabHeader,
  TextArea,
  type IconName,
} from '@/components';
import { CaptureTile, CaptureWaitingRow, type CaptureTileTone } from '@/features/capture/ui/CaptureBoard';
import { useAddCapture } from '@/features/capture/useCaptureMutations';
import { useCaptureQueue } from '@/features/records/useRecordQueries';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { useConnectivity } from '@/services/connectivity';
import { dateToIso, formatRelativeDay } from '@/utils/date';
import type { CaptureItem, CaptureKind } from '@/types';

/**
 * Fast Capture — one tap now, details later, built for gloves at the pump.
 *
 * A capture is a real stored record, not a note in memory, so it survives the
 * app being killed and syncs on its own. Nothing here is an error state: a
 * waiting item is a capture doing its job, and the row says which full form it
 * belongs in.
 */

type Recipe = {
  icon: IconName;
  tone: CaptureTileTone;
  action: string;
  /** The board's accent pill; everything else is the inset one. */
  emphasis: 'accent' | 'plain';
  href: Href;
};

const RECIPES: Record<CaptureKind, Recipe> = {
  receipt: { icon: 'documents', tone: 'accent', action: 'Make it a fill', emphasis: 'accent', href: '/fuel/add' },
  odometer: { icon: 'odometer', tone: 'odometer', action: 'Read & log', emphasis: 'plain', href: '/garage/odometer' },
  note: { icon: 'pencil', tone: 'plain', action: 'Finish', emphasis: 'plain', href: '/services/add' },
  fuel: { icon: 'fuelPump', tone: 'accent', action: 'Finish', emphasis: 'plain', href: '/fuel/add' },
};

/** `'Today 17:42'` — the relative day the boards use, plus the clock time. */
function capturedAt(millis: number): string {
  const at = new Date(millis);
  const hours = String(at.getHours()).padStart(2, '0');
  const minutes = String(at.getMinutes()).padStart(2, '0');
  return `${formatRelativeDay(dateToIso(at))} ${hours}:${minutes}`;
}

export default function FastCapture() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const queue = useCaptureQueue();
  const picker = useImagePicker();

  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  const addCapture = useAddCapture();

  const waiting = (queue.data ?? []).filter((item) => item.status === 'queued');

  const captureReceipt = async () => {
    const uri = await picker.choose('Receipt photo');
    if (!uri) return;
    await addCapture.submit({
      kind: 'receipt',
      label: 'Receipt photo',
      detail: 'at a pump?',
      photoPath: uri,
    });
  };

  const rowTitle = (item: CaptureItem): string =>
    item.kind === 'note' ? `Note · “${item.label}”` : item.label;

  const rowSubtitle = (item: CaptureItem): string => {
    // A photo that has not left the phone is the one thing a waiting row has to
    // explain, because the rider is the only one who can fix it — by finding a
    // connection, not by re-capturing.
    if (item.photoPath !== null && !connectivity.isOnline) {
      return 'Photo upload waiting for connection — kept on phone';
    }
    const when = capturedAt(item.createdAt);
    return item.detail === null || item.detail === '' ? when : `${when} · ${item.detail}`;
  };

  const isHeldBack = (item: CaptureItem) => item.photoPath !== null && !connectivity.isOnline;

  return (
    <Screen testID="screen-capture" contentStyle={{ paddingHorizontal: 20 }}>
      <TabHeader title="Fast Capture" subtitle="One tap now, details later." />

      {connectivity.isOnline ? null : (
        <Banner
          tone="offline"
          compact
          lead="You’re offline."
          message={`${waiting.length} item${
            waiting.length === 1 ? '' : 's'
          } are kept on this phone and sync into full records on their own.`}
          style={{ marginBottom: 16 }}
          testID="banner-capture-offline"
        />
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <CaptureTile
          label="Receipt"
          icon="camera"
          tone="accent"
          onPress={() => void captureReceipt()}
          testID="capture-receipt"
        />
        <CaptureTile
          label="Odometer"
          icon="odometer"
          tone="odometer"
          onPress={() => router.push('/garage/profile')}
          testID="capture-odometer"
        />
        <CaptureTile
          label="Note"
          icon="pencil"
          tone="plain"
          onPress={() => setNoteOpen(true)}
          testID="capture-note"
        />
      </View>

      <SectionEyebrow top={20}>
        Waiting for details{waiting.length > 0 ? ` · ${waiting.length}` : ''}
      </SectionEyebrow>

      {queue.isPending ? (
        <SkeletonList count={2} height={70} />
      ) : waiting.length === 0 ? (
        <EmptyState
          size="compact"
          icon="checkCircle"
          iconTone="good"
          title="Nothing waiting"
          message="Anything you capture here stays on your phone until you finish it, so a fill-up at a pump with no signal is never lost."
          testID="empty-capture"
        />
      ) : (
        <ListCard testID="list-capture-waiting">
          {waiting.map((item) => {
            const recipe = RECIPES[item.kind];
            return (
              <CaptureWaitingRow
                key={item.id}
                title={rowTitle(item)}
                subtitle={rowSubtitle(item)}
                subtitleTone={isHeldBack(item) ? 'warn' : 'mut'}
                icon={recipe.icon}
                tone={recipe.tone}
                actionLabel={recipe.action}
                actionEmphasis={recipe.emphasis}
                onPress={() => router.push(recipe.href)}
                onAction={() => router.push(recipe.href)}
                testID={`capture-item-${item.id}`}
                actionTestID={`capture-action-${item.id}`}
              />
            );
          })}
        </ListCard>
      )}

      <Footnote testID="footnote-capture">
        Waiting items aren&rsquo;t errors — they&rsquo;re captures doing their job. Each one routes into the
        full form it belongs in.
      </Footnote>

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
                detail: null,
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

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import {
  Button,
  Callout,
  EmptyState,
  Footnote,
  ListCard,
  Screen,
  ScreenHeader,
  SectionEyebrow,
  Sheet,
  SkeletonList,
  TextArea,
  Txt,
  type IconName,
} from '@/components';
import { CaptureTile, CaptureWaitingRow, type CaptureTileTone } from '@/features/capture/ui/CaptureBoard';
import { useAddCapture } from '@/features/capture/useCaptureMutations';
import { useCaptureQueue } from '@/features/records/useRecordQueries';
import { useConnectivity } from '@/services/connectivity';
import { dateToIso, formatRelativeDay } from '@/utils/date';
import type { CaptureItem, CaptureKind } from '@/types';

/**
 * Fast Capture (Figma `E5 More — Fast Capture`) — one tap now, details later,
 * built for gloves at the pump.
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
  receipt: { icon: 'fileText', tone: 'accent', action: 'Make it a fill', emphasis: 'accent', href: '/fuel/add' },
  odometer: { icon: 'gauge', tone: 'odometer', action: 'Read & log', emphasis: 'plain', href: '/garage/odometer' },
  note: { icon: 'pencil', tone: 'plain', action: 'Finish', emphasis: 'plain', href: '/services/add' },
  fuel: { icon: 'fuel', tone: 'accent', action: 'Finish', emphasis: 'plain', href: '/fuel/add' },
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

  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  const addCapture = useAddCapture();

  const waiting = (queue.data ?? []).filter((item) => item.status === 'queued');

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
    <Screen testID="screen-capture" contentStyle={{ gap: 16 }}>
      <ScreenHeader title="Fast Capture" style={{ marginBottom: 0 }} />

      {/* Figma `Heading`. */}
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Txt role="greeting">One tap now, details later.</Txt>
        <Txt role="body" tone="mut">
          Built for gloves at the pump — every capture is saved on this phone straight away.
        </Txt>
      </View>

      {/* Figma `Offline banner`: amber, both lines in the tone. */}
      {connectivity.isOnline ? null : (
        <Callout
          tone="warn"
          icon="wifiOff"
          title="You’re offline."
          body={`${waiting.length} item${waiting.length === 1 ? ' is' : 's are'} kept on this phone and sync into full records on their own.`}
          bodyTone="tone"
          style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'flex-start' }}
          testID="banner-capture-offline"
        />
      )}

      {/* Figma `Capture tiles`. */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <CaptureTile label="Receipt" icon="camera" tone="accent" onPress={() => router.push('/capture/scan')} testID="capture-receipt" />
        <CaptureTile label="Odometer" icon="gauge" tone="odometer" onPress={() => router.push('/garage/odometer')} testID="capture-odometer" />
        <CaptureTile label="Note" icon="pencil" tone="plain" onPress={() => setNoteOpen(true)} testID="capture-note" />
      </View>

      {/* Figma `Section · Waiting`. */}
      <View style={{ gap: 8 }}>
        <SectionEyebrow first style={{ marginBottom: 0 }}>
          Waiting for details{waiting.length > 0 ? ` · ${waiting.length}` : ''}
        </SectionEyebrow>

        {queue.isPending ? (
          <SkeletonList count={2} height={70} />
        ) : waiting.length === 0 ? (
          <EmptyState
            size="compact"
            icon="circleCheck"
            iconTone="good"
            title="Nothing waiting"
            message="Anything you capture here stays on your phone until you finish it, so a fill-up at a pump with no signal is never lost."
            testID="empty-capture"
          />
        ) : (
          <ListCard style={{ paddingVertical: 4, paddingRight: 12 }} testID="list-capture-waiting">
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
      </View>

      <Footnote style={{ marginTop: 0 }} testID="footnote-capture">
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
            size="xlarge"
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

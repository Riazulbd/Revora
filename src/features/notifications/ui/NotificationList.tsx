import React from 'react';
import { View } from 'react-native';

import { Button, Card, Icon, RowIcon, Txt, type IconName, type RowTone } from '@/components';
import { useTheme } from '@/theme';
import type { NotificationRow } from '@/features/notifications/useNotifications';

/**
 * The notifications list from the redesign's dark board.
 *
 * Every row is recomputed from the records, so marking the oil change done does
 * not clear a notification — it stops the notification existing. Tone is never
 * the only signal: the title says "overdue" or "due soon" in words, and the
 * amount past due is printed beside it.
 */

const TONE_TO_ROW: Record<NotificationRow['tone'], RowTone> = {
  bad: 'bad',
  warn: 'warn',
  good: 'good',
  neutral: 'neutral',
};

/**
 * The board draws a glyph per source: a drop for a maintenance rule, the
 * document mark for a lapsing paper, the wifi mark for the sync line.
 */
function glyphFor(id: string): IconName {
  if (id.startsWith('rule:')) return 'drop';
  if (id.startsWith('doc:')) return 'documents';
  if (id === 'sync:offline') return 'wifiOff';
  if (id === 'sync:pending') return 'clock';
  return 'bell';
}

export function NotificationListRow({
  row,
  onOpen,
  testID,
}: {
  row: NotificationRow;
  onOpen: () => void;
  testID: string;
}) {
  // An overdue rule is the one row the board gives the accent pill to, because
  // it is the only one with a single obvious next move.
  const markDone = row.tone === 'bad' && row.id.startsWith('rule:');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 44 }}>
      <RowIcon icon={glyphFor(row.id)} tone={TONE_TO_ROW[row.tone]} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt role="rowTitle" numberOfLines={2}>
          {row.title}
        </Txt>
        <Txt role="meta" tone={row.tone === 'bad' ? 'bad' : 'mut'} numberOfLines={2}>
          {row.body}
        </Txt>
      </View>
      {row.href === null ? null : (
        <Button
          label={markDone ? 'Mark done' : 'Open'}
          onPress={onOpen}
          size="chip"
          variant={markDone ? 'tinted' : 'subtle'}
          accessibilityHint={`Opens ${row.title}`}
          testID={testID}
        />
      )}
    </View>
  );
}

/**
 * "Nothing needs your attention" — the board's own reassurance card: a 28px
 * filled green disc, a `700 15px` line and a `500 13px` muted one, centred.
 */
export function NotificationsClearCard({ testID }: { testID: string }) {
  const { c } = useTheme();

  return (
    <Card style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
      <View style={{ alignItems: 'center', gap: 10 }} testID={testID}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: c.good,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="checkLarge" size={16} color={c.bg} strokeWidth={2.4} />
        </View>
        <Txt role="tileValue" align="center">
          Nothing needs your attention
        </Txt>
        <Txt role="body" tone="mut" align="center">
          Rules healthy, documents valid. Go ride.
        </Txt>
      </View>
    </Card>
  );
}

import React from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Button, Card, Icon, RowIcon, Toggle, Txt, type IconName, type RowTone } from '@/components';
import { HIT_SIZE, useTheme } from '@/theme';
import type { NotificationRow } from '@/features/notifications/useNotifications';

/**
 * The notifications list (Figma `B6 Notifications — Inbox`).
 *
 * Every row is recomputed from the records, so marking the oil change done
 * does not clear a notification — it stops the notification existing. Tone is
 * never the only signal: the title says "overdue" or "due soon" in words, the
 * pill repeats it, and the amount past due is printed under it.
 */

const TONE_TO_ROW: Record<NotificationRow['tone'], RowTone> = {
  bad: 'bad',
  warn: 'warn',
  good: 'good',
  neutral: 'neutral',
};

/** Figma `Tile` per source: the drop for a rule, the document for a paper, the arrows for sync, the shield for a stored notice. */
function glyphFor(row: NotificationRow): IconName {
  if (row.kind === 'rule') return row.tone === 'bad' ? 'droplet' : 'wrench';
  if (row.kind === 'document') return 'fileText';
  if (row.id === 'sync:offline') return 'wifiOff';
  if (row.kind === 'sync' || row.storedKind === 'sync') return 'refreshCw';
  if (row.storedKind === 'document') return 'shield';
  if (row.storedKind === 'maintenance') return 'wrench';
  return 'bell';
}

/** The rule row on blue, the rest in their tone — as the board paints them. */
function tileTone(row: NotificationRow): RowTone {
  if (row.kind === 'rule' && row.tone === 'warn') return 'info';
  return TONE_TO_ROW[row.tone];
}

/**
 * Figma `Row overdue` / `Row doc` / `Row chain`: `padding:14px 0; gap:12px`,
 * the 40px tile, the `600 15px` title (500 once read) over the `400 12px`
 * line and a status pill, and on the right the stamp with the unread dot.
 * An overdue rule is the one row the board gives actions to, because it is
 * the only one with a single obvious next move.
 */
export function NotificationListRow({
  row,
  onOpen,
  onMarkDone,
  testID,
}: {
  row: NotificationRow;
  onOpen: () => void;
  /** Only an overdue rule offers this. */
  onMarkDone?: () => void;
  testID: string;
}) {
  const { c } = useTheme();
  const overdueRule = row.kind === 'rule' && row.tone === 'bad';
  const pill = row.tone === 'bad' ? (row.kind === 'document' ? 'Expired' : 'Overdue') : row.tone === 'warn' && row.kind === 'document' ? 'Expiring' : null;

  const main = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <RowIcon icon={glyphFor(row)} tone={tileTone(row)} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Txt role={row.unread ? 'rowTitleLarge' : 'menuLabel'} numberOfLines={2} style={row.unread ? undefined : { fontWeight: '500' }}>
          {row.title}
        </Txt>
        <Txt role="meta" tone="mut" numberOfLines={2}>
          {row.body}
        </Txt>
        {pill ? <Badge label={pill} tone={row.tone === 'bad' ? 'bad' : 'warn'} uppercase style={{ marginTop: 2 }} /> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Txt role="micro" tone="mut" numberOfLines={1}>
          {row.when}
        </Txt>
        {row.unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.acc }} /> : null}
      </View>
    </View>
  );

  return (
    <View style={{ paddingVertical: 14, gap: 12 }} testID={testID}>
      {row.href === null ? (
        main
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.title}. ${row.body}`}
          accessibilityHint={`Opens ${row.title}`}
          onPress={onOpen}
          testID={`open-${row.id}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {main}
        </Pressable>
      )}
      {overdueRule && onMarkDone ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 52 }}>
          <Button label="Mark done" icon="check" variant="ink" size="medium" padX={16} onPress={onMarkDone} testID={`done-${row.id}`} />
          <Button label="Open" variant="secondary" size="medium" onPress={onOpen} testID={`view-${row.id}`} />
        </View>
      ) : null}
    </View>
  );
}

/** Figma `Toggle row` under REMINDERS ON THIS PHONE: a 20px glyph, the `600 15px` title, the `400 12px` line, the switch. */
export function ReminderToggleRow({
  icon,
  title,
  description,
  value,
  onChange,
  testID,
}: {
  icon: IconName;
  title: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Icon name={icon} size={20} color={c.mut} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="rowTitleLarge">{title}</Txt>
        <Txt role="meta" tone="mut">
          {description}
        </Txt>
      </View>
      <Toggle value={value} onChange={onChange} accessibilityLabel={title} {...(testID === undefined ? {} : { testID })} />
    </View>
  );
}

/**
 * "Nothing needs your attention" — the reassurance card: a 28px filled green
 * disc, a `700 18px` line and a `400 14px` muted one, centred.
 */
export function NotificationsClearCard({ testID }: { testID: string }) {
  const { c } = useTheme();

  return (
    <Card style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
      <View style={{ alignItems: 'center', gap: 10, minHeight: HIT_SIZE }} testID={testID}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.good, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={16} color={c.bg} strokeWidth={2.4} />
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

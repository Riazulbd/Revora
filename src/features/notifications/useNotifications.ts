import { useMemo } from 'react';

import { STATUS_LABEL } from '@/calculations/maintenance';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { requireGarage, useGarageContext } from '@/features/shared/useGarageContext';
import { documentRepository, notificationRepository } from '@/repositories';
import { useLiveQuery } from '@/services/liveQuery';
import { useConnectivity } from '@/services/connectivity';
import { useSyncState } from '@/services/syncStatus';
import type { AppNotification, AppNotificationKind, VaultDocument } from '@/types';
import { formatDistance } from '@/utils/format';
import { daysBetween, formatRelativeDay, formatShortDate, todayIso } from '@/utils/date';

/**
 * The notifications list.
 *
 * Most rows are *derived*, not stored: a maintenance rule that is due and a
 * document that is expiring are facts about the current data, so computing them
 * on read means they can never go stale or need clearing up. Stored
 * notifications remain supported for anything pushed from the server.
 */

export type NotificationRow = {
  id: string;
  /** What produced the row — it picks the glyph and the actions. */
  kind: 'rule' | 'document' | 'sync' | 'stored';
  title: string;
  body: string;
  /** `Now`, `Yesterday`, `18 Oct` — the board's right-hand stamp. */
  when: string;
  tone: 'warn' | 'bad' | 'neutral' | 'good';
  /** A derived row is unread while it stands; a stored one until it is opened. */
  unread: boolean;
  /** `today` for whatever is true right now, `earlier` for what was pushed before. */
  group: 'today' | 'earlier';
  /** The rule behind a maintenance row, so "Mark done" can open its completion. */
  ruleId: string | null;
  /** What a stored notification was about, for its glyph. */
  storedKind: AppNotificationKind | null;
  href: string | null;
};

const DOCUMENT_WARNING_DAYS = 30;

export function useNotificationRows(): { rows: NotificationRow[]; unreadCount: number } {
  const { user } = useAuth();
  const { activeBike, units } = useGarage();
  const { analytics } = useGarageData();
  const connectivity = useConnectivity();
  const syncState = useSyncState();
  const uid = user?.uid ?? null;
  const bikeId = activeBike?.id ?? null;
  const today = todayIso();

  const documents = useLiveQuery<VaultDocument[]>({
    queryKey: ['documents', uid, bikeId, 200],
    enabled: uid !== null && bikeId !== null,
    subscribe: (onData, onError) =>
      uid === null || bikeId === null
        ? () => undefined
        : documentRepository.subscribe(uid, bikeId, 'BDT', { limit: 200 })(onData, onError),
  });

  const stored = useLiveQuery<AppNotification[]>({
    queryKey: ['notifications', uid, bikeId, 100],
    enabled: uid !== null && bikeId !== null,
    subscribe: (onData, onError) =>
      uid === null || bikeId === null
        ? () => undefined
        : notificationRepository.subscribe(uid, bikeId, 'BDT', { limit: 100 })(onData, onError),
  });

  const rows = useMemo<NotificationRow[]>(() => {
    const out: NotificationRow[] = [];

    if (analytics) {
      for (const { rule, status } of analytics.maintenance.rules) {
        if (status.kind !== 'overdue' && status.kind !== 'due_soon') continue;
        const remaining =
          status.remainingMetres !== null
            ? `${status.remainingMetres < 0 ? 'Overdue by' : 'In'} ${formatDistance(
                Math.abs(status.remainingMetres),
                units.distance,
              )}`
            : status.remainingDays !== null
              ? `${status.remainingDays < 0 ? 'Overdue by' : 'In'} ${Math.abs(status.remainingDays)} days`
              : 'Check when convenient';
        const last =
          rule.lastCompletedMetres === null ? null : `last at ${formatDistance(rule.lastCompletedMetres, units.distance)}`;
        out.push({
          id: `rule:${rule.id}`,
          kind: 'rule',
          title: `${rule.name} ${status.kind === 'overdue' ? 'is overdue' : 'is due soon'}`,
          body: `${remaining} — ${status.kind === 'overdue' && last ? last : STATUS_LABEL[status.kind].toLowerCase()}`,
          when: 'Now',
          tone: status.kind === 'overdue' ? 'bad' : 'warn',
          unread: true,
          group: 'today',
          ruleId: rule.id,
          storedKind: null,
          href: '/maintenance',
        });
      }
    }

    for (const doc of documents.data ?? []) {
      if (doc.expiresOn === null) continue;
      const days = daysBetween(today, doc.expiresOn);
      if (days > DOCUMENT_WARNING_DAYS) continue;
      out.push({
        id: `doc:${doc.id}`,
        kind: 'document',
        title: days < 0 ? `${doc.title} has expired` : `${doc.title} expiring in ${days} day${days === 1 ? '' : 's'}`,
        body: `Document vault · ${days < 0 ? 'expired' : 'expires'} ${formatShortDate(doc.expiresOn)}`,
        when: 'Now',
        tone: days < 0 ? 'bad' : 'warn',
        unread: true,
        group: 'today',
        ruleId: null,
        storedKind: null,
        href: '/records/vault',
      });
    }

    if (!connectivity.isOnline) {
      out.push({
        id: 'sync:offline',
        kind: 'sync',
        title: "You're offline",
        body: 'Everything you log is saved on this device and syncs when a connection returns.',
        when: 'Now',
        tone: 'neutral',
        unread: false,
        group: 'today',
        ruleId: null,
        storedKind: null,
        href: null,
      });
    } else if (syncState === 'pending') {
      out.push({
        id: 'sync:pending',
        kind: 'sync',
        title: 'Syncing your latest changes',
        body: 'Recent records are on their way to your account.',
        when: 'Now',
        tone: 'neutral',
        unread: false,
        group: 'today',
        ruleId: null,
        storedKind: null,
        href: null,
      });
    }

    for (const note of stored.data ?? []) {
      const when = formatRelativeDay(note.date, today);
      out.push({
        id: note.id,
        kind: 'stored',
        title: note.title,
        body: note.body,
        when,
        tone: note.kind === 'maintenance' ? 'warn' : 'neutral',
        unread: note.readAt === null,
        group: when === 'Today' ? 'today' : 'earlier',
        ruleId: null,
        storedKind: note.kind,
        href: note.href,
      });
    }

    return out;
  }, [analytics, documents.data, stored.data, connectivity.isOnline, syncState, today, units.distance]);

  const unreadCount = rows.filter((r) => r.unread).length;

  return { rows, unreadCount };
}

export function useMarkAllNotificationsRead(options: { onDone?: () => void } = {}) {
  const ctx = useGarageContext();

  return useRecordMutation<AppNotification[]>({
    mutationFn: async (notifications) => {
      const { uid } = requireGarage(ctx);
      const now = Date.now();
      for (const note of notifications) {
        if (note.readAt !== null) continue;
        await notificationRepository.patch(uid, note.id, { readAt: now });
      }
    },
    successMessage: 'All notifications marked read',
    onSuccess: () => options.onDone?.(),
  });
}

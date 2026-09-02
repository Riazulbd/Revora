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
import type { AppNotification, VaultDocument } from '@/types';
import { formatDistance } from '@/utils/format';
import { daysBetween, todayIso } from '@/utils/date';

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
  title: string;
  body: string;
  when: string;
  tone: 'warn' | 'bad' | 'neutral' | 'good';
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
        out.push({
          id: `rule:${rule.id}`,
          title: `${rule.name} ${status.kind === 'overdue' ? 'is overdue' : 'due soon'}`,
          body: `${remaining} — ${STATUS_LABEL[status.kind].toLowerCase()}`,
          when: 'Today',
          tone: status.kind === 'overdue' ? 'bad' : 'warn',
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
        title: days < 0 ? `${doc.title} has expired` : `${doc.title} expiring in ${days} days`,
        body: 'Document vault',
        when: 'Today',
        tone: days < 0 ? 'bad' : 'warn',
        href: '/records/vault',
      });
    }

    if (!connectivity.isOnline) {
      out.push({
        id: 'sync:offline',
        title: "You're offline",
        body: 'Everything you log is saved on this device and syncs when a connection returns.',
        when: 'Now',
        tone: 'neutral',
        href: null,
      });
    } else if (syncState === 'pending') {
      out.push({
        id: 'sync:pending',
        title: 'Syncing your latest changes',
        body: 'Recent records are on their way to your account.',
        when: 'Now',
        tone: 'neutral',
        href: null,
      });
    }

    for (const note of stored.data ?? []) {
      out.push({
        id: note.id,
        title: note.title,
        body: note.body,
        when: note.date,
        tone: note.kind === 'maintenance' ? 'warn' : 'neutral',
        href: note.href,
      });
    }

    return out;
  }, [analytics, documents.data, stored.data, connectivity.isOnline, syncState, today, units.distance]);

  const unreadCount = rows.filter((r) => r.tone === 'warn' || r.tone === 'bad').length;

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

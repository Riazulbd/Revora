import React from 'react';
import { useRouter, type Href } from 'expo-router';

import {
  Card,
  Footnote,
  ListCard,
  MenuRow,
  Screen,
  SectionEyebrow,
  Stack,
  TabHeader,
  ToggleRow,
  Txt,
} from '@/components';
import {
  NotificationListRow,
  NotificationsClearCard,
} from '@/features/notifications/ui/NotificationList';
import { useNotificationRows } from '@/features/notifications/useNotifications';
import { useNotificationPermission } from '@/features/notifications/useNotificationPermission';
import { useGarage } from '@/features/bikes/GarageProvider';

/**
 * Notifications.
 *
 * Every row is derived from the current data — a rule that is due, a document
 * that is lapsing — so the list is always true and never needs clearing. Mark
 * the oil change done and its row simply stops existing.
 *
 * The OS permission prompt appears here, in context, after the benefit is stated
 * — never on first launch (requirement 49 / mistake 18).
 */
export default function Notifications() {
  const router = useRouter();
  const { rows } = useNotificationRows();
  const { profile } = useGarage();
  const permission = useNotificationPermission();

  return (
    <Screen testID="screen-notifications" contentStyle={{ paddingHorizontal: 20 }}>
      <TabHeader title="Notifications" />

      {rows.length === 0 ? (
        <NotificationsClearCard testID="empty-notifications" />
      ) : (
        <ListCard testID="list-notifications">
          {rows.map((row) => (
            <NotificationListRow
              key={row.id}
              row={row}
              onOpen={() => (row.href === null ? undefined : router.push(row.href as Href))}
              testID={`open-${row.id}`}
            />
          ))}
        </ListCard>
      )}

      <Footnote testID="footnote-notifications">
        Everything here is recomputed from your records — mark the oil change done and its notification simply
        stops existing.
      </Footnote>

      <SectionEyebrow top={20}>Reminders on this phone</SectionEyebrow>

      <Stack gap={12}>
        {permission.granted ? (
          <Card variant="list">
            <ToggleRow
              title="Maintenance reminders"
              description="Before a rule falls due"
              value={profile?.notifications.maintenanceDue ?? true}
              onChange={permission.setMaintenanceEnabled}
              testID="toggle-maintenance-reminders"
            />
            <ToggleRow
              title="Document expiry"
              description="30, 14 and 3 days before"
              value={profile?.notifications.documentExpiry ?? true}
              onChange={permission.setDocumentEnabled}
              testID="toggle-document-reminders"
            />
          </Card>
        ) : (
          <Card>
            <Txt role="rowTitle">Get reminders before maintenance is due</Txt>
            <Txt role="body" tone="mut" style={{ marginTop: 6, marginBottom: 14 }}>
              Revora can remind you when a service is coming up and before a document expires. Everything above
              still works without it — you just have to open the app to see it.
            </Txt>
            <MenuRow
              label={permission.canAsk ? 'Turn on reminders' : 'Open phone settings'}
              onPress={permission.request}
              testID="cta-enable-notifications"
            />
          </Card>
        )}
      </Stack>
    </Screen>
  );
}

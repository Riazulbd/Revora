import React from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Button, Card, IconSquareButton, ListCard, Screen, SectionEyebrow, Txt } from '@/components';
import {
  NotificationListRow,
  NotificationsClearCard,
  ReminderToggleRow,
} from '@/features/notifications/ui/NotificationList';
import { useNotificationRows } from '@/features/notifications/useNotifications';
import { useNotificationPermission } from '@/features/notifications/useNotificationPermission';
import { useGarage } from '@/features/bikes/GarageProvider';

/**
 * Notifications (Figma `B6 Notifications — Inbox`).
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
  const { rows, unreadCount } = useNotificationRows();
  const { profile, activeBike } = useGarage();
  const permission = useNotificationPermission();

  const today = rows.filter((row) => row.group === 'today');
  const earlier = rows.filter((row) => row.group === 'earlier');

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/more');
  };

  return (
    <Screen testID="screen-notifications" contentStyle={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconSquareButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} testID="back-notifications" />
        <View style={{ width: 48 }} />
      </View>

      {/* Figma `Header`. */}
      <View style={{ gap: 4 }}>
        <Txt role="tabTitle" style={{ letterSpacing: -0.28 }}>
          Notifications
        </Txt>
        <Txt role="body" tone="mut" numberOfLines={1}>
          {`${unreadCount === 0 ? 'Nothing new' : `${unreadCount} new`}${activeBike ? ` · ${activeBike.nickname}` : ''}`}
        </Txt>
      </View>

      {rows.length === 0 ? (
        <NotificationsClearCard testID="empty-notifications" />
      ) : null}

      {today.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionEyebrow first style={{ marginBottom: 0, paddingLeft: 0 }}>{`Today · ${today.length}`}</SectionEyebrow>
          <ListCard testID="list-notifications">
            {today.map((row) => (
              <NotificationListRow
                key={row.id}
                row={row}
                onOpen={() => (row.href === null ? undefined : router.push(row.href as Href))}
                {...(row.ruleId === null
                  ? {}
                  : {
                      onMarkDone: () =>
                        router.push({ pathname: '/maintenance/rule', params: { id: row.ruleId ?? '', complete: '1' } }),
                    })}
                testID={`notification-${row.id}`}
              />
            ))}
          </ListCard>
        </View>
      ) : null}

      {earlier.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionEyebrow first style={{ marginBottom: 0, paddingLeft: 0 }}>
            Earlier
          </SectionEyebrow>
          <ListCard testID="list-notifications-earlier">
            {earlier.map((row) => (
              <NotificationListRow
                key={row.id}
                row={row}
                onOpen={() => (row.href === null ? undefined : router.push(row.href as Href))}
                testID={`notification-${row.id}`}
              />
            ))}
          </ListCard>
        </View>
      ) : null}

      <Txt role="helper" tone="mut" align="center" style={{ paddingHorizontal: 4 }} testID="footnote-notifications">
        Everything here is recomputed from your records — mark the oil change done and its notification simply
        stops existing.
      </Txt>

      {/* Figma `Group reminders`. */}
      <View style={{ gap: 10 }}>
        <SectionEyebrow first style={{ marginBottom: 0, paddingLeft: 0 }}>
          Reminders on this phone
        </SectionEyebrow>
        {permission.granted ? (
          <ListCard>
            <ReminderToggleRow
              icon="bell"
              title="Maintenance reminders"
              description="Before a rule falls due"
              value={profile?.notifications.maintenanceDue ?? true}
              onChange={permission.setMaintenanceEnabled}
              testID="toggle-maintenance-reminders"
            />
            <ReminderToggleRow
              icon="fileClock"
              title="Document expiry"
              description="30, 14 and 3 days before"
              value={profile?.notifications.documentExpiry ?? true}
              onChange={permission.setDocumentEnabled}
              testID="toggle-document-reminders"
            />
          </ListCard>
        ) : (
          <Card style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Txt role="rowTitleLarge">Get reminders before maintenance is due</Txt>
              <Txt role="body" tone="mut">
                Revora can remind you when a service is coming up and before a document expires. Everything above
                still works without it — you just have to open the app to see it.
              </Txt>
            </View>
            <Button
              label={permission.canAsk ? 'Turn on reminders' : 'Open phone settings'}
              icon="bell"
              variant="secondary"
              size="medium"
              onPress={permission.request}
              testID="cta-enable-notifications"
            />
          </Card>
        )}
      </View>
    </Screen>
  );
}

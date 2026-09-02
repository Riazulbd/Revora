import React from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import {
  Banner,
  Card,
  EmptyState,
  MenuRow,
  Screen,
  ScreenHeader,
  Stack,
  ToggleRow,
  Txt,
} from '@/components';
import { useNotificationRows } from '@/features/notifications/useNotifications';
import { useNotificationPermission } from '@/features/notifications/useNotificationPermission';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useTheme } from '@/theme';

/**
 * Notifications.
 *
 * Most rows are derived from the current data — a rule that is due, a document
 * that is lapsing — so the list is always true and never needs clearing.
 *
 * The OS permission prompt appears here, in context, after the benefit is stated
 * — never on first launch (requirement 49 / mistake 18).
 */
export default function Notifications() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const { rows } = useNotificationRows();
  const { profile } = useGarage();
  const permission = useNotificationPermission();

  return (
    <Screen testID="screen-notifications">
      <ScreenHeader title="Notifications" />

      <Stack>
        {!permission.granted ? (
          <Card>
            <Txt role="rowTitle">Get reminders before maintenance is due</Txt>
            <Txt role="body" tone="mut" style={{ marginTop: 6, marginBottom: 14 }}>
              Revora can remind you when a service is coming up and before a document expires. Everything below
              still works without it — you just have to open the app to see it.
            </Txt>
            <MenuRow
              label={permission.canAsk ? 'Turn on reminders' : 'Open phone settings'}
              onPress={permission.request}
              testID="cta-enable-notifications"
            />
          </Card>
        ) : (
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
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Nothing needs your attention"
            message="When a maintenance rule falls due or a document is about to expire, it appears here."
            testID="empty-notifications"
          />
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((row) => (
              <Card key={row.id} variant="list" style={{ paddingVertical: 14 }}>
                <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      marginTop: 6,
                      backgroundColor:
                        row.tone === 'bad'
                          ? c.bad
                          : row.tone === 'warn'
                            ? c.warn
                            : row.tone === 'good'
                              ? c.good
                              : c.mut,
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt role="rowTitleDense">{row.title}</Txt>
                    <Txt role="metaSmall" tone="mut">
                      {row.body}
                    </Txt>
                  </View>
                  <Txt role="micro" tone="mut">
                    {row.when}
                  </Txt>
                </View>
                {row.href ? (
                  <View style={{ marginTop: 8 }}>
                    <MenuRow
                      label="Open"
                      onPress={() => router.push(row.href as Href)}
                      testID={`open-${row.id}`}
                    />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}

        <Banner
          tone="neutral"
          message="Reminders are scheduled on this phone, so they arrive whether or not you have a connection."
          style={{ borderRadius: radius.input }}
        />
      </Stack>
    </Screen>
  );
}

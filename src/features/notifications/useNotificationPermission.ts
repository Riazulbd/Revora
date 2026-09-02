import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { profileRepository } from '@/repositories';
import { log } from '@/services/logger';

/**
 * The notification permission, requested in context.
 *
 * Revora never asks on first launch. The rider sees what reminders do, on the
 * Notifications screen, and asks for them — which is both better manners and a
 * far higher grant rate (requirement 49).
 */
export function useNotificationPermission() {
  const { user } = useAuth();
  const { profile } = useGarage();
  const [granted, setGranted] = useState(false);
  const [canAsk, setCanAsk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Notifications.getPermissionsAsync()
      .then((status) => {
        if (cancelled) return;
        setGranted(status.granted);
        setCanAsk(status.canAskAgain);
      })
      .catch((error) => log.warn('notifications', 'permission check failed', { error: String(error) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async () => {
    if (!canAsk) {
      await Linking.openSettings().catch(() => undefined);
      return;
    }
    try {
      const status = await Notifications.requestPermissionsAsync();
      setGranted(status.granted);
      setCanAsk(status.canAskAgain);
      if (user) {
        await profileRepository.update(user.uid, {
          notifications: {
            maintenanceDue: profile?.notifications.maintenanceDue ?? true,
            documentExpiry: profile?.notifications.documentExpiry ?? true,
            permissionRequestedAt: Date.now(),
          },
        });
      }
      if (status.granted && Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('revora-reminders', {
          name: 'Maintenance & documents',
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: '#F4511E',
        });
      }
    } catch (error) {
      log.warn('notifications', 'permission request failed', { error: String(error) });
    }
  }, [canAsk, user, profile]);

  const setMaintenanceEnabled = useCallback(
    (next: boolean) => {
      if (!user) return;
      void profileRepository.update(user.uid, {
        notifications: {
          maintenanceDue: next,
          documentExpiry: profile?.notifications.documentExpiry ?? true,
          permissionRequestedAt: profile?.notifications.permissionRequestedAt ?? Date.now(),
        },
      });
    },
    [user, profile],
  );

  const setDocumentEnabled = useCallback(
    (next: boolean) => {
      if (!user) return;
      void profileRepository.update(user.uid, {
        notifications: {
          maintenanceDue: profile?.notifications.maintenanceDue ?? true,
          documentExpiry: next,
          permissionRequestedAt: profile?.notifications.permissionRequestedAt ?? Date.now(),
        },
      });
    },
    [user, profile],
  );

  return { granted, canAsk, request, setMaintenanceEnabled, setDocumentEnabled };
}

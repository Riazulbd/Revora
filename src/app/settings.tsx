import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Divider,
  Eyebrow,
  Field,
  Icon,
  Input,
  KeyValueRow,
  MenuRow,
  Screen,
  ScreenHeader,
  Segmented,
  Sheet,
  Stack,
  Txt,
  useToast,
} from '@/components';
import { currencySymbol } from '@/calculations/money';
import { mileageUnitLabel } from '@/calculations/units';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useDeleteAccount } from '@/features/settings/useAccountMutations';
import { useUnitsSettings } from '@/features/settings/useUnitsSettings';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { useImageUrl } from '@/features/shared/useImageUrl';
import { authService } from '@/services/auth';
import { messageFor } from '@/services/errors';
import { useConnectivity } from '@/services/connectivity';
import { useSyncState } from '@/services/syncStatus';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { profileRepository } from '@/repositories';
import { useTheme, type ThemePreference } from '@/theme';

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function Settings() {
  const router = useRouter();
  const { c, preference, setPreference } = useTheme();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const { profile, units, isPro } = useGarage();
  const connectivity = useConnectivity();
  const syncState = useSyncState();
  const picker = useImagePicker();
  const unitSettings = useUnitsSettings();
  const deleteAccount = useDeleteAccount();

  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [uploading, setUploading] = useState(false);

  const avatarUrl = useImageUrl(profile?.photoPath ?? null);

  const changeAvatar = async () => {
    if (!user) return;
    const uri = await picker.choose('Profile photo');
    if (!uri) return;
    setUploading(true);
    try {
      const { path, uploaded } = await uploadImageOrKeepLocal({
        uid: user.uid,
        kind: 'avatar',
        recordId: user.uid,
        localUri: uri,
      });
      await profileRepository.update(user.uid, { photoPath: path });
      toast.show(uploaded ? 'Profile photo updated' : 'Photo saved on this phone — cloud backup is not set up yet');
    } catch (error) {
      toast.show(messageFor(error, "Couldn't save that photo."), 'error');
    } finally {
      setUploading(false);
    }
  };

  const saveName = async () => {
    if (!user || name.trim() === '') return;
    try {
      await authService.updateDisplayName(name);
      await profileRepository.update(user.uid, { displayName: name.trim() });
      setNameOpen(false);
      toast.show('Name updated');
    } catch (error) {
      toast.show(messageFor(error), 'error');
    }
  };

  const syncLabel =
    !connectivity.isOnline
      ? 'Waiting for connection'
      : syncState === 'pending'
        ? 'Syncing…'
        : syncState === 'failed'
          ? 'Retrying'
          : 'Up to date';

  return (
    <Screen testID="screen-settings">
      <ScreenHeader title="Settings" />

      <Stack>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar
              name={profile?.displayName ?? 'Rider'}
              uri={avatarUrl}
              size={64}
              onPress={changeAvatar}
              accessibilityLabel="Change profile photo"
              testID="cta-avatar"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt role="cardTitle" numberOfLines={1}>
                {profile?.displayName ?? 'Rider'}
              </Txt>
              <Txt role="metaSmall" tone="mut" numberOfLines={1}>
                {user?.isAnonymous
                  ? 'Offline account · no email'
                  : (user?.email ?? profile?.email ?? 'No email on file')}
              </Txt>
              <Txt role="micro" tone="mut">
                {uploading ? 'Uploading photo…' : 'Tap the photo to change it'}
              </Txt>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <MenuRow
              label="Change display name"
              onPress={() => {
                setName(profile?.displayName ?? '');
                setNameOpen(true);
              }}
              testID="row-change-name"
            />
          </View>

          {user?.isAnonymous ? (
            <>
              <Divider />
              <MenuRow
                label="Add an email to sync across devices"
                onPress={() => router.push('/(auth)/signup')}
                testID="row-upgrade-account"
              />
            </>
          ) : user && !user.emailVerified ? (
            <>
              <Divider />
              <MenuRow
                label="Resend verification email"
                onPress={async () => {
                  try {
                    await authService.resendVerification();
                    toast.show('Verification email sent');
                  } catch (error) {
                    toast.show(messageFor(error), 'error');
                  }
                }}
                testID="row-resend-verification"
              />
            </>
          ) : null}
        </Card>

        <Card variant="list">
          <Eyebrow>APPEARANCE</Eyebrow>
          <View style={{ paddingVertical: 12 }}>
            <Segmented
              options={THEME_OPTIONS}
              value={preference}
              onChange={setPreference}
              testID="segment-theme"
            />
          </View>
        </Card>

        <Card variant="list">
          <Eyebrow>UNITS</Eyebrow>
          <View style={{ height: 4 }} />
          <MenuRow
            label="Currency"
            onPress={unitSettings.openCurrency}
            right={
              <Txt role="metaSmall" tone="mut">
                {units.currency} ({currencySymbol(units.currency)})
              </Txt>
            }
            testID="row-currency"
          />
          <Divider />
          <MenuRow
            label="Distance"
            onPress={unitSettings.openDistance}
            right={
              <Txt role="metaSmall" tone="mut">
                {units.distance === 'km' ? 'Kilometres' : 'Miles'}
              </Txt>
            }
            testID="row-distance"
          />
          <Divider />
          <MenuRow
            label="Fuel volume"
            onPress={unitSettings.openVolume}
            right={
              <Txt role="metaSmall" tone="mut">
                {units.volume === 'L' ? 'Litres' : units.volume === 'gal_us' ? 'US gallons' : 'UK gallons'}
              </Txt>
            }
            testID="row-volume"
          />
          <Divider />
          <MenuRow
            label="Mileage"
            onPress={unitSettings.openMileage}
            right={
              <Txt role="metaSmall" tone="mut">
                {mileageUnitLabel(units.mileage)}
              </Txt>
            }
            testID="row-mileage"
          />
          <Divider />
          <MenuRow
            label="Cost basis"
            onPress={unitSettings.openCostBasis}
            right={
              <Txt role="metaSmall" tone="mut">
                {units.costBasis === 'total' ? 'With purchase' : 'Running only'}
              </Txt>
            }
            testID="row-cost-basis"
          />
        </Card>

        <Card variant="list">
          <Eyebrow>DATA</Eyebrow>
          <View style={{ height: 4 }} />
          <KeyValueRow label="Cloud sync" value={syncLabel} />
          <Divider />
          <MenuRow
            label="Export fuel history"
            onPress={() => router.push('/(tabs)/fuel')}
            testID="row-export-data"
          />
          <Divider />
          <MenuRow
            label="Privacy policy"
            onPress={() => router.push('/legal/privacy')}
            testID="row-privacy"
          />
          <Divider />
          <MenuRow label="Terms of use" onPress={() => router.push('/legal/terms')} testID="row-terms" />
        </Card>

        <Card variant="list">
          <MenuRow
            label="Plan"
            onPress={() => router.push('/plan')}
            right={<Badge label={isPro ? 'PRO' : 'FREE'} tone={isPro ? 'accent' : 'neutral'} />}
            testID="row-plan"
          />
        </Card>

        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => setSignOutOpen(true)}
          testID="cta-sign-out"
        />

        <Button
          label="Delete account"
          variant="secondary"
          size="medium"
          onPress={() => setDeleteOpen(true)}
          style={{ borderColor: c.brd }}
          testID="cta-delete-account"
        />

        <Txt role="helper" tone="mut" align="center">
          Deleting your account removes every motorcycle, fuel log, service and document you have stored, on
          this phone and on the web.
        </Txt>
      </Stack>

      <Sheet visible={nameOpen} onClose={() => setNameOpen(false)} title="Display name">
        <View style={{ gap: 14 }}>
          <Field label="Name">
            <Input value={name} onChangeText={setName} autoCapitalize="words" testID="input-display-name" />
          </Field>
          <Button label="Save" onPress={saveName} testID="cta-save-name" />
        </View>
      </Sheet>

      {unitSettings.sheet}

      <Dialog
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out?"
        message="Your records stay in your account. Sign back in on any device to pick up where you left off."
        confirmLabel="Sign out"
        onConfirm={async () => {
          setSignOutOpen(false);
          try {
            await signOut();
            router.replace('/(auth)/welcome');
          } catch (error) {
            toast.show(messageFor(error), 'error');
          }
        }}
        testID="dialog-sign-out"
      />

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account">
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Icon name="alert" size={20} color={c.bad} />
            <Txt role="body" tone="mut" style={{ flex: 1 }}>
              This permanently deletes every motorcycle, fuel log, service, part, expense and document in your
              account. It cannot be undone and there is no backup.
            </Txt>
          </View>

          {user?.isAnonymous ? null : (
            <Field label="Confirm your password" helper="Required for a change this serious.">
              <Input
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
                testID="input-delete-password"
              />
            </Field>
          )}

          <Button
            label="Delete everything"
            variant="danger"
            loading={deleteAccount.isPending}
            onPress={async () => {
              const result = await deleteAccount.submit({
                password: user?.isAnonymous ? undefined : deletePassword,
              });
              if (result !== null) {
                setDeleteOpen(false);
                router.replace('/(auth)/welcome');
              }
            }}
            testID="cta-confirm-delete-account"
          />
          <Button label="Keep my account" variant="secondary" onPress={() => setDeleteOpen(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

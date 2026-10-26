import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Button,
  Dialog,
  Field,
  Footnote,
  Icon,
  Input,
  ListCard,
  MenuRow,
  Screen,
  ScreenHeader,
  SectionEyebrow,
  Segmented,
  Sheet,
  Txt,
  useToast,
  type SegmentedOption,
} from '@/components';
import { currencySymbol } from '@/calculations/money';
import {
  MILEAGE_CHOICES,
  mileageChoiceLabel,
  mileageChoiceOf,
  type MileageChoice,
} from '@/calculations/unitChoices';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { AccountDangerRow } from '@/features/settings/AccountDangerRow';
import { AccountUnitRow, AccountValuePill } from '@/features/settings/AccountUnitRow';
import { useDeleteAccount } from '@/features/settings/useAccountMutations';
import { useUnitsSettings } from '@/features/settings/useUnitsSettings';
import { authService } from '@/services/auth';
import { messageFor } from '@/services/errors';
import { profileRepository } from '@/repositories';
import type { CostBasis, DistanceUnit, VolumeUnit } from '@/types';
import { useTheme, type ThemePreference } from '@/theme';

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'smartphone' },
];

const DISTANCE_OPTIONS: readonly SegmentedOption<DistanceUnit>[] = [
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'mi' },
];

const MILEAGE_OPTIONS: readonly SegmentedOption<MileageChoice>[] = MILEAGE_CHOICES.map((choice) => ({
  value: choice,
  label: mileageChoiceLabel(choice),
}));

const COST_BASIS_OPTIONS: readonly SegmentedOption<CostBasis>[] = [
  { value: 'running', label: 'Running' },
  { value: 'total', label: 'All-in' },
];

/** `volumeUnitLabel` abbreviates both gallons to "gal"; a settings row has to say which. */
const VOLUME_LABEL: Record<VolumeUnit, string> = {
  L: 'Litres',
  gal_us: 'US gallons',
  gal_uk: 'UK gallons',
};

/**
 * Settings (Figma `E2 More — Settings`).
 *
 * Three blocks, in the board's order: Units, Appearance, Data & account. The
 * board puts each unit's control in its own row rather than behind a sheet, so
 * a rider can see what they are on without opening anything; the label is still
 * a target for the full list, which is the only place both MPG gallons and the
 * volume unit can live.
 */
export default function Settings() {
  const router = useRouter();
  const { c, preference, setPreference } = useTheme();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const usesPassword = user?.providers.includes('password') ?? false;
  const usesGoogle = user?.providers.includes('google.com') ?? false;
  const { profile, units } = useGarage();
  const unitSettings = useUnitsSettings();
  const deleteAccount = useDeleteAccount();

  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

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

  return (
    <Screen testID="screen-settings" contentStyle={{ gap: 16 }}>
      <ScreenHeader title="Settings" style={{ marginBottom: 0 }} />

      {/* Figma `Section · Units`: the eyebrow, the card (`padding:4px 12px 4px 16px`), the footnote. */}
      <View style={{ gap: 8 }}>
      <SectionEyebrow first style={{ marginBottom: 0 }}>Units</SectionEyebrow>
      <ListCard style={{ paddingVertical: 4, paddingRight: 12 }}>
        <AccountUnitRow label="Distance" onPressLabel={unitSettings.openDistance} testID="row-distance">
          <Segmented
            size="inline"
            padX={14}
            options={DISTANCE_OPTIONS}
            value={units.distance}
            onChange={unitSettings.setDistance}
            testID="segment-distance"
          />
        </AccountUnitRow>

        <AccountUnitRow label="Mileage" onPressLabel={unitSettings.openMileage} testID="row-mileage">
          <Segmented
            size="inline"
            padX={10}
            options={MILEAGE_OPTIONS}
            value={mileageChoiceOf(units.mileage)}
            onChange={unitSettings.setMileageChoice}
            testID="segment-mileage"
          />
        </AccountUnitRow>

        <AccountUnitRow label="Currency">
          <AccountValuePill
            value={`${units.currency} ${currencySymbol(units.currency)}`}
            onPress={unitSettings.openCurrency}
            accessibilityLabel={`Currency, ${units.currency}`}
            testID="row-currency"
          />
        </AccountUnitRow>

        <AccountUnitRow label="Cost basis" onPressLabel={unitSettings.openCostBasis} testID="row-cost-basis">
          <Segmented
            size="inline"
            padX={12}
            options={COST_BASIS_OPTIONS}
            value={units.costBasis}
            onChange={unitSettings.setCostBasis}
            testID="segment-cost-basis"
          />
        </AccountUnitRow>

        {/* Not on the board, which draws a rider who fills in litres. Dropping
            it would leave the board's own "mpg" choice with no gallon behind
            it, so it keeps the board's row shape at the end of the card. */}
        <AccountUnitRow label="Fuel volume">
          <AccountValuePill
            value={VOLUME_LABEL[units.volume]}
            onPress={unitSettings.openVolume}
            accessibilityLabel={`Fuel volume, ${VOLUME_LABEL[units.volume]}`}
            testID="row-volume"
          />
        </AccountUnitRow>
      </ListCard>

      <Footnote style={{ marginTop: 0 }}>All-in adds the purchase price to every total. Unit changes apply everywhere instantly.</Footnote>
      </View>

      {/* Figma `Section · Appearance`. */}
      <View style={{ gap: 8 }}>
      <SectionEyebrow first style={{ marginBottom: 0 }}>Appearance</SectionEyebrow>
      <Segmented
        size="medium"
        options={THEME_OPTIONS}
        value={preference}
        onChange={setPreference}
        testID="segment-theme"
      />
      </View>

      {/* Figma `Section · Data & account`. */}
      <View style={{ gap: 8 }}>
      <SectionEyebrow first style={{ marginBottom: 0 }}>Data &amp; account</SectionEyebrow>
      <ListCard style={{ paddingVertical: 4 }}>
        <MenuRow
          label="Export my data"
          icon="file"
          iconTone="accent"
          onPress={() => router.push('/(tabs)/fuel')}
          testID="row-export-data"
        />

        <MenuRow
          label="Display name"
          icon="user"
          iconTone="neutral"
          subtitle={profile?.displayName ?? 'Rider'}
          onPress={() => {
            setName(profile?.displayName ?? '');
            setNameOpen(true);
          }}
          testID="row-change-name"
        />

        {user?.isAnonymous ? (
          <MenuRow
            label="Add an email to sync across devices"
            icon="send"
            iconTone="accent"
            onPress={() => router.push('/(auth)/signup')}
            testID="row-upgrade-account"
          />
        ) : null}

        {user && !user.isAnonymous && !user.emailVerified ? (
          <MenuRow
            label="Resend verification email"
            icon="send"
            iconTone="accent"
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
        ) : null}

        <MenuRow
          label="Sign out"
          icon="lock"
          iconTone="neutral"
          onPress={() => setSignOutOpen(true)}
          testID="cta-sign-out"
        />

        <AccountDangerRow
          label="Delete account"
          subtitle="Irreversible — the dialog lists exactly what goes"
          onPress={() => setDeleteOpen(true)}
          testID="cta-delete-account"
        />
      </ListCard>
      </View>

      <Sheet visible={nameOpen} onClose={() => setNameOpen(false)} title="Display name">
        <View style={{ gap: 14 }}>
          <Field label="Name">
            <Input value={name} onChangeText={setName} autoCapitalize="words" testID="input-display-name" />
          </Field>
          <Button label="Save" size="xlarge" onPress={saveName} testID="cta-save-name" />
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

          {/* Re-authentication has to use a method the account actually has.
              A Google-only rider was being asked for a password they never
              set, which made the account impossible to delete. */}
          {usesGoogle && !usesPassword ? (
            <Txt role="helper" tone="mut">
              You&apos;ll confirm with your Google account before anything is deleted.
            </Txt>
          ) : null}
          {user?.isAnonymous || !usesPassword ? null : (
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
            size="xlarge"
            loading={deleteAccount.isPending}
            onPress={async () => {
              const result = await deleteAccount.submit({
                password: usesPassword ? deletePassword : undefined,
                viaGoogle: !usesPassword && usesGoogle,
              });
              if (result !== null) {
                setDeleteOpen(false);
                router.replace('/(auth)/welcome');
              }
            }}
            testID="cta-confirm-delete-account"
          />
          <Button label="Keep my account" variant="secondary" size="xlarge" onPress={() => setDeleteOpen(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

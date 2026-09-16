import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Card,
  Divider,
  MenuRow,
  Icon,
  ProBadge,
  Screen,
  SkeletonList,
  Stack,
  StatTile,
  TabHeader,
  Txt,
  useToast,
} from '@/components';
import { AddBikeUpsell } from '@/features/bikes/AddBikeUpsell';
import { BikeSwitcherSheet, useBikeSwitcher } from '@/features/bikes/BikeSwitcher';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useUpdateBike } from '@/features/bikes/useBikeMutations';
import { useImageUrl } from '@/features/shared/useImageUrl';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { messageFor } from '@/services/errors';
import { formatCurrencyCompact, formatDistance, formatVolume, NO_VALUE } from '@/utils/format';
import { useTheme } from '@/theme';

export default function GarageTab() {
  const router = useRouter();
  const { c } = useTheme();
  const toast = useToast();
  const { activeBike, units, isPro, isPending } = useGarage();
  const { analytics, refetch } = useGarageData();
  const switcher = useBikeSwitcher();
  const [uploading, setUploading] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);

  const photoUrl = useImageUrl(activeBike?.photoPath ?? null);
  const updateBike = useUpdateBike({ stayOnScreen: true });
  const picker = useImagePicker();

  const changePhoto = async () => {
    if (!activeBike) return;
    const uri = await picker.choose('Bike photo');
    if (!uri) return;
    setUploading(true);
    try {
      const { path, uploaded } = await uploadImageOrKeepLocal({
        uid: activeBike.userId,
        kind: 'bike',
        recordId: activeBike.id,
        localUri: uri,
      });
      await updateBike.submit({ photoPath: path });
      if (!uploaded) {
        toast.show('Photo saved on this phone — it will not sync to your other devices yet');
      }
    } catch (error) {
      toast.show(messageFor(error, "Couldn't save that photo."), 'error');
    } finally {
      setUploading(false);
    }
  };

  if (isPending && !activeBike) {
    return (
      <Screen variant="tab" testID="screen-garage">
        <TabHeader title="Garage" />
        <SkeletonList count={3} height={140} />
      </Screen>
    );
  }

  if (!activeBike) return null;

  return (
    <Screen variant="tab" onRefresh={refetch} testID="screen-garage">
      <TabHeader
        title="Garage"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch motorcycle"
            onPress={switcher.open}
            testID="cta-switch-bike"
            style={({ pressed }) => ({
              height: 44,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: c.brd,
              borderRadius: 22,
              backgroundColor: c.sur,
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Txt role="smallStrong">Switch bike</Txt>
          </Pressable>
        }
      />

      <Stack>
        <Card>
          <BikePhoto uri={photoUrl} busy={uploading || picker.busy} onPress={changePhoto} />

          <View style={{ gap: 14, marginTop: 14, marginBottom: 16 }}>
            <View style={{ gap: 2 }}>
              <Txt role="cardTitle" numberOfLines={2}>
                {activeBike.nickname}
              </Txt>
              <Txt role="bodySmall" tone="mut" numberOfLines={2}>
                {[activeBike.model, activeBike.year ? String(activeBike.year) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Txt>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile
              label="ODOMETER"
              value={formatDistance(analytics?.odometer.currentMetres ?? null, units.distance)}
            />
            <StatTile label="TANK" value={formatVolume(activeBike.tankCapacityMl, units.volume)} />
            <StatTile
              label="PURCHASE"
              value={
                activeBike.purchasePriceMinor === null
                  ? NO_VALUE
                  : formatCurrencyCompact(activeBike.purchasePriceMinor, activeBike.currency)
              }
            />
          </View>

          {activeBike.purchasePriceMinor === null ? (
            <Txt role="helper" tone="mut" style={{ marginTop: 10 }} testID="hint-purchase-price">
              Purchase price not recorded — add it in Edit details to unlock all-in cost.
            </Txt>
          ) : null}

          <View style={{ marginTop: 14, gap: 2 }}>
            <MenuRow
              label="Motorcycle profile"
              onPress={() => router.push('/garage/profile')}
              testID="cta-profile"
            />
            <Divider />
            <MenuRow
              label="Odometer history"
              onPress={() => router.push('/garage/odometer')}
              testID="cta-odometer"
            />
          </View>
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/garage/company')}
          testID="cta-company"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: activeBike.company.enabled ? c.goodS : c.sur2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="building" size={18} color={activeBike.company.enabled ? c.good : c.mut} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt role="rowTitle" numberOfLines={1}>
                {activeBike.company.enabled && activeBike.company.companyName
                  ? `Company bike · ${activeBike.company.companyName}`
                  : 'Company bike'}
              </Txt>
              <Txt role="meta" tone="mut" numberOfLines={1}>
                {activeBike.company.enabled
                  ? `${formatCurrencyCompact(activeBike.company.monthlyAllowanceMinor, activeBike.currency)}/mo allowance · enabled`
                  : 'Track an employer fuel allowance separately'}
              </Txt>
            </View>
            <Icon name="chevronRight" size={16} color={c.mut} strokeWidth={2.2} />
          </Card>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (isPro) router.push('/(onboarding)/add-bike');
            else setUpsellOpen(true);
          }}
          testID="cta-add-bike"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Card variant="dashed" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: c.sur2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="plus" size={18} color={c.mut} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt role="rowTitle">Add another motorcycle</Txt>
                {isPro ? null : <ProBadge />}
              </View>
              <Txt role="meta" tone="mut">
                {isPro ? 'Pro tracks as many bikes as you own' : 'Free plan tracks one bike'}
              </Txt>
            </View>
          </Card>
        </Pressable>
      </Stack>

      <BikeSwitcherSheet visible={switcher.visible} onClose={switcher.close} />
      <AddBikeUpsell visible={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </Screen>
  );
}

function BikePhoto({ uri, busy, onPress }: { uri: string | null; busy: boolean; onPress: () => void }) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={uri ? 'Change bike photo' : 'Add bike photo'}
      onPress={onPress}
      testID="bike-photo"
      style={({ pressed }) => ({ opacity: pressed || busy ? 0.7 : 1 })}
    >
      <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden' }}>
        {uri ? (
          <Image source={{ uri }} accessibilityLabel="Your motorcycle" style={{ width: '100%', height: '100%' }} />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: c.sur2,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: c.brd,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="motorcycle" size={30} color={c.acc} strokeWidth={1.6} />
            <Txt role="metaSmall" tone="mut">
              Add a photo of the bike
            </Txt>
          </View>
        )}
      </View>
      <View
        style={{
          position: 'absolute',
          right: -4,
          bottom: -4,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.ink,
          borderWidth: 2,
          borderColor: c.sur,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={10} color={c.bg} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

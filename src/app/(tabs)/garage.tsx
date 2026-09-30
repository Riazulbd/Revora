import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  ListCard,
  MenuRow,
  PhotoPanel,
  ProBadge,
  Screen,
  SkeletonList,
  StatRow,
  StatTile,
  TabHeader,
  Txt,
  useToast,
} from '@/components';
import { summariseGarage } from '@/calculations/garage';
import { AddBikeUpsell } from '@/features/bikes/AddBikeUpsell';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useUpdateBike } from '@/features/bikes/useBikeMutations';
import { GarageBikeCard } from '@/features/bikes/ui/GarageBikeCard';
import { GarageSwitchedCard } from '@/features/bikes/ui/GarageSwitchedCard';
import { useAllBikes } from '@/features/bikes/ui/useAllBikes';
import { useImageUrl } from '@/features/shared/useImageUrl';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { messageFor } from '@/services/errors';
import { formatCurrencyCompact, formatDistance, formatVolume, NO_VALUE } from '@/utils/format';
import { useTheme } from '@/theme';

/** How long the board's "Now showing … everywhere" slab stays on screen. */
const SWITCH_NOTICE_MS = 4000;

export default function GarageTab() {
  const router = useRouter();
  const { radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { activeBike, activeBikeId, units, isPro, isPending, setActiveBike } = useGarage();
  const { analytics, refetch } = useGarageData();
  const { bikes: allBikes } = useAllBikes();

  const [uploading, setUploading] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [switchedTo, setSwitchedTo] = useState<string | null>(null);

  const photoUrl = useImageUrl(activeBike?.photoPath ?? null);
  const updateBike = useUpdateBike({ stayOnScreen: true });
  const picker = useImagePicker();

  const garage = useMemo(
    () =>
      summariseGarage({
        bikes: allBikes,
        activeBikeId,
        activeOdometerMetres: analytics?.odometer.currentMetres ?? null,
      }),
    [allBikes, activeBikeId, analytics?.odometer.currentMetres],
  );

  useEffect(() => {
    if (switchedTo === null) return undefined;
    const timer = setTimeout(() => setSwitchedTo(null), SWITCH_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [switchedTo]);

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

  /**
   * The switch is one write to the profile document, which every screen reads
   * the active bike from — so the whole app moves together and the board's
   * slab can honestly say "Dashboard, Fuel, Costs".
   */
  const switchTo = (bikeId: string, nickname: string) => {
    void setActiveBike(bikeId)
      .then(() => setSwitchedTo(nickname))
      .catch((switchError) => {
        toast.show(messageFor(switchError, "Couldn't switch motorcycle."), 'error');
      });
  };

  const addMotorcycle = () => {
    if (isPro) router.push('/(onboarding)/add-bike');
    else setUpsellOpen(true);
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

  const several = garage.length > 1;

  return (
    <View style={{ flex: 1 }}>
      <Screen variant="tab" onRefresh={refetch} testID="screen-garage">
        <TabHeader title="Garage" />

        {several ? (
          <View style={{ gap: 12 }}>
            {garage.map((bike) =>
              bike.status === 'archived' ? (
                <GarageBikeCard
                  key={bike.id}
                  bike={bike}
                  distanceUnit={units.distance}
                  volumeUnit={units.volume}
                  testID={`bike-card-${bike.id}`}
                />
              ) : (
                <GarageBikeCard
                  key={bike.id}
                  bike={bike}
                  distanceUnit={units.distance}
                  volumeUnit={units.volume}
                  onPress={
                    bike.status === 'active'
                      ? () => router.push('/garage/profile')
                      : () => switchTo(bike.id, bike.nickname)
                  }
                  testID={bike.status === 'active' ? 'cta-profile' : `switch-bike-${bike.id}`}
                />
              ),
            )}
          </View>
        ) : (
          <>
            {/* The board's hero: a 180px photo banner over the name, three
                tiles and the purchase-price hint, in one 18px-radius card. */}
            <Card variant="flush" style={{ borderRadius: radius.card }}>
              <PhotoPanel
                uri={photoUrl}
                onPress={changePhoto}
                accessibilityLabel={photoUrl ? 'Change bike photo' : 'Add a photo of the bike'}
                style={{ opacity: uploading || picker.busy ? 0.7 : 1 }}
                testID="bike-photo"
              />

              <View style={{ padding: 16, gap: 12 }}>
                <View>
                  <Txt role="cardTitle" numberOfLines={2}>
                    {activeBike.nickname}
                  </Txt>
                  <Txt role="meta" tone="mut" numberOfLines={2} style={{ marginTop: 2 }}>
                    {garage[0]?.descriptor ?? ''}
                  </Txt>
                </View>

                <StatRow>
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
                </StatRow>

                {activeBike.purchasePriceMinor === null ? (
                  <Txt role="helper" tone="mut" testID="hint-purchase-price">
                    Purchase price not recorded — add it in Edit details to unlock all-in cost.
                  </Txt>
                ) : null}
              </View>
            </Card>

            <ListCard style={{ marginTop: 14 }}>
              <MenuRow
                label="Motorcycle profile"
                onPress={() => router.push('/garage/profile')}
                testID="cta-profile"
              />
              <MenuRow
                label="Odometer history"
                onPress={() => router.push('/garage/odometer')}
                testID="cta-odometer"
              />
            </ListCard>
          </>
        )}

        {several ? (
          <Button
            label="Add another motorcycle"
            variant="secondary"
            size="medium"
            icon="plus"
            flex
            onPress={addMotorcycle}
            style={{ marginTop: 14 }}
            testID="cta-add-bike"
          />
        ) : (
          <ListCard style={{ marginTop: 14 }}>
            <MenuRow
              label="Add another motorcycle"
              right={isPro ? undefined : <ProBadge />}
              onPress={addMotorcycle}
              testID="cta-add-bike"
            />
          </ListCard>
        )}
      </Screen>

      {switchedTo === null ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: spacing.tabBarClearance - 40 + insets.bottom,
          }}
        >
          <GarageSwitchedCard nickname={switchedTo} testID="notice-bike-switched" />
        </View>
      )}

      <AddBikeUpsell visible={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </View>
  );
}

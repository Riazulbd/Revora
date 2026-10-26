import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  HeroCard,
  HeroFigure,
  Icon,
  IconSquareButton,
  ProBadge,
  RowIcon,
  Screen,
  SkeletonList,
  StatRow,
  StatTile,
  TabHeader,
  Txt,
  useToast,
  type IconName,
  type RowTone,
} from '@/components';
import { accessoryTotals } from '@/calculations/accessorySpend';
import { agoPhrase } from '@/calculations/dashboard';
import { summariseGarage } from '@/calculations/garage';
import { AddBikeUpsell } from '@/features/bikes/AddBikeUpsell';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useUpdateBike } from '@/features/bikes/useBikeMutations';
import { GarageBikeCard } from '@/features/bikes/ui/GarageBikeCard';
import { GarageSwitchedCard } from '@/features/bikes/ui/GarageSwitchedCard';
import { useAllBikes } from '@/features/bikes/ui/useAllBikes';
import { useDocuments, useExpiringDocuments } from '@/features/records/useRecordQueries';
import { useImageUrl } from '@/features/shared/useImageUrl';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { messageFor } from '@/services/errors';
import { formatCurrencyCompactSymbol, formatCurrencySymbol, formatDistanceValue, formatVolume } from '@/utils/format';
import { formatShortDate } from '@/utils/date';
import { useTheme } from '@/theme';

/** How long the "Now showing … everywhere" slab stays on screen. */
const SWITCH_NOTICE_MS = 4000;

/**
 * The Garage (Figma `C1 Garage — tab`): the active motorcycle in the dark
 * hero — name, plate, odometer, the three facts — a grid of quick links into
 * everything it owns, the other bikes a tap away, and the Pro card for adding
 * another.
 */
export default function GarageTab() {
  const router = useRouter();
  const { c, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { activeBike, activeBikeId, units, isPro, isPending, setActiveBike } = useGarage();
  const { analytics, refetch } = useGarageData();
  const { bikes: allBikes } = useAllBikes();
  const documents = useDocuments();
  const expiring = useExpiringDocuments();

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
      if (!uploaded) toast.show('Photo saved on this phone — it will not sync to your other devices yet');
    } catch (error) {
      toast.show(messageFor(error, "Couldn't save that photo."), 'error');
    } finally {
      setUploading(false);
    }
  };

  /**
   * The switch is one write to the profile document, which every screen reads
   * the active bike from — so the whole app moves together and the slab can
   * honestly say "Dashboard, Fuel, Costs".
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

  const others = garage.filter((bike) => bike.status !== 'active');
  const active = garage.find((bike) => bike.status === 'active') ?? null;
  const owned = garage.filter((bike) => bike.status !== 'archived').length;
  // The plate is whatever the rider put on the registration document; the
  // bike itself does not carry one.
  const plate = (documents.data ?? []).find((d) => d.kind === 'registration')?.reference ?? null;
  const today = analytics?.today;

  const maintenance = analytics?.maintenance.counts;
  const latestService = analytics?.services.all.reduce<string | null>(
    (latest, service) => (latest === null || service.date > latest ? service.date : latest),
    null,
  );
  const accessories = analytics ? accessoryTotals(analytics.accessories.all) : null;
  const latestReading = analytics?.odometer.latest ?? null;

  const links: { label: string; icon: IconName; tone: RowTone; detail: string; detailTone: 'mut' | 'warn' | 'bad'; route: string; testID: string }[] = [
    {
      label: 'Maintenance',
      icon: 'settings',
      tone: 'warn',
      ...(maintenance && maintenance.overdue > 0
        ? { detail: `${maintenance.overdue} overdue`, detailTone: 'bad' as const }
        : maintenance && maintenance.due_soon > 0
          ? { detail: `${maintenance.due_soon} due soon`, detailTone: 'warn' as const }
          : { detail: analytics && analytics.maintenance.rules.length > 0 ? 'All good' : 'No rules yet', detailTone: 'mut' as const }),
      route: '/maintenance',
      testID: 'link-maintenance',
    },
    {
      label: 'Services',
      icon: 'wrench',
      tone: 'accent',
      detail: latestService ? `Last ${formatShortDate(latestService)}` : 'None yet',
      detailTone: 'mut',
      route: '/services',
      testID: 'link-services',
    },
    {
      label: 'Parts',
      icon: 'package',
      tone: 'info',
      detail: `${analytics?.parts.active.length ?? 0} fitted`,
      detailTone: 'mut',
      route: '/parts',
      testID: 'link-parts',
    },
    {
      label: 'Accessories',
      icon: 'shield',
      tone: 'good',
      detail: accessories && accessories.count > 0 ? `${accessories.count} · ${formatCurrencySymbol(accessories.totalMinor, analytics?.currency ?? units.currency)}` : 'None yet',
      detailTone: 'mut',
      route: '/accessories',
      testID: 'link-accessories',
    },
    {
      label: 'Records',
      icon: 'fileText',
      tone: 'accent',
      ...(expiring.expiredCount > 0
        ? { detail: `${expiring.expiredCount} expired`, detailTone: 'bad' as const }
        : expiring.expiringCount > 0
          ? { detail: `${expiring.expiringCount} expiring`, detailTone: 'warn' as const }
          : { detail: `${documents.data?.length ?? 0} documents`, detailTone: 'mut' as const }),
      route: '/records/vault',
      testID: 'link-records',
    },
    {
      label: 'Odometer',
      icon: 'gauge',
      tone: 'info',
      detail: latestReading && today ? agoPhrase(latestReading.date, today) : 'No reading',
      detailTone: 'mut',
      route: '/garage/odometer',
      testID: 'link-odometer',
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Screen variant="tab" onRefresh={refetch} testID="screen-garage" contentStyle={{ gap: 16 }}>
        <TabHeader
          title="Garage"
          subtitle={`${owned} ${owned === 1 ? 'motorcycle' : 'motorcycles'} · Active everywhere`}
          action={<IconSquareButton icon="pencil" accessibilityLabel="Edit motorcycle" onPress={() => router.push('/garage/edit')} testID="cta-edit-bike" />}
          style={{ marginBottom: 0 }}
        />

        {/* Figma `Hero — bike`. The 48px tile shows the photo when there is one and changes it on tap. */}
        <HeroCard testID="hero-bike">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photoUrl ? 'Change bike photo' : 'Add a photo of the bike'}
              onPress={() => void changePhoto()}
              disabled={uploading || picker.busy}
              testID="bike-photo"
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: c.heroTile,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressed || uploading || picker.busy ? 0.7 : 1,
              })}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} accessibilityIgnoresInvertColors style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Icon name="bike" size={24} color={c.heroAcc} />
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt role="headline" color={c.heroInk} numberOfLines={1}>
                {activeBike.nickname}
              </Txt>
              <Txt role="subtitle" color={c.heroMut} numberOfLines={1}>
                {active?.descriptor || 'Make and model not set'}
              </Txt>
              {plate ? (
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: c.heroChip,
                      borderWidth: 1,
                      borderColor: c.heroLine,
                    }}
                  >
                    <Txt role="smallStrong" color={c.heroChipInk} style={{ letterSpacing: 0.48 }} numberOfLines={1}>
                      {plate}
                    </Txt>
                  </View>
                </View>
              ) : null}
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.heroChip }}>
              <Txt role="smallStrong" color={c.heroGood}>
                Active
              </Txt>
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Txt role="eyebrow" color={c.heroMut} uppercase>
              Odometer
            </Txt>
            <HeroFigure
              value={analytics?.odometer.currentMetres == null ? undefined : formatDistanceValue(analytics.odometer.currentMetres, units.distance)}
              unit={units.distance}
              testID="hero-garage-odometer"
            />
          </View>

          <StatRow>
            <StatTile variant="hero" valueSize="sm" label="Plate" {...(plate ? { value: plate } : {})} />
            <StatTile variant="hero" valueSize="sm" label="Tank" {...(activeBike.tankCapacityMl === null ? {} : { value: formatVolume(activeBike.tankCapacityMl, units.volume) })} />
            <StatTile
              variant="hero"
              valueSize="sm"
              label="Purchase"
              {...(activeBike.purchasePriceMinor === null ? {} : { value: formatCurrencyCompactSymbol(activeBike.purchasePriceMinor, activeBike.currency) })}
            />
          </StatRow>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open motorcycle profile"
            onPress={() => router.push('/garage/profile')}
            testID="cta-profile"
            style={({ pressed }) => ({
              height: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 16,
              paddingRight: 12,
              borderRadius: 999,
              backgroundColor: c.heroChip,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Txt role="rowTitle" color={c.heroInk}>
              Open motorcycle profile
            </Txt>
            <Icon name="chevronRight" size={20} color={c.heroChipInk} />
          </Pressable>
        </HeroCard>

        {/* Figma `Quick links`: six tiles, two to a row. */}
        <Card style={{ gap: 12 }} testID="card-quick-links">
          <Txt role="cardTitle">Quick links</Txt>
          {[0, 2, 4].map((start) => (
            <View key={start} style={{ flexDirection: 'row', gap: 8 }}>
              {links.slice(start, start + 2).map((link) => (
                <Pressable
                  key={link.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${link.label}. ${link.detail}`}
                  onPress={() => router.push(link.route as never)}
                  testID={link.testID}
                  style={({ pressed }) => ({
                    flex: 1,
                    padding: 12,
                    gap: 10,
                    borderRadius: 18,
                    backgroundColor: c.field,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <RowIcon icon={link.icon} tone={link.tone} />
                  <View style={{ gap: 2 }}>
                    <Txt role="rowTitle" numberOfLines={1}>
                      {link.label}
                    </Txt>
                    <Txt role={link.detailTone === 'mut' ? 'meta' : 'micro'} tone={link.detailTone} numberOfLines={1}>
                      {link.detail}
                    </Txt>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </Card>

        {others.length > 0 ? (
          <View style={{ gap: 12 }}>
            {others.map((bike) =>
              bike.status === 'archived' ? (
                <GarageBikeCard key={bike.id} bike={bike} distanceUnit={units.distance} volumeUnit={units.volume} testID={`bike-card-${bike.id}`} />
              ) : (
                <GarageBikeCard
                  key={bike.id}
                  bike={bike}
                  distanceUnit={units.distance}
                  volumeUnit={units.volume}
                  onPress={() => switchTo(bike.id, bike.nickname)}
                  testID={`switch-bike-${bike.id}`}
                />
              ),
            )}
          </View>
        ) : null}

        {isPro ? (
          <Button label="Add another motorcycle" icon="plus" variant="secondary" size="xlarge" onPress={addMotorcycle} testID="cta-add-bike" />
        ) : (
          // Figma `Locked — add bike`: the second motorcycle is a Pro feature,
          // and the card says what Pro gives rather than only that it is locked.
          <Pressable accessibilityRole="button" accessibilityLabel="Add another motorcycle, with Pro" onPress={addMotorcycle} testID="cta-add-bike">
            {({ pressed }) => (
              <HeroCard padding={16} gap={0} style={{ opacity: pressed ? 0.85 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.heroTile, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="lock" size={20} color={c.heroAcc} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt role="rowTitleLarge" color={c.heroInk}>
                        Add another motorcycle
                      </Txt>
                      <ProBadge small />
                    </View>
                    <Txt role="meta" color={c.heroMut}>
                      Each bike keeps its own fuel, costs and papers.
                    </Txt>
                    <Txt role="link" color={c.heroAcc}>
                      Upgrade to Pro
                    </Txt>
                  </View>
                </View>
              </HeroCard>
            )}
          </Pressable>
        )}
      </Screen>

      {switchedTo === null ? null : (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: spacing.tabBarClearance - 24 + insets.bottom }}>
          <GarageSwitchedCard nickname={switchedTo} testID="notice-bike-switched" />
        </View>
      )}

      <AddBikeUpsell visible={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </View>
  );
}

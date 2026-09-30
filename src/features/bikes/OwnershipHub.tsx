import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Badge, ListCard, MenuRow, SectionEyebrow, Txt } from '@/components';
import { useAttention } from '@/features/dashboard/useAttention';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDocuments, useWarranties } from '@/features/records/useRecordQueries';

/**
 * Everything the motorcycle owns, in one place.
 *
 * This is what replaces the fifth tab, and it should have shipped with it.
 * Retiring "More" moved a dozen screens behind search and the attention list,
 * which covers the rider who is looking for something specific or being told
 * something is wrong — and covers nobody who simply wants to browse what they
 * have. Warranties, parts, the service history and the Proof Pack became
 * unreachable by tapping, which is not a navigation choice, it is a defect.
 *
 * Grouped the way a rider thinks about the bike rather than by record type:
 * the paperwork, the machine's health, and the machine itself. Each row that
 * can be in a bad state carries that state, so the hub doubles as a status
 * page — a rider who opens it to find the Proof Pack still learns their tax
 * token is expiring.
 *
 * The board draws each row behind a 36px tinted square and puts the trouble in
 * an outlined pill; a row with something to say drops its chevron so the pill
 * has the right-hand edge to itself.
 */
export function OwnershipHub() {
  const router = useRouter();
  const { analytics } = useGarageData();
  const attention = useAttention();
  const documents = useDocuments();
  const warranties = useWarranties();

  const expiringDocuments = attention.items.filter((i) => i.kind === 'document').length;
  const overdueRules = attention.items.filter((i) => i.kind === 'maintenance').length;
  const safetyActions = attention.items.filter((i) => i.kind === 'safety').length;
  const openClaims = (warranties.data ?? []).filter((w) => w.claimStatus === 'open').length;
  const serviceCount = analytics?.services.all.length ?? 0;
  const documentCount = documents.data?.length ?? 0;

  /** The board's `500 12px` tabular count on the right of a quiet row. */
  const count = (value: number) =>
    value > 0 ? (
      <Txt role="meta" tone="mut">
        {String(value)}
      </Txt>
    ) : undefined;

  return (
    <View>
      <SectionEyebrow top={14}>Papers</SectionEyebrow>
      <ListCard>
        <MenuRow
          label="Documents"
          icon="document"
          iconTone="accent"
          right={
            expiringDocuments > 0 ? (
              <Badge label={`${expiringDocuments} EXPIRING`} tone="warn" variant="outlined" />
            ) : (
              count(documentCount)
            )
          }
          chevron={expiringDocuments === 0 && documentCount === 0}
          onPress={() => router.push('/records/vault')}
          testID="hub-documents"
        />
        <MenuRow
          label="Warranties"
          icon="shield"
          iconTone="good"
          right={openClaims > 0 ? <Badge label="CLAIM OPEN" tone="warn" variant="outlined" /> : undefined}
          chevron={openClaims === 0}
          onPress={() => router.push('/records/warranties')}
          testID="hub-warranties"
        />
        <MenuRow
          label="Proof Pack"
          icon="file"
          iconTone="accent"
          onPress={() => router.push('/records/proof-pack')}
          testID="hub-proof-pack"
        />
      </ListCard>

      <SectionEyebrow top={14}>Health</SectionEyebrow>
      <ListCard>
        <MenuRow
          label="Service history"
          icon="wrench"
          iconTone="accent"
          right={count(serviceCount)}
          chevron={serviceCount === 0}
          onPress={() => router.push('/services')}
          testID="hub-services"
        />
        <MenuRow
          label="Maintenance"
          icon="settings"
          iconTone="warn"
          right={overdueRules > 0 ? <Badge label={`${overdueRules} OVERDUE`} tone="bad" variant="outlined" /> : undefined}
          chevron={overdueRules === 0}
          onPress={() => router.push('/maintenance')}
          testID="hub-maintenance"
        />
        <MenuRow
          label="Safety & condition"
          icon="shield"
          iconTone="bad"
          right={safetyActions > 0 ? <Badge label="ACTION" tone="bad" variant="outlined" /> : undefined}
          chevron={safetyActions === 0}
          onPress={() => router.push('/records/safety')}
          testID="hub-safety"
        />
        <MenuRow
          label="Parts & accessories"
          icon="settings"
          iconTone="neutral"
          onPress={() => router.push('/parts')}
          testID="hub-parts"
        />
        {/* Not on the artboard, which draws four rows; the workshop ledger has
            no other way in, and an unreachable screen is a defect, not a
            simplification. */}
        <MenuRow
          label="Workshop records"
          icon="building"
          iconTone="neutral"
          onPress={() => router.push('/services/workshop')}
          testID="hub-workshop"
        />
      </ListCard>

      <SectionEyebrow top={14}>The machine</SectionEyebrow>
      <ListCard>
        <MenuRow
          label="Odometer history"
          icon="odometer"
          iconTone="accent"
          onPress={() => router.push('/garage/odometer')}
          testID="hub-odometer"
        />
        {/* Same reason as Workshop records: the employer allowance is edited
            nowhere else. */}
        <MenuRow
          label="Company allowance"
          icon="banknote"
          iconTone="neutral"
          onPress={() => router.push('/garage/company')}
          testID="hub-company"
        />
        <MenuRow
          label="Edit motorcycle"
          icon="pencil"
          iconTone="neutral"
          onPress={() => router.push('/garage/edit')}
          testID="hub-edit"
        />
      </ListCard>
    </View>
  );
}

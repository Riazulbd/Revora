import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Badge, Card, DividedList, Eyebrow, MenuRow, Txt } from '@/components';
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

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 10 }}>
        <Eyebrow>PAPERS</Eyebrow>
        <Card variant="list" style={{ paddingVertical: 4 }}>
          <DividedList>
            <MenuRow
              label="Documents"
              badge={
                expiringDocuments > 0 ? (
                  <Badge label={`${expiringDocuments} EXPIRING`} tone="warn" size="chip" />
                ) : documentCount > 0 ? (
                  <Txt role="micro" tone="mut">
                    {String(documentCount)}
                  </Txt>
                ) : undefined
              }
              onPress={() => router.push('/records/vault')}
              testID="hub-documents"
            />
            <MenuRow
              label="Warranties"
              badge={openClaims > 0 ? <Badge label="CLAIM OPEN" tone="warn" size="chip" /> : undefined}
              onPress={() => router.push('/records/warranties')}
              testID="hub-warranties"
            />
            <MenuRow
              label="Proof Pack"
              onPress={() => router.push('/records/proof-pack')}
              testID="hub-proof-pack"
            />
          </DividedList>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>HEALTH</Eyebrow>
        <Card variant="list" style={{ paddingVertical: 4 }}>
          <DividedList>
            <MenuRow
              label="Service history"
              badge={
                serviceCount > 0 ? (
                  <Txt role="micro" tone="mut">
                    {String(serviceCount)}
                  </Txt>
                ) : undefined
              }
              onPress={() => router.push('/services')}
              testID="hub-services"
            />
            <MenuRow
              label="Maintenance"
              badge={overdueRules > 0 ? <Badge label={`${overdueRules} OVERDUE`} tone="bad" size="chip" /> : undefined}
              onPress={() => router.push('/maintenance')}
              testID="hub-maintenance"
            />
            <MenuRow
              label="Safety & condition"
              badge={safetyActions > 0 ? <Badge label="ACTION" tone="bad" size="chip" /> : undefined}
              onPress={() => router.push('/records/safety')}
              testID="hub-safety"
            />
            <MenuRow
              label="Parts & accessories"
              onPress={() => router.push('/parts')}
              testID="hub-parts"
            />
            <MenuRow
              label="Workshop records"
              onPress={() => router.push('/services/workshop')}
              testID="hub-workshop"
            />
          </DividedList>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>THE MACHINE</Eyebrow>
        <Card variant="list" style={{ paddingVertical: 4 }}>
          <DividedList>
            <MenuRow
              label="Odometer history"
              onPress={() => router.push('/garage/odometer')}
              testID="hub-odometer"
            />
            <MenuRow
              label="Company allowance"
              onPress={() => router.push('/garage/company')}
              testID="hub-company"
            />
            <MenuRow
              label="Edit motorcycle"
              onPress={() => router.push('/garage/edit')}
              testID="hub-edit"
            />
          </DividedList>
        </Card>
      </View>
    </View>
  );
}

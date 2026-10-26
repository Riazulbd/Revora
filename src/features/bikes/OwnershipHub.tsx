import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Badge, ListCard, MenuRow, SectionEyebrow } from '@/components';
import { agoPhrase } from '@/calculations/dashboard';
import { useAttention } from '@/features/dashboard/useAttention';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useWarranties } from '@/features/records/useRecordQueries';
import { formatCurrencySymbol, formatDistance } from '@/utils/format';

/**
 * Everything the motorcycle owns, in one place (Figma `C2` — Papers, Health,
 * The machine).
 *
 * Grouped the way a rider thinks about the bike rather than by record type:
 * the paperwork, the machine's health, and the machine itself. Each row that
 * can be in a bad state carries that state as a pill, so the hub doubles as a
 * status page — a rider who opens it to find the Proof Pack still learns their
 * tax token is expiring.
 */
export function OwnershipHub() {
  const router = useRouter();
  const { activeBike } = useGarage();
  const { analytics } = useGarageData();
  const attention = useAttention();
  const warranties = useWarranties();

  const expiringDocuments = attention.items.filter((i) => i.kind === 'document').length;
  const overdueRules = attention.items.filter((i) => i.kind === 'maintenance').length;
  const safetyActions = attention.items.filter((i) => i.kind === 'safety').length;
  const openClaims = (warranties.data ?? []).filter((w) => w.claimStatus === 'open').length;

  const latest = analytics?.odometer.latest ?? null;
  const odometerLine =
    analytics && latest
      ? `${formatDistance(latest.metres, analytics.units.distance)} · updated ${agoPhrase(latest.date, analytics.today)}`
      : 'No reading yet';
  const company = activeBike?.company;
  const allowanceLine =
    company && company.enabled
      ? `${company.companyName || 'Company bike'} · ${formatCurrencySymbol(company.monthlyAllowanceMinor, activeBike.currency)} / month`
      : 'Not a company bike';

  return (
    <View>
      <SectionEyebrow>Papers</SectionEyebrow>
      <ListCard>
        <MenuRow
          label="Documents"
          icon="fileText"
          iconTone="accent"
          right={expiringDocuments > 0 ? <Badge label={`${expiringDocuments} expiring`} tone="warn" uppercase /> : undefined}
          onPress={() => router.push('/records/vault')}
          testID="hub-documents"
        />
        <MenuRow
          label="Warranties"
          icon="shield"
          iconTone="good"
          right={openClaims > 0 ? <Badge label="Claim open" tone="warn" uppercase /> : undefined}
          onPress={() => router.push('/records/warranties')}
          testID="hub-warranties"
        />
        <MenuRow label="Proof Pack" icon="fileCheck" iconTone="accent" onPress={() => router.push('/records/proof-pack')} testID="hub-proof-pack" />
      </ListCard>

      <SectionEyebrow>Health</SectionEyebrow>
      <ListCard>
        <MenuRow label="Service history" icon="wrench" iconTone="accent" onPress={() => router.push('/services')} testID="hub-services" />
        <MenuRow
          label="Maintenance"
          icon="settings"
          iconTone="warn"
          right={overdueRules > 0 ? <Badge label={`${overdueRules} overdue`} tone="bad" uppercase /> : undefined}
          onPress={() => router.push('/maintenance')}
          testID="hub-maintenance"
        />
        <MenuRow
          label="Safety & condition"
          icon="shield"
          iconTone="bad"
          right={safetyActions > 0 ? <Badge label="Action" tone="bad" uppercase /> : undefined}
          onPress={() => router.push('/records/safety')}
          testID="hub-safety"
        />
        <MenuRow label="Parts & accessories" icon="package" iconTone="neutral" onPress={() => router.push('/parts')} testID="hub-parts" />
        <MenuRow label="Workshop records" icon="building" iconTone="neutral" onPress={() => router.push('/services/workshop')} testID="hub-workshop" />
      </ListCard>

      <SectionEyebrow>The machine</SectionEyebrow>
      <ListCard>
        <MenuRow
          label="Odometer history"
          subtitle={odometerLine}
          icon="gauge"
          iconTone="accent"
          onPress={() => router.push('/garage/odometer')}
          testID="hub-odometer"
        />
        <MenuRow
          label="Company allowance"
          subtitle={allowanceLine}
          icon="banknote"
          iconTone="neutral"
          onPress={() => router.push('/garage/company')}
          testID="hub-company"
        />
        <MenuRow label="Edit motorcycle" icon="pencil" iconTone="neutral" onPress={() => router.push('/garage/edit')} testID="hub-edit" />
      </ListCard>
    </View>
  );
}

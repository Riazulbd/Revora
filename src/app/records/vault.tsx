import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  HeroCard,
  Icon,
  ListCard,
  RecordRow,
  RowIcon,
  Screen,
  ScreenHeader,
  SkeletonList,
  Txt,
  type IconName,
  type RowTone,
} from '@/components';
import { documentBadgeTone, vaultCounts, vaultRowChip, vaultRowLine } from '@/calculations/documentVault';
import { activeWarranties } from '@/calculations/warranties';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useDocuments, useWarranties } from '@/features/records/useRecordQueries';
import { HeroStat, InkAddButton } from '@/features/records/ui/RecordsChrome';
import { useTheme } from '@/theme';
import { todayIso } from '@/utils/date';
import type { DocumentKind, VaultDocument } from '@/types';

/**
 * The document vault (Figma `R1 Records — Documents vault`).
 *
 * Status is computed from the expiry date every time the screen opens, so a
 * document that lapsed overnight is amber or red the next morning without
 * anything having to run in the background. The hero's three figures are
 * counted from the same status as the rows under them.
 */

/** The glyph for each kind of paper (Figma `Tile`). Presentation only. */
const KIND_ICON: Record<DocumentKind, IconName> = {
  registration: 'file',
  insurance: 'shield',
  tax_token: 'receipt',
  fitness: 'fileCheck',
  licence: 'idCard',
  custom: 'file',
};

export default function DocumentVault() {
  const router = useRouter();
  const { c } = useTheme();
  const { activeBike } = useGarage();
  const documents = useDocuments();
  const warranties = useWarranties();
  const today = todayIso();

  const items = documents.data ?? [];
  const counts = vaultCounts(items, today);
  const activeCover = activeWarranties(warranties.data ?? [], today).length;

  const addDocument = () => router.push('/records/document');

  const header = (
    <ScreenHeader
      title="Documents"
      action={<InkAddButton onPress={addDocument} accessibilityLabel="Add a document" testID="cta-add-document" />}
      style={{ marginBottom: 0 }}
    />
  );

  if (documents.isPending) {
    return (
      <Screen wash testID="screen-vault" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={3} height={112} />
      </Screen>
    );
  }

  return (
    <Screen wash onRefresh={async () => void (await documents.refetch())} testID="screen-vault" contentStyle={{ gap: 16 }}>
      {header}

      {documents.isError ? (
        <ErrorState
          message="Your documents are on this phone and in your account — this screen just couldn't read them."
          onRetry={() => void documents.refetch()}
          testID="error-vault"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="fileText"
          title="No documents yet"
          message="Registration, insurance, tax token, fitness, licence — keep the expiry dates here and Revora reminds you before they lapse."
          primaryAction={{ label: 'Add a document', onPress: addDocument }}
          variant="page"
          testID="empty-vault"
        />
      ) : (
        <>
          {/* Figma `Hero — dark accent`. */}
          <HeroCard gap={14} testID="hero-vault">
            <Txt role="eyebrow" uppercase color={c.heroMut}>{`Papers for ${activeBike?.nickname ?? 'your bike'}`}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt role="hero" color={c.heroInk}>
                {String(counts.total)}
              </Txt>
              <Txt role="cardTitle" color={c.heroMut} style={{ fontWeight: '500' }}>
                {counts.total === 1 ? 'document saved' : 'documents saved'}
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <HeroStat label="Valid" value={String(counts.valid)} color={c.heroGood} testID="stat-vault-valid" />
              <HeroStat label="Due soon" value={String(counts.dueSoon)} color="#F5C26B" testID="stat-vault-due" />
              <HeroStat label="Offline" value={String(counts.offline)} testID="stat-vault-offline" />
            </View>
          </HeroCard>

          {/* Figma `Docs card`: one row per paper, chip or chevron on the right. */}
          <ListCard style={{ paddingVertical: 4 }} testID="list-vault">
            {items.map((document) => (
              <DocumentRow key={document.id} document={document} today={today} />
            ))}
          </ListCard>

          {/* Figma `Links`: the two record sets that live beside the papers. */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <LinkCard
              icon="badgeCheck"
              title="Warranties"
              line={activeCover === 0 ? 'None active' : `${activeCover} active`}
              onPress={() => router.push('/records/warranties')}
              testID="link-warranties"
            />
            <LinkCard
              icon="package"
              title="Proof Pack"
              line="PDF for a buyer"
              onPress={() => router.push('/records/proof-pack')}
              testID="link-proof-pack"
            />
          </View>

          <Button label="Add a document" icon="plus" size="xlarge" onPress={addDocument} testID="cta-add-document-primary" />
        </>
      )}
    </Screen>
  );
}

/** Figma `Row`: the tinted tile, `600 14px` name, `400 12px` line, and a chip or a chevron. */
function DocumentRow({ document, today }: { document: VaultDocument; today: string }) {
  const router = useRouter();
  const tone = documentBadgeTone(document, today);
  const chip = vaultRowChip(document, today);
  const rowTone: RowTone = tone === 'neutral' ? (document.kind === 'custom' ? 'neutral' : 'info') : tone;

  return (
    <RecordRow
      variant="flush"
      icon={KIND_ICON[document.kind]}
      iconTone={rowTone}
      title={document.title}
      subtitle={vaultRowLine(document, today)}
      {...(chip === null ? { chevron: true } : { badge: <Badge label={chip.label} tone={chip.tone} /> })}
      onPress={() => router.push({ pathname: '/records/document', params: { id: document.id } })}
      testID={`document-${document.id}`}
    />
  );
}

/** Figma `Warranties` / `Proof pack`: a square-ish white card with a tile, a `600 14px` title and a line. */
function LinkCard({
  icon,
  title,
  line,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  line: string;
  onPress: () => void;
  testID: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}
    >
      <Card style={{ gap: 10 }}>
        <RowIcon icon={icon} tone="accent" />
        <View style={{ gap: 2 }}>
          <Txt role="rowTitle">{title}</Txt>
          <Txt role="meta" tone="mut">
            {line}
          </Txt>
        </View>
        <View style={{ position: 'absolute', right: 16, top: 16 }}>
          <Icon name="chevronRight" size={20} color={c.faint} />
        </View>
      </Card>
    </Pressable>
  );
}

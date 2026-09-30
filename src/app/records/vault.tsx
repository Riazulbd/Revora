import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  ErrorState,
  Footnote,
  Icon,
  RowIcon,
  Screen,
  SkeletonList,
  Stack,
  TabHeader,
  Txt,
  type IconName,
} from '@/components';
import { DOCUMENT_REFERENCE_LABEL } from '@/calculations/documents';
import {
  documentBadgeLabel,
  documentBadgeTone,
  documentNeedsExpiry,
  vaultValidityLine,
} from '@/calculations/documentVault';
import { useDocuments } from '@/features/records/useRecordQueries';
import { todayIso } from '@/utils/date';
import { useTheme } from '@/theme';
import type { DocumentKind, VaultDocument } from '@/types';

/**
 * The document vault.
 *
 * Status is computed from the expiry date every time the screen opens, so a
 * document that lapsed overnight is red the next morning without anything
 * having to run in the background.
 *
 * The number is the reason most of these records exist — it gets typed into a
 * renewal form or read down a phone at a checkpoint — so it sits on the row at
 * full size with its own copy button, rather than a screen away.
 */

const KIND_ICON: Record<DocumentKind, IconName> = {
  registration: 'file',
  insurance: 'shield',
  tax_token: 'documents',
  fitness: 'checkCircle',
  licence: 'card',
  custom: 'file',
};

const TONE_ROW = { good: 'good', warn: 'warn', bad: 'bad', neutral: 'neutral' } as const;

export default function DocumentVault() {
  const router = useRouter();
  const documents = useDocuments();
  const today = todayIso();

  const items = documents.data ?? [];

  if (documents.isPending) {
    return (
      <Screen testID="screen-vault" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Documents" />
        <SkeletonList count={3} height={112} />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={async () => void (await documents.refetch())}
      testID="screen-vault"
      contentStyle={{ paddingHorizontal: 20 }}
    >
      <TabHeader
        title="Documents"
        action={
          <Button
            label="Add"
            icon="plus"
            size="compact"
            onPress={() => router.push('/records/document')}
            testID="cta-add-document"
          />
        }
      />

      {documents.isError ? (
        <ErrorState
          message="Your documents are on this phone and in your account — this screen just couldn't read them."
          onRetry={() => void documents.refetch()}
          testID="error-vault"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="documents"
          title="No documents yet"
          message="Registration, insurance, tax token, fitness, licence — keep the expiry dates here and Revora reminds you before they lapse."
          primaryAction={{ label: 'Add a document', onPress: () => router.push('/records/document') }}
          variant="page"
          testID="empty-vault"
        />
      ) : (
        <>
          <Stack gap={10}>
            {items.map((document) => (
              <DocumentCard key={document.id} document={document} today={today} />
            ))}
          </Stack>

          <Footnote style={{ marginTop: 12 }}>
            Reminders fire 30, 14 and 3 days before an expiry. Everything here works offline — built for a
            traffic stop.
          </Footnote>
        </>
      )}
    </Screen>
  );
}

function DocumentCard({ document, today }: { document: VaultDocument; today: string }) {
  const router = useRouter();
  const { c, radius } = useTheme();

  const tone = documentBadgeTone(document, today);
  const needsExpiry = documentNeedsExpiry(document);
  const validity = vaultValidityLine(document, today);
  const reference = document.reference?.trim() ?? '';

  // A custom document that never runs out has no term, no countdown and
  // nothing to remind anyone about, so the board gives it a single line.
  const simple = document.expiresOn === null && !needsExpiry;

  const ink =
    tone === 'good' ? c.good : tone === 'warn' ? c.warn : tone === 'bad' ? c.bad : c.mut;

  const open = () => router.push({ pathname: '/records/document', params: { id: document.id } });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${document.title}. ${documentBadgeLabel(document, today)}`}
      onPress={open}
      testID={`document-${document.id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card
        variant="list"
        style={{ paddingVertical: 16, borderRadius: radius.listCard, gap: simple ? 0 : 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <RowIcon tone={TONE_ROW[tone]}>
              <Icon name={KIND_ICON[document.kind]} size={17} color={ink} strokeWidth={1.8} />
            </RowIcon>
            <View style={{ flexShrink: 1 }}>
              <Txt role="cardTitle" numberOfLines={1}>
                {document.title}
              </Txt>
              {simple ? (
                <Txt role="meta" tone="mut" style={{ marginTop: 2 }}>
                  Custom document
                </Txt>
              ) : null}
            </View>
          </View>

          <Badge
            label={documentBadgeLabel(document, today)}
            tone={tone}
            variant={simple ? 'filled' : 'outlined'}
            uppercase
            style={{ flexShrink: 0 }}
          />
        </View>

        {needsExpiry ? (
          <Txt role="meta" tone="warn">
            Add the valid-until date so reminders can fire.
          </Txt>
        ) : validity !== null ? (
          <Txt role="meta" tone="mut">
            {validity}
          </Txt>
        ) : null}

        {reference === '' || simple ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                flex: 1,
                height: 44,
                borderRadius: radius.tile,
                backgroundColor: c.sur2,
                paddingHorizontal: 14,
                justifyContent: 'center',
              }}
            >
              <Txt role="tileValue" numberOfLines={1} style={{ letterSpacing: 0.5 }}>
                {reference}
              </Txt>
            </View>
            <CopyButton
              label={DOCUMENT_REFERENCE_LABEL[document.kind]}
              value={reference}
              testID={`copy-document-${document.id}`}
            />
          </View>
        )}
      </Card>
    </Pressable>
  );
}

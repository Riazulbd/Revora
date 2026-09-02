import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  RecordRow,
  RowIcon,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { documentStatus, useDocuments } from '@/features/records/useRecordQueries';
import { daysBetween, formatLongDate, todayIso } from '@/utils/date';
import { useTheme } from '@/theme';
import type { VaultDocument } from '@/types';

const STATUS_TONE = { valid: 'good', expiring: 'warn', expired: 'bad', no_expiry: 'neutral' } as const;
const STATUS_LABEL = {
  valid: 'VALID',
  expiring: 'EXPIRING',
  expired: 'EXPIRED',
  no_expiry: 'NO EXPIRY',
} as const;

/**
 * The document vault.
 *
 * Status is computed from the expiry date every time the screen opens, so a
 * document that lapsed overnight is red the next morning without anything having
 * to run in the background.
 */
export default function DocumentVault() {
  const router = useRouter();
  const documents = useDocuments();
  const today = todayIso();

  const items = documents.data ?? [];

  if (documents.isPending) {
    return (
      <Screen testID="screen-vault">
        <ScreenHeader title="Document vault" />
        <SkeletonList count={3} height={72} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={async () => void (await documents.refetch())} testID="screen-vault">
      <ScreenHeader
        title="Document vault"
        action={
          <Button
            label="Add"
            size="small"
            onPress={() => router.push('/records/document')}
            testID="cta-add-document"
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon="document"
          title="No documents yet"
          message="Registration, insurance, tax token, fitness, licence — keep the expiry dates here and Revora reminds you before they lapse."
          primaryAction={{ label: 'Add a document', onPress: () => router.push('/records/document') }}
          variant="page"
          testID="empty-vault"
        />
      ) : (
        <Stack gap={14}>
          <View style={{ gap: 12 }}>
            {items.map((document) => (
              <DocumentRow key={document.id} document={document} today={today} />
            ))}
          </View>

          <Txt role="helper" tone="mut">
            Reminders fire at 30, 14 and 3 days before an expiry date.
          </Txt>
        </Stack>
      )}
    </Screen>
  );
}

function DocumentRow({ document, today }: { document: VaultDocument; today: string }) {
  const router = useRouter();
  const { c } = useTheme();
  const status = documentStatus(document, today);
  const days = document.expiresOn === null ? null : daysBetween(today, document.expiresOn);

  const subtitle =
    document.expiresOn === null
      ? (document.reference ?? 'No expiry recorded')
      : days !== null && days < 0
        ? `Expired ${formatLongDate(document.expiresOn)}`
        : `Expires ${formatLongDate(document.expiresOn)}${days !== null ? ` · ${days} days` : ''}`;

  return (
    <RecordRow
      leading={
        <RowIcon tone={status === 'expired' ? 'bad' : status === 'expiring' ? 'warn' : 'neutral'}>
          <Icon
            name="document"
            size={17}
            color={status === 'expired' ? c.bad : status === 'expiring' ? c.warn : c.mut}
          />
        </RowIcon>
      }
      title={document.title}
      subtitle={subtitle}
      onPress={() => router.push({ pathname: '/records/document', params: { id: document.id } })}
      trailing={<Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />}
      testID={`document-${document.id}`}
    />
  );
}

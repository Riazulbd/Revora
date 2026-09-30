import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import * as Sharing from 'expo-sharing';

import {
  Banner,
  Button,
  ButtonRow,
  Card,
  Dialog,
  Divider,
  Eyebrow,
  Footnote,
  Icon,
  LoadingState,
  PhotoThumb,
  Screen,
  ScreenHeader,
  Stack,
  ToggleRow,
  Txt,
  useToast,
} from '@/components';
import { proofPackSummary } from '@/calculations/proofPack';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDocuments } from '@/features/records/useRecordQueries';
import { generateProofPack } from '@/features/records/proofPack';
import { messageFor } from '@/services/errors';
import { fontFamily, useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';

/**
 * The Proof Pack.
 *
 * The PDF is rendered on the device and handed straight to the share sheet —
 * nothing leaves the phone unless the rider sends it, which is exactly what the
 * screen says. The stamp on it claims only what Revora can honestly claim:
 * how many records it was built from, the dates they cover, and a fingerprint
 * of exactly those records. It is not an inspection and the screen says that
 * too, because a certificate that overclaims is worse than none.
 */
export default function ProofPack() {
  const toast = useToast();
  const { activeBike } = useGarage();
  const { analytics } = useGarageData();
  const documents = useDocuments();

  const [buyerSafe, setBuyerSafe] = useState(true);
  const [consent, setConsent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readyUri, setReadyUri] = useState<string | null>(null);

  const loaded = documents.data;
  const documentList = useMemo(() => loaded ?? [], [loaded]);

  const summary = useMemo(
    () => (analytics === null ? null : proofPackSummary({ analytics, documents: documentList })),
    [analytics, documentList],
  );

  const bikeName = activeBike === null ? NO_VALUE : activeBike.nickname.trim() === ''
    ? `${activeBike.manufacturer} ${activeBike.model}`.trim()
    : activeBike.nickname;

  const generate = async () => {
    if (!activeBike || !analytics) return;
    setBusy(true);
    setConfirmOpen(false);
    try {
      const uri = await generateProofPack({
        bike: activeBike,
        analytics,
        documents: documentList,
        options: { buyerSafe, consentGiven: consent },
      });
      setReadyUri(uri);
      toast.show('Proof Pack generated on this device');
    } catch (error) {
      toast.show(messageFor(error, "Couldn't generate the Proof Pack."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const hand = async (dialogTitle: string) => {
    if (readyUri === null) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        toast.show('This device has no app that can take a PDF.', 'error');
        return;
      }
      await Sharing.shareAsync(readyUri, {
        mimeType: 'application/pdf',
        dialogTitle,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      toast.show(messageFor(error, "Couldn't hand over the PDF."), 'error');
    }
  };

  const header = (
    <ScreenHeader
      title="Proof Pack"
      subtitle="A printable ownership history for a buyer. Rendered on this phone — nothing is uploaded."
      style={{ marginBottom: 14 }}
    />
  );

  if (busy) {
    return (
      <Screen testID="screen-proof-pack">
        {header}
        <LoadingState
          variant="card"
          title="Building your Proof Pack…"
          message={`Rendering on this phone — ${summary?.certificate.recordCount ?? 0} records, nothing uploaded.`}
          testID="state-proof-generating"
        />
      </Screen>
    );
  }

  if (readyUri !== null && summary !== null) {
    return (
      <Screen testID="screen-proof-pack">
        {header}
        <View style={{ gap: 14, marginTop: 4 }} testID="state-proof-ready">
          <Card style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <PhotoThumb width={56} height={72} radius={8} bordered tone="acc" accessibilityLabel="Proof Pack" />
            <View style={{ flex: 1 }}>
              <Txt role="tileValue">Proof Pack · {bikeName}</Txt>
              <Txt role="meta" tone="mut" style={{ marginTop: 3 }}>
                {summary.certificate.recordCount} record{summary.certificate.recordCount === 1 ? '' : 's'} ·{' '}
                {summary.coverage ?? NO_VALUE} · {buyerSafe ? 'buyer-safe' : 'full costs'}
              </Txt>
              <Txt role="micro" tone="mut" style={{ marginTop: 3 }}>
                Ref {summary.certificate.reference} — fingerprints exactly these records
              </Txt>
            </View>
          </Card>

          <ButtonRow>
            <Button
              label="Share PDF"
              onPress={() => void hand('Revora Proof Pack')}
              size="large"
              flex
              testID="cta-share-proof"
            />
            <Button
              label="Open"
              variant="secondary"
              onPress={() => void hand('Open the Proof Pack')}
              size="large"
              flex
              testID="cta-open-proof"
            />
          </ButtonRow>

          <Button
            label="Build it again"
            variant="ghost"
            tone="mut"
            size="medium"
            onPress={() => setReadyUri(null)}
            testID="cta-rebuild-proof"
          />
        </View>
      </Screen>
    );
  }

  const empty = summary === null || summary.isEmpty;

  return (
    <Screen testID="screen-proof-pack">
      {header}

      <Stack gap={10}>
        <Card style={{ gap: 10 }}>
          <Eyebrow>INCLUDED</Eyebrow>
          <Txt
            style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 24.7 }}
            testID="proof-included"
          >
            {(summary?.included ?? ['Motorcycle details']).join(' · ')}
          </Txt>
        </Card>

        <Card variant="list" style={{ paddingVertical: 4 }}>
          <ToggleRow
            title="Buyer-safe mode"
            description="Every price is left out of the PDF, not hidden"
            value={buyerSafe}
            onChange={setBuyerSafe}
            testID="toggle-buyer-safe"
          />
          <Divider />
          <ToggleRow
            title="Ownership-transfer consent"
            description="Recorded with a timestamp on the report"
            value={consent}
            onChange={setConsent}
            testID="toggle-consent"
          />
        </Card>

        <ProvenanceNote />

        {summary !== null && summary.isThin && summary.monthsCovered !== null ? (
          <Banner
            tone="warn"
            icon="alertTriangle"
            compact
            lead="Thin log:"
            message={`only ${summary.monthsCovered} month${
              summary.monthsCovered === 1 ? '' : 's'
            } of records. The pack will say so — a buyer can see the coverage dates.`}
            testID="banner-thin-log"
          />
        ) : null}

        <Button
          label="Generate PDF"
          onPress={() => setConfirmOpen(true)}
          size="large"
          disabled={empty}
          style={{ marginTop: 6 }}
          testID="cta-generate-proof"
        />

        {empty ? (
          <Footnote style={{ marginTop: 2 }}>
            Log a fill-up or a service first — a Proof Pack with nothing in it proves nothing.
          </Footnote>
        ) : null}
      </Stack>

      <Dialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Generate Proof Pack?"
        message={`A printable PDF will be created on this device${
          buyerSafe ? ' with prices hidden' : ' including every cost you logged'
        }.${consent ? ' Ownership-transfer consent is recorded with today’s date.' : ''}`}
        confirmLabel="Generate"
        busy={busy}
        onConfirm={generate}
        testID="dialog-generate-proof"
      />
    </Screen>
  );
}

/**
 * What the stamp is, and what it is not.
 *
 * Worth a block of its own because it is the one claim Revora makes on a
 * document a stranger will read, and the wording has to survive being read by
 * someone about to hand over money.
 */
function ProvenanceNote() {
  const { c, radius } = useTheme();

  return (
    <View
      style={{
        borderRadius: radius.card,
        backgroundColor: c.sur2,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View style={{ marginTop: 2, flexShrink: 0 }}>
        <Icon name="shield" size={22} color={c.mut} strokeWidth={2} />
      </View>
      <Txt style={{ flex: 1, fontFamily: fontFamily[500], fontSize: 12, lineHeight: 18.6 }}>
        <Txt style={{ fontFamily: fontFamily[700], fontSize: 12, lineHeight: 18.6 }}>
          The stamp certifies provenance only
        </Txt>
        {
          ' — record count, dates covered, and a reference that fingerprints exactly these records so a buyer can ask for a fresh copy and compare. Revora has never seen the motorcycle; this is not an inspection.'
        }
      </Txt>
    </View>
  );
}

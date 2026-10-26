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
  HeroCard,
  Icon,
  LoadingState,
  PhotoThumb,
  ProBadge,
  Screen,
  ScreenHeader,
  StatRow,
  StatTile,
  ToggleRow,
  Txt,
  useToast,
} from '@/components';
import { proofPackSummary } from '@/calculations/proofPack';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { useDocuments } from '@/features/records/useRecordQueries';
import { generateProofPack } from '@/features/records/proofPack';
import { messageFor } from '@/services/errors';
import { useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';

/**
 * The Proof Pack (Figma `R7 Records — Proof Pack (Pro)`).
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
  const { c } = useTheme();
  const { activeBike } = useGarage();
  const { analytics } = useGarageData();
  const documents = useDocuments();
  const gate = useProGate();

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
  const bikeLine = activeBike === null ? NO_VALUE : `${bikeName} · ${[activeBike.manufacturer, activeBike.model].filter(Boolean).join(' ')}`;

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
    <ScreenHeader title="Proof Pack" action={<ProBadge />} style={{ marginBottom: 0 }} />
  );

  if (busy) {
    return (
      <Screen wash testID="screen-proof-pack" contentStyle={{ gap: 16 }}>
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
      <Screen wash testID="screen-proof-pack" contentStyle={{ gap: 16 }}>
        {header}
        <View style={{ gap: 16 }} testID="state-proof-ready">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <PhotoThumb width={56} height={72} radius={8} bordered tone="acc" accessibilityLabel="Proof Pack" />
            <View style={{ flex: 1, gap: 3 }}>
              <Txt role="cardTitle">Proof Pack · {bikeName}</Txt>
              <Txt role="meta" tone="mut">
                {summary.certificate.recordCount} record{summary.certificate.recordCount === 1 ? '' : 's'} ·{' '}
                {summary.coverage ?? NO_VALUE} · {buyerSafe ? 'buyer-safe' : 'full costs'}
              </Txt>
              <Txt role="micro" tone="mut">
                Ref {summary.certificate.reference} — fingerprints exactly these records
              </Txt>
            </View>
          </Card>

          <ButtonRow>
            <Button label="Share PDF" icon="send" size="xlarge" padX={12} flex onPress={() => void hand('Revora Proof Pack')} testID="cta-share-proof" />
            <Button label="Open" variant="secondary" size="xlarge" padX={12} flex onPress={() => void hand('Open the Proof Pack')} testID="cta-open-proof" />
          </ButtonRow>

          <Button label="Build it again" variant="ghost" tone="mut" size="medium" onPress={() => setReadyUri(null)} testID="cta-rebuild-proof" />
        </View>
      </Screen>
    );
  }

  const empty = summary === null || summary.isEmpty;

  return (
    <Screen wash testID="screen-proof-pack" contentStyle={{ gap: 16 }}>
      {header}

      {/* Figma `Hero — dark accent`: what the pack is, and how much it holds. */}
      <HeroCard gap={16} testID="hero-proof-pack">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Txt role="eyebrow" uppercase color={c.heroMut}>
              Revora Proof Pack
            </Txt>
            <Txt role="headline" color={c.heroInk}>
              A history a buyer can check
            </Txt>
            <Txt role="meta" color={c.heroMut} numberOfLines={1}>
              {bikeLine}
            </Txt>
          </View>
          <PdfMock />
        </View>
        <StatRow>
          <StatTile variant="hero" valueSize="md" label="Covers" value={summary?.monthsCovered === null || summary === null ? undefined : `${summary.monthsCovered} mo`} testID="stat-proof-covers" />
          <StatTile variant="hero" valueSize="md" label="Records" value={summary === null ? undefined : String(summary.certificate.recordCount)} testID="stat-proof-records" />
          <StatTile variant="hero" valueSize="md" label="Photos" value={summary === null ? undefined : String(summary.photos)} testID="stat-proof-photos" />
        </StatRow>
      </HeroCard>

      {/* Figma `Included`. */}
      <Card style={{ gap: 12 }} testID="proof-included">
        <Eyebrow>Included</Eyebrow>
        {(summary?.includedLines ?? ['Motorcycle details · chassis and engine no.']).map((line) => (
          <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="circleCheck" size={18} color={c.good} />
            <Txt role="bullet" style={{ flex: 1 }}>
              {line}
            </Txt>
          </View>
        ))}
      </Card>

      {/* Figma `Options`. */}
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

      {summary !== null && summary.isThin && summary.monthsCovered !== null ? (
        <Banner
          tone="warn"
          icon="triangleAlert"
          compact
          lead="Thin log:"
          message={`only ${summary.monthsCovered} month${summary.monthsCovered === 1 ? '' : 's'} of records. The pack will say so — a buyer can see the coverage dates.`}
          testID="banner-thin-log"
        />
      ) : null}

      {/* Figma `Provenance`: the one claim the stamp makes. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="lock" size={16} color={c.mut} />
        <Txt role="micro" tone="mut">
          Proof Pack generated on this device
        </Txt>
      </View>

      <Button
        label="Generate PDF"
        icon="fileDown"
        size="xlarge"
        onPress={() => (gate.isPro ? setConfirmOpen(true) : gate.open('The Proof Pack'))}
        disabled={empty}
        testID="cta-generate-proof"
      />

      {empty ? (
        <Footnote style={{ marginTop: 0 }}>Log a fill-up or a service first — a Proof Pack with nothing in it proves nothing.</Footnote>
      ) : null}

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

      <ProUpsellSheet gate={gate} />
    </Screen>
  );
}

/** Figma `PDF mock`: a 76×100 white page with the accent rule, a heading, a tinted chart and body lines. */
function PdfMock() {
  const { c } = useTheme();
  const line = (width: number, height: number, color: string) => (
    <View style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />
  );
  return (
    <View style={{ width: 76, height: 100, borderRadius: 10, backgroundColor: '#FFFFFF', padding: 8, gap: 5 }} accessibilityElementsHidden>
      {line(28, 6, c.acc)}
      {line(56, 5, '#14171B')}
      {line(44, 4, '#C9CED4')}
      <View style={{ width: 60, height: 22, borderRadius: 4, backgroundColor: '#FDEAE3' }} />
      {line(60, 4, '#E9EBEF')}
      {line(52, 4, '#E9EBEF')}
      {line(40, 4, '#E9EBEF')}
    </View>
  );
}

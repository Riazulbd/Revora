import React, { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  Dialog,
  Divider,
  Eyebrow,
  Icon,
  Screen,
  ScreenHeader,
  Stack,
  ToggleRow,
  Txt,
  useToast,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDocuments } from '@/features/records/useRecordQueries';
import { generateProofPack } from '@/features/records/proofPack';
import { messageFor } from '@/services/errors';
import { useTheme } from '@/theme';

/**
 * The Proof Pack.
 *
 * The PDF is rendered on the device and handed straight to the share sheet —
 * nothing leaves the phone unless the rider sends it, which is exactly what the
 * screen says.
 */
export default function ProofPack() {
  const { c } = useTheme();
  const toast = useToast();
  const { activeBike } = useGarage();
  const { analytics } = useGarageData();
  const documents = useDocuments();

  const [buyerSafe, setBuyerSafe] = useState(true);
  const [consent, setConsent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const included = analytics
    ? [
        {
          label: `Service history · ${analytics.services.all.length} record${analytics.services.all.length === 1 ? '' : 's'}`,
          on: analytics.services.all.length > 0,
        },
        {
          label: `Fuel & mileage log · ${analytics.fuel.entries.length} fill${analytics.fuel.entries.length === 1 ? '' : 's'}`,
          on: analytics.fuel.entries.length > 0,
        },
        {
          label: `Parts & odometer history · ${analytics.odometer.points.length} reading${analytics.odometer.points.length === 1 ? '' : 's'}`,
          on: analytics.odometer.points.length > 0,
        },
        {
          label: `Document validity · ${(documents.data ?? []).length} document${(documents.data ?? []).length === 1 ? '' : 's'}`,
          on: (documents.data ?? []).length > 0,
        },
        {
          label: buyerSafe ? 'Costs & prices — hidden by buyer-safe mode' : 'Costs & prices — included',
          on: !buyerSafe,
        },
      ]
    : [];

  const generate = async () => {
    if (!activeBike || !analytics) return;
    setBusy(true);
    try {
      await generateProofPack({
        bike: activeBike,
        analytics,
        documents: documents.data ?? [],
        options: { buyerSafe, consentGiven: consent },
      });
      setConfirmOpen(false);
      toast.show('Proof Pack generated on this device');
    } catch (error) {
      toast.show(messageFor(error, "Couldn't generate the Proof Pack."), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="screen-proof-pack">
      <ScreenHeader
        title="Proof pack"
        subtitle="A printable, buyer-safe history report for resale"
        style={{ marginBottom: 16 }}
      />

      <Stack>
        <Card>
          <Eyebrow>INCLUDED</Eyebrow>
          <View style={{ gap: 10, marginTop: 12 }}>
            {included.map((item) => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Icon
                  name={item.on ? 'checkCircle' : 'cross'}
                  size={16}
                  color={item.on ? c.good : c.mut}
                  strokeWidth={1.8}
                />
                <Txt role="smallStrong" tone={item.on ? 'ink' : 'mut'} style={{ flex: 1 }}>
                  {item.label}
                </Txt>
              </View>
            ))}
          </View>
        </Card>

        <Card variant="list">
          <ToggleRow
            title="Buyer-safe mode"
            description="Hides what you paid — shows only care & condition"
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

        <Button
          label="Generate printable PDF"
          onPress={() => setConfirmOpen(true)}
          disabled={!analytics || analytics.isEmpty}
          testID="cta-generate-proof"
        />

        <Txt role="helper" tone="mut" align="center">
          {analytics && analytics.isEmpty
            ? 'Log a fill-up or a service first — a Proof Pack with nothing in it proves nothing.'
            : 'Generated on this device. Nothing is uploaded; you choose who to send it to.'}
        </Txt>
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

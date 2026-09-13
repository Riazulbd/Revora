import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { BikeAnalytics } from '@/calculations/analytics';
import { proofCertificate, type AttestedRecord } from '@/calculations/certificate';
import { REVORA_MARK_DATA_URI } from '@/features/records/brandMark';
import { documentStatus } from '@/calculations/documents';
import { AppError } from '@/services/errors';
import type { Bike, VaultDocument } from '@/types';
import { formatLongDate, todayIso } from '@/utils/date';
import { formatCurrency, formatDistance, formatMileage, formatVolume, NO_VALUE } from '@/utils/format';

/**
 * The Proof Pack — a printable ownership history for resale.
 *
 * Rendered to a PDF on the device with expo-print. Nothing is uploaded, which is
 * what the screen promises, and buyer-safe mode genuinely omits every figure the
 * rider paid rather than hiding it behind a style rule.
 */

export type ProofPackOptions = {
  buyerSafe: boolean;
  consentGiven: boolean;
};

/** Fuel rows are capped so a long log does not run to fifty pages. */
const FUEL_ROW_LIMIT = 40;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Exactly the records the document prints, in the order it prints them.
 *
 * The certificate has to describe what a reader can see: counting an expense
 * that never appears in any table would make the stamp claim more than the
 * page shows, and omitting a printed service would let one be altered without
 * the reference changing.
 */
function attestedRecords(input: {
  analytics: BikeAnalytics;
  documents: readonly VaultDocument[];
}): AttestedRecord[] {
  const { analytics, documents } = input;
  return [
    ...analytics.services.all.map((s) => ({
      kind: 'service',
      id: s.id,
      date: s.date,
      figure: s.totalCostMinor,
    })),
    ...analytics.fuel.entries.slice(0, FUEL_ROW_LIMIT).map((f) => ({
      kind: 'fuel',
      id: f.id,
      date: f.date,
      figure: f.odometerMetres,
    })),
    ...[...analytics.parts.active, ...analytics.parts.removed].map(({ part }) => ({
      kind: 'part',
      id: part.id,
      date: part.installedDate,
      figure: part.installedOdometerMetres,
    })),
    ...documents.map((d) => ({
      kind: 'document',
      id: d.id,
      date: d.expiresOn,
      figure: null,
    })),
  ];
}

function row(label: string, value: string): string {
  return `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`;
}

export function buildProofPackHtml(input: {
  bike: Bike;
  analytics: BikeAnalytics;
  documents: readonly VaultDocument[];
  options: ProofPackOptions;
}): string {
  const { bike, analytics, documents, options } = input;
  const units = analytics.units;
  const today = todayIso();
  const money = (minor: number | null) =>
    options.buyerSafe ? 'Hidden (buyer-safe)' : formatCurrency(minor, analytics.currency);

  const serviceRows = analytics.services.all
    .map(
      (service) => `
        <tr>
          <td>${escapeHtml(formatLongDate(service.date))}</td>
          <td>${escapeHtml(service.title)}</td>
          <td>${escapeHtml(service.selfService ? 'Self-service' : (service.workshop ?? '—'))}</td>
          <td>${escapeHtml(
            service.odometerMetres === null ? NO_VALUE : formatDistance(service.odometerMetres, units.distance),
          )}</td>
          <td>${escapeHtml(money(service.totalCostMinor))}</td>
        </tr>`,
    )
    .join('');

  const fuelRows = analytics.fuel.entries
    .slice(0, FUEL_ROW_LIMIT)
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(formatLongDate(entry.date))}</td>
          <td>${escapeHtml(formatDistance(entry.odometerMetres, units.distance))}</td>
          <td>${escapeHtml(formatVolume(entry.litresMl, units.volume))}</td>
          <td>${escapeHtml(entry.fillType)}</td>
          <td>${escapeHtml(money(entry.totalCostMinor))}</td>
        </tr>`,
    )
    .join('');

  const partRows = [...analytics.parts.active, ...analytics.parts.removed]
    .map(
      ({ part, life }) => `
        <tr>
          <td>${escapeHtml(part.name)}</td>
          <td>${escapeHtml(formatDistance(part.installedOdometerMetres, units.distance))}</td>
          <td>${escapeHtml(formatDistance(life.usedMetres, units.distance))}</td>
          <td>${escapeHtml(life.isRemoved ? 'Removed' : 'Fitted')}</td>
        </tr>`,
    )
    .join('');

  const certificate = proofCertificate(attestedRecords({ analytics, documents }));
  const coverage =
    certificate.firstDate === null || certificate.lastDate === null
      ? 'No dated records'
      : certificate.firstDate === certificate.lastDate
        ? formatLongDate(certificate.firstDate)
        : `${formatLongDate(certificate.firstDate)} — ${formatLongDate(certificate.lastDate)}`;

  const documentRows = documents
    .map((document) => {
      const status = documentStatus(document, today);
      return `
        <tr>
          <td>${escapeHtml(document.title)}</td>
          <td>${escapeHtml(document.expiresOn ? formatLongDate(document.expiresOn) : 'No expiry')}</td>
          <td>${escapeHtml(status.replace('_', ' '))}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Revora Proof Pack</title>
<style>
  body { font-family: -apple-system, Roboto, "Helvetica Neue", sans-serif; color: #14171B; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: #878E98; margin: 28px 0 8px; }
  .sub { color: #878E98; font-size: 12px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { text-align: left; color: #878E98; font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
       border-bottom: 1px solid #E9EBEF; padding: 6px 4px; }
  td { padding: 7px 4px; border-bottom: 1px solid #F1F2F5; vertical-align: top; }
  td.label { color: #878E98; width: 45%; }
  td.value { font-weight: 600; }
  .note { font-size: 10.5px; color: #878E98; margin-top: 24px; line-height: 1.6; }
  .empty { color: #878E98; font-size: 11.5px; padding: 8px 4px; }

  .masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
              border-bottom: 2px solid #14171B; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark { width: 46px; height: 46px; }
  .wordmark { font-size: 21px; font-weight: 800; letter-spacing: .11em; line-height: 1; }
  .kicker { font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: #878E98; margin-top: 4px; }

  /* A seal earns its look from the double rule and the tilt, not from claiming
     more than Revora can know — the wording below it is deliberately narrow. */
  .stamp { border: 2px solid #F4511E; border-radius: 10px; padding: 3px; margin: 2px 8px 2px 0;
           transform: rotate(-3deg); flex: none; }
  .stamp-inner { border: 1px solid #F4511E; border-radius: 7px; padding: 8px 14px; text-align: center;
                 color: #F4511E; }
  .stamp-title { font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  .stamp-rule { height: 1px; background: #F4511E; opacity: .4; margin: 6px 0; }
  .stamp-line { font-size: 8.5px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700;
                line-height: 1.5; }
  .stamp-ref { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; font-weight: 800;
               letter-spacing: .1em; margin-top: 4px; }
  .scope { border: 1px solid #E9EBEF; border-radius: 8px; padding: 10px 12px; margin-top: 20px;
           font-size: 10px; color: #878E98; line-height: 1.65; }
  .scope b { color: #14171B; }
</style></head>
<body>
  <div class="masthead">
    <div class="brand">
      <img class="mark" src="${REVORA_MARK_DATA_URI}" alt="">
      <div>
        <div class="wordmark">REVORA</div>
        <div class="kicker">Ownership record</div>
      </div>
    </div>
    <div class="stamp">
      <div class="stamp-inner">
        <div class="stamp-title">Certified by Revora</div>
        <div class="stamp-rule"></div>
        <div class="stamp-line">
          ${certificate.recordCount} record${certificate.recordCount === 1 ? '' : 's'}<br>
          ${escapeHtml(coverage)}<br>
          Issued ${escapeHtml(formatLongDate(today))}
        </div>
        <div class="stamp-ref">${escapeHtml(certificate.reference)}</div>
      </div>
    </div>
  </div>

  <h1>${escapeHtml(bike.nickname)}</h1>
  <p class="sub">
    Ownership record generated by Revora on ${escapeHtml(formatLongDate(today))}${
      options.buyerSafe ? ' · buyer-safe mode: prices hidden' : ''
    }
  </p>

  <h2>Motorcycle</h2>
  <table>
    ${row('Manufacturer', bike.manufacturer || NO_VALUE)}
    ${row('Model', bike.model || NO_VALUE)}
    ${row('Year', bike.year === null ? NO_VALUE : String(bike.year))}
    ${row('Current odometer', formatDistance(analytics.odometer.currentMetres, units.distance))}
    ${row('Distance recorded', formatDistance(analytics.odometer.totalDistanceMetres, units.distance))}
    ${row(
      'Average consumption',
      analytics.mileage.average ? formatMileage(analytics.mileage.average, units.mileage) : 'Not enough data',
    )}
    ${row('Full-to-full intervals', String(analytics.mileage.count))}
  </table>

  <h2>Service history · ${analytics.services.all.length} record${analytics.services.all.length === 1 ? '' : 's'}</h2>
  ${
    serviceRows === ''
      ? '<p class="empty">No services recorded.</p>'
      : `<table><thead><tr><th>Date</th><th>Work</th><th>By</th><th>Odometer</th><th>Cost</th></tr></thead><tbody>${serviceRows}</tbody></table>`
  }

  <h2>Fuel &amp; mileage · ${analytics.fuel.entries.length} fill${analytics.fuel.entries.length === 1 ? '' : 's'}</h2>
  ${
    fuelRows === ''
      ? '<p class="empty">No fuel logs recorded.</p>'
      : `<table><thead><tr><th>Date</th><th>Odometer</th><th>Fuel</th><th>Type</th><th>Cost</th></tr></thead><tbody>${fuelRows}</tbody></table>`
  }

  <h2>Parts</h2>
  ${
    partRows === ''
      ? '<p class="empty">No parts recorded.</p>'
      : `<table><thead><tr><th>Part</th><th>Fitted at</th><th>Distance run</th><th>Status</th></tr></thead><tbody>${partRows}</tbody></table>`
  }

  <h2>Documents</h2>
  ${
    documentRows === ''
      ? '<p class="empty">No documents recorded.</p>'
      : `<table><thead><tr><th>Document</th><th>Expires</th><th>Status</th></tr></thead><tbody>${documentRows}</tbody></table>`
  }

  <div class="scope">
    <b>What this stamp certifies.</b> Revora generated this document from
    ${certificate.recordCount} record${certificate.recordCount === 1 ? '' : 's'} held in the owner's logbook, and
    reference <b>${escapeHtml(certificate.reference)}</b> is a fingerprint of exactly those records. Regenerating
    the pack from unchanged records reproduces the same reference; altering, adding or removing any record
    changes it. Ask the seller to generate a fresh copy and compare.<br>
    <b>What it does not certify.</b> Revora has never seen this motorcycle. It does not verify that the work
    listed was carried out, that the odometer is genuine, or that the machine is roadworthy. This is a record of
    what the owner logged — not an independent inspection, and no substitute for one.
  </div>

  <p class="note">
    Every figure in this report comes from records the owner logged in Revora. Consumption is measured between
    full-tank fills only. ${
      options.consentGiven
        ? `Ownership-transfer consent recorded on ${escapeHtml(formatLongDate(today))}.`
        : 'Ownership-transfer consent has not been recorded.'
    }
  </p>
</body></html>`;
}

export async function generateProofPack(input: {
  bike: Bike;
  analytics: BikeAnalytics;
  documents: readonly VaultDocument[];
  options: ProofPackOptions;
}): Promise<string> {
  const html = buildProofPackHtml(input);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Revora Proof Pack',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new AppError('unknown', 'The PDF was created but this device cannot share it.');
  }

  return uri;
}

import type { DocumentKind, VaultDocument } from '@/types';
import {
  documentBadgeLabel,
  documentBadgeTone,
  documentNeedsExpiry,
  vaultCounts,
  vaultRowChip,
  vaultRowLine,
  vaultValidityLine,
} from './documentVault';

const TODAY = '2026-09-16';

const doc = (over: Partial<VaultDocument> = {}): VaultDocument => ({
  id: 'd1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  kind: 'tax_token' as DocumentKind,
  customKindLabel: null,
  title: 'Tax token',
  reference: 'DHA-TT-4471982',
  issuedOn: '2026-03-12',
  expiresOn: '2026-09-28',
  filePath: null,
  keepOfflineCopy: true,
  notes: null,
  clientRef: 'd1',
  ...over,
});

describe('the pill on a vault row', () => {
  it('counts the days left, as the board does', () => {
    expect(documentBadgeLabel(doc(), TODAY)).toBe('EXPIRING · 12 DAYS');
    expect(documentBadgeTone(doc(), TODAY)).toBe('warn');
  });

  it('calls a document valid once it is past the warning window', () => {
    const d = doc({ expiresOn: '2027-03-11' });
    expect(documentBadgeLabel(d, TODAY)).toBe('VALID · 176 DAYS');
    expect(documentBadgeTone(d, TODAY)).toBe('good');
  });

  it('counts the other way once it has lapsed', () => {
    const d = doc({ expiresOn: '2026-09-12' });
    expect(documentBadgeLabel(d, TODAY)).toBe('EXPIRED · 4 DAYS AGO');
    expect(documentBadgeTone(d, TODAY)).toBe('bad');
  });

  it('reads as a sentence on the last day, not as "0 days"', () => {
    expect(documentBadgeLabel(doc({ expiresOn: TODAY }), TODAY)).toBe('EXPIRES TODAY');
  });

  it('agrees in number', () => {
    expect(documentBadgeLabel(doc({ expiresOn: '2026-09-17' }), TODAY)).toBe('EXPIRING · 1 DAY');
    expect(documentBadgeLabel(doc({ expiresOn: '2026-09-15' }), TODAY)).toBe('EXPIRED · 1 DAY AGO');
  });
});

describe('a document with no end date', () => {
  it('distinguishes one that was never told from one that never runs out', () => {
    const undated = doc({ expiresOn: null });
    const custom = doc({ kind: 'custom', title: 'Purchase invoice', expiresOn: null });

    expect(documentNeedsExpiry(undated)).toBe(true);
    expect(documentBadgeLabel(undated, TODAY)).toBe('NO EXPIRY RECORDED');
    expect(documentBadgeTone(undated, TODAY)).toBe('warn');

    expect(documentNeedsExpiry(custom)).toBe(false);
    expect(documentBadgeLabel(custom, TODAY)).toBe('NEVER EXPIRES');
    expect(documentBadgeTone(custom, TODAY)).toBe('neutral');
  });
});

describe('the validity line', () => {
  it('states the term when both dates are known', () => {
    expect(vaultValidityLine(doc(), TODAY)).toBe('12 Mar 2026 — valid until 28 Sep 2026');
  });

  it('states the deadline alone when there is no issue date', () => {
    expect(vaultValidityLine(doc({ issuedOn: null }), TODAY)).toBe('valid until 28 Sep 2026');
  });

  it('says expired rather than valid once the date has gone', () => {
    expect(vaultValidityLine(doc({ expiresOn: '2026-09-12' }), TODAY)).toBe(
      '12 Mar 2026 — expired 12 Sep 2026',
    );
  });

  it('does not repeat the pill when there is no term to state', () => {
    expect(vaultValidityLine(doc({ issuedOn: null, expiresOn: null }), TODAY)).toBeNull();
    expect(vaultValidityLine(doc({ expiresOn: null }), TODAY)).toBe('Issued 12 Mar 2026');
  });
});

describe('the Figma vault row', () => {
  it('counts down inside the warning window and names the term', () => {
    expect(vaultRowChip(doc(), TODAY)).toEqual({ label: '12 days', tone: 'warn' });
    expect(vaultRowLine(doc({ reference: null }), TODAY)).toBe('Valid until 28 Sep 2026');
    expect(vaultRowLine(doc(), TODAY)).toBe('DHA-TT-4471982 · until 28 Sep 2026');
  });

  it('reads Valid outside the window and Expired after the date', () => {
    expect(vaultRowChip(doc({ expiresOn: '2027-01-14' }), TODAY)).toEqual({ label: 'Valid', tone: 'good' });
    expect(vaultRowChip(doc({ expiresOn: '2026-09-01' }), TODAY)).toEqual({ label: 'Expired', tone: 'bad' });
    expect(vaultRowLine(doc({ reference: null, expiresOn: '2026-09-01' }), TODAY)).toBe('Expired 1 Sep 2026');
  });

  it('gives a document with no term a line and no chip', () => {
    const custom = doc({ kind: 'custom', reference: null, expiresOn: null, issuedOn: null });
    expect(vaultRowChip(custom, TODAY)).toBeNull();
    expect(vaultRowLine(custom, TODAY)).toBe('Custom document · No expiry');
    expect(vaultRowLine(doc({ kind: 'registration', reference: 'DHAKA METRO-HA 12-3456', expiresOn: null }), TODAY)).toBe(
      'DHAKA METRO-HA 12-3456 · No expiry recorded',
    );
  });

  it('counts the hero figures from the same status', () => {
    const counts = vaultCounts(
      [
        doc(),
        doc({ id: 'd2', expiresOn: '2027-01-14' }),
        doc({ id: 'd3', expiresOn: '2026-01-01', keepOfflineCopy: false }),
        doc({ id: 'd4', kind: 'custom', expiresOn: null }),
      ],
      TODAY,
    );
    expect(counts).toEqual({ total: 4, valid: 1, dueSoon: 1, expired: 1, offline: 3 });
  });
});

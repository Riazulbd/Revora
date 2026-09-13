import type { VaultDocument } from '@/types';
import {
  DOCUMENT_REFERENCE_LABEL,
  documentStatus,
  expiryLabel,
  isTimeLimited,
  validityLine,
} from './documents';

const doc = (over: Partial<VaultDocument> = {}): VaultDocument => ({
  id: 'd1', userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  kind: 'tax_token', customKindLabel: null, title: 'Tax token',
  reference: 'DM-4432871', issuedOn: null, expiresOn: null,
  filePath: null, keepOfflineCopy: true, notes: null, clientRef: 'r1',
  ...over,
});

describe('which documents carry a term', () => {
  it('treats every legally issued document as time-limited', () => {
    for (const kind of ['registration', 'insurance', 'tax_token', 'fitness', 'licence'] as const) {
      expect(isTimeLimited(kind)).toBe(true);
      expect(expiryLabel(kind)).toBe('Valid until');
    }
  });

  it('leaves a custom document free of a date it may not have', () => {
    // An invoice or a spare-key receipt has no expiry; demanding one would
    // teach the rider to invent a date.
    expect(isTimeLimited('custom')).toBe(false);
    expect(expiryLabel('custom')).toBe('Expires (optional)');
  });

  it('names each number the way the form asking for it does', () => {
    expect(DOCUMENT_REFERENCE_LABEL.insurance).toBe('Policy no.');
    expect(DOCUMENT_REFERENCE_LABEL.tax_token).toBe('Tax token no.');
    expect(DOCUMENT_REFERENCE_LABEL.licence).toBe('Licence no.');
  });
});

describe('the validity line says only what is known', () => {
  it('gives the whole term when both dates are recorded', () => {
    const line = validityLine(doc({ issuedOn: '2025-03-12', expiresOn: '2027-03-11' }), '2026-09-13');
    expect(line).toContain('12 Mar 2025');
    expect(line).toContain('valid until 11 Mar 2027');
    expect(line).toContain('179 days');
  });

  it('gives the deadline alone when the issue date is unknown', () => {
    const line = validityLine(doc({ expiresOn: '2026-10-01' }), '2026-09-13');
    expect(line).toBe('valid until 1 Oct 2026 · 18 days');
  });

  it('says a record has no expiry rather than implying it never runs out', () => {
    expect(validityLine(doc(), '2026-09-13')).toBe('No expiry recorded');
    expect(validityLine(doc({ issuedOn: '2025-03-12' }), '2026-09-13')).toBe(
      'Issued 12 Mar 2025 · no expiry recorded',
    );
  });

  it('states an expiry in the past as expired, not as days remaining', () => {
    expect(validityLine(doc({ expiresOn: '2026-08-01' }), '2026-09-13')).toBe('expired 1 Aug 2026');
  });

  it('reads the last day as today, not as one day left', () => {
    expect(validityLine(doc({ expiresOn: '2026-09-13' }), '2026-09-13')).toBe('expires today');
  });

  it('uses the singular on the final day', () => {
    expect(validityLine(doc({ expiresOn: '2026-09-14' }), '2026-09-13')).toContain('1 day');
  });
});

describe('document status', () => {
  it('separates a document with no expiry from one that is still valid', () => {
    expect(documentStatus(doc(), '2026-09-13')).toBe('no_expiry');
    expect(documentStatus(doc({ expiresOn: '2027-01-01' }), '2026-09-13')).toBe('valid');
    expect(documentStatus(doc({ expiresOn: '2026-10-01' }), '2026-09-13')).toBe('expiring');
    expect(documentStatus(doc({ expiresOn: '2026-09-12' }), '2026-09-13')).toBe('expired');
  });
});

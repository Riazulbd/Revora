import { proofCertificate, type AttestedRecord } from './certificate';

const records: AttestedRecord[] = [
  { kind: 'service', id: 's1', date: '2026-03-04', figure: 180_000 },
  { kind: 'fuel', id: 'f1', date: '2026-08-20', figure: 4_845_000 },
  { kind: 'fuel', id: 'f2', date: '2026-08-30', figure: 5_180_000 },
  { kind: 'document', id: 'd1', date: null, figure: null },
];

test('the reference is stable across runs over the same records', () => {
  expect(proofCertificate(records).reference).toBe(proofCertificate(records).reference);
});

test('the order records arrive in does not change the reference', () => {
  const shuffled = [3, 1, 4, 2].map((n) => records[n - 1]!);
  expect(proofCertificate(shuffled).reference).toBe(proofCertificate(records).reference);
});

test('editing a figure changes the reference', () => {
  const tampered = records.map((r) => (r.id === 'f2' ? { ...r, figure: 5_900_000 } : r));
  expect(proofCertificate(tampered).reference).not.toBe(proofCertificate(records).reference);
});

test('dropping a record changes the reference', () => {
  const shortened = records.filter((r) => r.id !== 's1');
  expect(proofCertificate(shortened).reference).not.toBe(proofCertificate(records).reference);
});

test('the same id in two tables is not the same record', () => {
  const a = proofCertificate([{ kind: 'service', id: 'x', date: '2026-01-01', figure: 1 }]);
  const b = proofCertificate([{ kind: 'fuel', id: 'x', date: '2026-01-01', figure: 1 }]);
  expect(a.reference).not.toBe(b.reference);
});

test('the span covers the dated records and ignores the undated ones', () => {
  const cert = proofCertificate(records);
  expect(cert.recordCount).toBe(4);
  expect(cert.firstDate).toBe('2026-03-04');
  expect(cert.lastDate).toBe('2026-08-30');
});

test('an empty logbook certifies nothing and says so', () => {
  const cert = proofCertificate([]);
  expect(cert.recordCount).toBe(0);
  expect(cert.firstDate).toBeNull();
  expect(cert.lastDate).toBeNull();
  expect(cert.reference).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
});

test('the reference is always eight hex digits, however small the hash', () => {
  for (let i = 0; i < 400; i += 1) {
    const cert = proofCertificate([{ kind: 'fuel', id: `f${i}`, date: null, figure: i }]);
    expect(cert.reference).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  }
});

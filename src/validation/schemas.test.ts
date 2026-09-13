import { documentSchema } from './schemas';

const base = {
  kind: 'tax_token' as const,
  title: 'Tax token',
  reference: 'DM-4432871',
  issuedOn: null as string | null,
  expiresOn: null as string | null,
  keepOfflineCopy: true,
  notes: null,
};

const messages = (input: unknown): string[] => {
  const result = documentSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('a document that runs out must say when', () => {
  it('refuses a tax token with no end date, and says why', () => {
    const [message] = messages(base);
    expect(message).toContain('tax token runs out');
    expect(message).toContain('remind you');
  });

  it('refuses a licence, a registration and a fitness certificate the same way', () => {
    for (const kind of ['licence', 'registration', 'fitness', 'insurance'] as const) {
      expect(messages({ ...base, kind })).toHaveLength(1);
    }
  });

  it('accepts the same record once the date is there', () => {
    expect(documentSchema.safeParse({ ...base, expiresOn: '2027-03-11' }).success).toBe(true);
  });

  it('lets a custom document have no expiry at all', () => {
    expect(documentSchema.safeParse({ ...base, kind: 'custom', title: 'Purchase invoice' }).success).toBe(true);
  });
});

describe('a term runs forwards', () => {
  it('rejects an expiry that falls before the issue date', () => {
    expect(messages({ ...base, issuedOn: '2027-03-11', expiresOn: '2025-03-12' })).toContain(
      'That is before the issue date.',
    );
  });

  it('accepts a single-day term', () => {
    const same = { ...base, issuedOn: '2026-09-13', expiresOn: '2026-09-13' };
    expect(documentSchema.safeParse(same).success).toBe(true);
  });
});

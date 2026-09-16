import type { SafetyArea, SafetyCheck, SafetyStatus, VaultDocument } from '@/types';
import type { MaintenanceStatus } from './maintenance';
import { attentionCount, attentionItems } from './attention';

const TODAY = '2026-09-16';

const check = (area: SafetyArea, status: SafetyStatus, date: string, summary = 'Front lever spongy'): SafetyCheck => ({
  id: `s-${area}-${date}`, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  area, date, status, summary, measurements: null, note: null, photoPath: null,
  clientRef: `r-${area}-${date}`,
});

const doc = (id: string, title: string, expiresOn: string | null): VaultDocument => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  kind: 'tax_token', customKindLabel: null, title, reference: 'DM-1',
  issuedOn: null, expiresOn, filePath: null, keepOfflineCopy: true, notes: null, clientRef: id,
});

const status = (over: Partial<MaintenanceStatus>): MaintenanceStatus => ({
  kind: 'good', dueAtMetres: null, remainingMetres: null, dueOnDate: null,
  remainingDays: null, neverCompleted: false, ...over,
});

const rule = (id: string, name: string, st: MaintenanceStatus, intervalMetres: number | null = 3_000_000) => ({
  rule: { id, name, intervalMetres },
  status: st,
});

const base = { rules: [], documents: [], safetyChecks: [], distanceUnit: 'km' as const, today: TODAY };

describe('nothing wrong means nothing shown', () => {
  it('returns an empty list rather than a placeholder', () => {
    expect(attentionItems(base)).toEqual([]);
    expect(attentionCount(attentionItems(base))).toBe(0);
  });

  it('ignores healthy rules, valid documents and cleared checks', () => {
    const items = attentionItems({
      ...base,
      rules: [rule('r1', 'Chain lube', status({ kind: 'due_soon', remainingMetres: 240_000 }))],
      documents: [doc('d1', 'Insurance', '2027-03-11')],
      safetyChecks: [check('brakes', 'ok', '2026-09-01')],
    });
    expect(items).toEqual([]);
  });
});

describe('what earns a place on the list', () => {
  it('surfaces an overdue rule with how far past it is and its interval', () => {
    const [item] = attentionItems({
      ...base,
      rules: [rule('r1', 'Engine oil', status({ kind: 'overdue', remainingMetres: -310_000 }))],
    });
    expect(item?.title).toBe('Engine oil overdue');
    expect(item?.detail).toBe('310 km past · rule every 3,000 km');
    expect(item?.action).toEqual({ label: 'Mark done', ruleId: 'r1' });
  });

  it('quotes the rider’s own words on a safety action', () => {
    const [item] = attentionItems({
      ...base,
      safetyChecks: [check('brakes', 'action', '2026-09-13')],
    });
    expect(item?.title).toBe('Brakes marked action');
    expect(item?.detail).toBe('Front lever spongy · 3 days ago');
  });

  it('separates an expiring document from an expired one', () => {
    const items = attentionItems({
      ...base,
      documents: [doc('d1', 'Tax token', '2026-09-28'), doc('d2', 'Fitness', '2026-08-01')],
    });
    expect(items.find((i) => i.id === 'doc:d1')?.title).toBe('Tax token expires in 12 days');
    expect(items.find((i) => i.id === 'doc:d1')?.severity).toBe('warning');
    expect(items.find((i) => i.id === 'doc:d2')?.title).toBe('Fitness expired');
    expect(items.find((i) => i.id === 'doc:d2')?.severity).toBe('critical');
  });

  it('says nothing about a document with no expiry recorded', () => {
    expect(attentionItems({ ...base, documents: [doc('d1', 'Purchase invoice', null)] })).toEqual([]);
  });
});

describe('only the current state of the motorcycle counts', () => {
  it('drops an old action once that area has been checked and cleared', () => {
    // March said action, August said ok. The bike is fine; showing March would
    // teach the rider to ignore the list.
    const items = attentionItems({
      ...base,
      safetyChecks: [check('brakes', 'action', '2026-03-02'), check('brakes', 'ok', '2026-08-20')],
    });
    expect(items).toEqual([]);
  });

  it('keeps an action that is still the latest word on that area', () => {
    const items = attentionItems({
      ...base,
      safetyChecks: [check('brakes', 'ok', '2026-03-02'), check('brakes', 'action', '2026-08-20')],
    });
    expect(items).toHaveLength(1);
  });

  it('judges each area on its own latest check', () => {
    const items = attentionItems({
      ...base,
      safetyChecks: [
        check('brakes', 'action', '2026-09-13'),
        check('chain', 'ok', '2026-09-13'),
        check('tyres', 'action', '2026-09-10'),
      ],
    });
    expect(items.map((i) => i.title).sort()).toEqual(['Brakes marked action', 'Tyres marked action']);
  });
});

describe('the order a rider reads it in', () => {
  it('puts safety first, then documents, then maintenance', () => {
    const items = attentionItems({
      ...base,
      rules: [rule('r1', 'Engine oil', status({ kind: 'overdue', remainingMetres: -310_000 }))],
      documents: [doc('d1', 'Fitness', '2026-08-01')],
      safetyChecks: [check('brakes', 'action', '2026-09-13')],
    });
    expect(items.map((i) => i.kind)).toEqual(['safety', 'document', 'maintenance']);
  });

  it('ranks an expired document above one that is merely expiring', () => {
    const items = attentionItems({
      ...base,
      documents: [doc('d1', 'Tax token', '2026-09-28'), doc('d2', 'Fitness', '2026-08-01')],
    });
    expect(items[0]?.id).toBe('doc:d2');
  });

  it('gives every item a stable id, so the list does not reshuffle on a recompute', () => {
    const input = {
      ...base,
      rules: [rule('r1', 'Engine oil', status({ kind: 'overdue', remainingMetres: -310_000 }))],
      documents: [doc('d1', 'Tax token', '2026-09-28')],
      safetyChecks: [check('brakes', 'action', '2026-09-13')],
    };
    expect(attentionItems(input).map((i) => i.id)).toEqual(attentionItems(input).map((i) => i.id));
  });
});

describe('the rider’s unit', () => {
  it('speaks miles when that is what they set', () => {
    const [item] = attentionItems({
      ...base,
      distanceUnit: 'mi',
      rules: [rule('r1', 'Engine oil', status({ kind: 'overdue', remainingMetres: -321_869 }), 4_828_032)],
    });
    expect(item?.detail).toBe('200 mi past · rule every 3,000 mi');
  });
});

describe('a time-based rule with no distance', () => {
  it('reports how many days past it is', () => {
    const [item] = attentionItems({
      ...base,
      rules: [rule('r1', 'Insurance renewal', status({ kind: 'overdue', remainingDays: -9 }), null)],
    });
    expect(item?.detail).toBe('9 days ago');
  });
});

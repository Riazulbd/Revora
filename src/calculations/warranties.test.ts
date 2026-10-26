import type { Warranty } from '@/types';
import {
  activeWarranties,
  nextWarrantyToEnd,
  warrantyChip,
  warrantyProgress,
  warrantyRemainingLabel,
  warrantySourceLine,
  warrantyState,
  warrantyTitle,
} from './warranties';

const TODAY = '2026-09-16';

const warranty = (over: Partial<Warranty> = {}): Warranty => ({
  id: 'w1',
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Battery',
  provider: 'Hamko',
  purchasedFrom: 'Motor House Dhanmondi',
  coverage: null,
  validUntil: '2027-04-28',
  claimStatus: 'none',
  evidencePaths: [],
  reminderDaysBefore: 30,
  clientRef: 'w1',
  ...over,
});

describe('the pill on a warranty row', () => {
  it('leads with an open claim, whatever the dates say', () => {
    const state = warrantyState(warranty({ claimStatus: 'open' }), TODAY);
    expect(state.label).toBe('CLAIM OPEN');
    expect(state.tone).toBe('warn');
    expect(state.claimOpen).toBe(true);
  });

  it('calls live cover active', () => {
    expect(warrantyState(warranty(), TODAY).label).toBe('ACTIVE');
    expect(warrantyState(warranty(), TODAY).outlined).toBe(true);
  });

  it('warns inside the last month', () => {
    expect(warrantyState(warranty({ validUntil: '2026-10-01' }), TODAY).label).toBe('EXPIRING');
  });

  it('fills a spent pill rather than outlining it', () => {
    const state = warrantyState(warranty({ validUntil: '2025-04-28' }), TODAY);
    expect(state.label).toBe('EXPIRED');
    expect(state.expired).toBe(true);
    expect(state.outlined).toBe(false);
  });

  it('says so rather than guessing when no end date was recorded', () => {
    const state = warrantyState(warranty({ validUntil: null }), TODAY);
    expect(state.label).toBe('NO EXPIRY');
    expect(state.expired).toBe(false);
  });

  it('still reports an expired warranty as expired while a claim is open', () => {
    const state = warrantyState(warranty({ validUntil: '2025-04-28', claimStatus: 'open' }), TODAY);
    expect(state.label).toBe('CLAIM OPEN');
    expect(state.expired).toBe(true);
  });
});

describe('what a warranty row says', () => {
  it('names the part and its provider', () => {
    expect(warrantyTitle(warranty())).toBe('Battery · Hamko');
    expect(warrantyTitle(warranty({ provider: null }))).toBe('Battery');
    expect(warrantyTitle(warranty({ provider: '  ' }))).toBe('Battery');
  });

  it('gives the seller and the term', () => {
    expect(warrantySourceLine(warranty(), TODAY)).toBe(
      'Bought at Motor House Dhanmondi · valid until 28 Apr 2027',
    );
  });

  it('says expired once the date has gone', () => {
    expect(warrantySourceLine(warranty({ validUntil: '2025-04-28' }), TODAY)).toBe(
      'Bought at Motor House Dhanmondi · expired 28 Apr 2025',
    );
  });

  it('leaves the line out entirely rather than asserting a term nobody entered', () => {
    expect(warrantySourceLine(warranty({ purchasedFrom: null, validUntil: null }), TODAY)).toBeNull();
    expect(warrantySourceLine(warranty({ purchasedFrom: null }), TODAY)).toBe('valid until 28 Apr 2027');
  });
});

describe('the Figma warranty card', () => {
  it('says how much cover is left in the largest honest unit', () => {
    expect(warrantyRemainingLabel(warranty({ validUntil: '2028-01-20' }), TODAY)).toBe('1 yr 4 mo');
    expect(warrantyRemainingLabel(warranty({ validUntil: '2026-12-20' }), TODAY)).toBe('3 mo');
    expect(warrantyRemainingLabel(warranty({ validUntil: '2026-09-26' }), TODAY)).toBe('10 days');
    expect(warrantyRemainingLabel(warranty({ validUntil: '2026-09-01' }), TODAY)).toBeNull();
    expect(warrantyRemainingLabel(warranty({ validUntil: null }), TODAY)).toBeNull();
  });

  it('chips an open claim first, then the countdown, then Valid or Expired', () => {
    expect(warrantyChip(warranty({ claimStatus: 'open' }), TODAY)).toEqual({ label: 'Claim open', tone: 'warn' });
    expect(warrantyChip(warranty({ validUntil: '2026-09-26' }), TODAY)).toEqual({ label: '10 days', tone: 'warn' });
    expect(warrantyChip(warranty(), TODAY)).toEqual({ label: 'Valid', tone: 'good' });
    expect(warrantyChip(warranty({ validUntil: '2026-08-02' }), TODAY)).toEqual({ label: 'Expired', tone: 'neutral' });
  });

  it('measures the term from the day the warranty was recorded', () => {
    const recorded = Date.UTC(2026, 8, 6, 12);
    expect(warrantyProgress(warranty({ createdAt: recorded, validUntil: '2026-09-26' }), TODAY)).toBeCloseTo(0.5);
    expect(warrantyProgress(warranty({ validUntil: null }), TODAY)).toBeNull();
  });

  it('finds the active warranty ending soonest', () => {
    const list = [
      warranty({ id: 'a', validUntil: '2027-03-12' }),
      warranty({ id: 'b', validUntil: '2026-09-26' }),
      warranty({ id: 'c', validUntil: '2026-08-02' }),
    ];
    expect(activeWarranties(list, TODAY).map((w) => w.id)).toEqual(['a', 'b']);
    expect(nextWarrantyToEnd(list, TODAY)?.warranty.id).toBe('b');
    expect(nextWarrantyToEnd(list, TODAY)?.days).toBe(10);
    expect(nextWarrantyToEnd([], TODAY)).toBeNull();
  });
});

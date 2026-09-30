import {
  ASSISTANT_MONTHLY_QUOTA,
  nextQuotaResetIso,
  questionsRemaining,
} from './assistantQuota';

describe('nextQuotaResetIso', () => {
  it('rolls to the first of the following month', () => {
    expect(nextQuotaResetIso('2026-09-16')).toBe('2026-10-01');
    expect(nextQuotaResetIso('2026-09-01')).toBe('2026-10-01');
    expect(nextQuotaResetIso('2026-09-30')).toBe('2026-10-01');
  });

  it('rolls the year over at December', () => {
    expect(nextQuotaResetIso('2026-12-31')).toBe('2027-01-01');
  });

  it('does not slip a day for a short month', () => {
    // `new Date('2026-01-31')` plus a month is the classic 3 March bug.
    expect(nextQuotaResetIso('2026-01-31')).toBe('2026-02-01');
  });
});

describe('questionsRemaining', () => {
  it('subtracts what was used from the allowance', () => {
    expect(questionsRemaining(18)).toBe(82);
    expect(questionsRemaining(0)).toBe(ASSISTANT_MONTHLY_QUOTA);
  });

  it('floors at zero rather than going negative', () => {
    expect(questionsRemaining(140)).toBe(0);
  });

  it('returns null when nothing is known, so the screen can print the allowance', () => {
    expect(questionsRemaining(null)).toBeNull();
    expect(questionsRemaining(Number.NaN)).toBeNull();
  });

  it('honours a quota the server reported', () => {
    expect(questionsRemaining(5, 20)).toBe(15);
  });
});

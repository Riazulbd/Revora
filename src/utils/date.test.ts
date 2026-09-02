import {
  addDays,
  addMonths,
  daysBetween,
  dateToIso,
  formatLongDate,
  formatShortDate,
  isIsoDate,
  isoToDate,
  monthKey,
  recentMonthKeys,
  todayIso,
} from './date';

describe('calendar dates never shift by a timezone', () => {
  it('renders 1 September as 1 September, whatever the offset', () => {
    // The failure mode this guards: `new Date('2026-09-01')` is UTC midnight,
    // which is 31 August in every negative-offset timezone.
    expect(formatLongDate('2026-09-01')).toBe('1 Sep 2026');
    expect(formatShortDate('2026-09-01')).toBe('1 Sep');
  });

  it('round-trips a local date through Date and back', () => {
    for (const iso of ['2026-01-01', '2026-09-01', '2026-12-31', '2024-02-29']) {
      expect(dateToIso(isoToDate(iso))).toBe(iso);
    }
  });

  it('builds a local, not UTC, Date', () => {
    const d = isoToDate('2026-09-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('reads today from the local calendar', () => {
    const now = new Date(2026, 8, 1, 23, 59, 59);
    expect(todayIso(now)).toBe('2026-09-01');
  });

  it('does not roll over just before local midnight', () => {
    expect(todayIso(new Date(2026, 8, 1, 0, 0, 1))).toBe('2026-09-01');
    expect(todayIso(new Date(2026, 8, 1, 23, 59, 59))).toBe('2026-09-01');
  });
});

describe('date arithmetic', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-08-01', '2026-08-31')).toBe(30);
    expect(daysBetween('2026-08-31', '2026-08-01')).toBe(-30);
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('counts across a daylight-saving boundary without drifting', () => {
    // 29 March 2026 is a DST transition in much of Europe.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('adds months and clamps to the shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-08-15', 6)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });
});

describe('validation and grouping', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2026-09-01')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('01-09-2026')).toBe(false);
    expect(isIsoDate(20260901)).toBe(false);
  });

  it('keys by month', () => {
    expect(monthKey('2026-09-01')).toBe('2026-09');
  });

  it('walks back across a year boundary', () => {
    expect(recentMonthKeys(3, '2026-01')).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(recentMonthKeys(2, '2026-09')).toEqual(['2026-08', '2026-09']);
  });
});

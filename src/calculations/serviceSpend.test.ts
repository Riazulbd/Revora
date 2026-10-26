import { serviceSpendSummary } from './serviceSpend';

const TODAY = '2026-10-26';

describe('serviceSpendSummary', () => {
  it('sums the last twelve calendar months, oldest first, ending with this one', () => {
    const summary = serviceSpendSummary(
      [
        { date: '2026-09-09', totalCostMinor: 165_000 },
        { date: '2026-08-28', totalCostMinor: 18_000 },
        { date: '2026-09-18', totalCostMinor: 185_000 },
        { date: '2025-12-14', totalCostMinor: 340_000 },
        // Thirteen months back: outside the window.
        { date: '2025-09-30', totalCostMinor: 999_000 },
      ],
      TODAY,
    );
    expect(summary.months).toHaveLength(12);
    expect(summary.months[0]?.key).toBe('2025-11');
    expect(summary.months[11]?.key).toBe('2026-10');
    expect(summary.months.find((m) => m.key === '2026-09')?.minor).toBe(350_000);
    expect(summary.months.find((m) => m.key === '2025-12')?.minor).toBe(340_000);
    expect(summary.visits).toBe(4);
    expect(summary.totalMinor).toBe(708_000);
    expect(summary.averageMinor).toBe(177_000);
  });

  it('has no average over no visits', () => {
    const summary = serviceSpendSummary([], TODAY);
    expect(summary.visits).toBe(0);
    expect(summary.averageMinor).toBeNull();
    expect(summary.months.every((m) => m.minor === 0)).toBe(true);
  });
});

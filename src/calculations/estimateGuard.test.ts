import { estimateSeverity, summariseEstimates } from './estimateGuard';
import type { ServiceRecord, WorkshopEstimate } from '@/types';

let seq = 0;
const service = (
  workshop: string | null,
  date: string,
  quoteMinor: number | null,
  totalCostMinor: number,
): ServiceRecord => {
  seq += 1;
  const estimate: WorkshopEstimate | null =
    quoteMinor === null && workshop === null
      ? null
      : {
          quoteMinor,
          odometerInMetres: null,
          odometerOutMetres: null,
          askBeforeReplacing: true,
          approvedWork: [],
          declinedWork: [],
        };
  return {
    id: `s${seq}`, userId: 'u1', bikeId: 'b1', createdAt: seq, updatedAt: seq,
    title: 'Service', workshop, selfService: workshop === null, date,
    odometerMetres: null, labourCostMinor: 0, partsCostMinor: 0, totalCostMinor,
    currency: 'BDT', notes: null, completedRuleIds: [], itemsSummary: null,
    receiptPaths: [], estimate, clientRef: `r${seq}`,
  };
};

describe('severity', () => {
  test('under quote is good news, matching is neither', () => {
    expect(estimateSeverity(320_000, 300_000)).toBe('good');
    expect(estimateSeverity(320_000, 320_000)).toBe('neutral');
  });

  test('a tenth over is the line between amber and red', () => {
    // The board's own two rows: +1,700 on 6,400 is red, +150 on 2,800 is amber.
    expect(estimateSeverity(640_000, 810_000)).toBe('bad');
    expect(estimateSeverity(280_000, 295_000)).toBe('warn');
    expect(estimateSeverity(100_000, 110_000)).toBe('bad');
    expect(estimateSeverity(100_000, 109_900)).toBe('warn');
  });

  test('anything charged against a zero quote is over', () => {
    expect(estimateSeverity(0, 5_000)).toBe('bad');
  });
});

describe('summary', () => {
  const services = [
    service('Rahim Motors', '2026-09-09', 300_000, 400_000),
    service('Rahim Motors', '2026-07-02', 340_000, 410_000),
    service('Bike Point Dhanmondi', '2026-05-18', 280_000, 295_000),
    // No quote recorded: left out of the comparison, still counted.
    service('Rahim Motors', '2026-04-01', null, 120_000),
    // Self-service is never a workshop comparison.
    service(null, '2026-03-01', null, 60_000),
  ];

  const summary = summariseEstimates(services);

  test('only quoted workshop visits are compared, and the rest are counted', () => {
    expect(summary.comparedVisits).toBe(3);
    expect(summary.uncomparedVisits).toBe(2);
    expect(summary.comparedVisits + summary.uncomparedVisits).toBe(services.length);
  });

  test('the totals and the delta are the compared visits alone', () => {
    expect(summary.quotedMinor).toBe(920_000);
    expect(summary.invoicedMinor).toBe(1_105_000);
    expect(summary.deltaMinor).toBe(185_000);
    expect(summary.severity).toBe('bad');
  });

  test('a workshop is one row however it was spaced, worst overrun first', () => {
    expect(summary.byWorkshop.map((w) => [w.workshop, w.comparedVisits, w.deltaMinor])).toEqual([
      ['Rahim Motors', 2, 170_000],
      ['Bike Point Dhanmondi', 1, 15_000],
    ]);
    expect(summary.byWorkshop.map((w) => w.severity)).toEqual(['bad', 'warn']);
  });

  test('nothing to compare withholds the figures rather than showing zero', () => {
    const empty = summariseEstimates([service(null, '2026-03-01', null, 60_000)]);
    expect(empty.quotedMinor).toBeNull();
    expect(empty.invoicedMinor).toBeNull();
    expect(empty.deltaMinor).toBeNull();
    expect(empty.comparedVisits).toBe(0);
    expect(empty.uncomparedVisits).toBe(1);
    expect(empty.byWorkshop).toEqual([]);
  });
});

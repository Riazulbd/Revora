import type { OdometerPoint } from './odometer';
import { costPerDistanceTrend } from './costTrend';

const TODAY = '2026-09-16';

const point = (date: string, km: number): OdometerPoint => ({
  id: date,
  readingId: null,
  metres: km * 1000,
  date,
  source: 'fuel',
  sourceId: null,
  note: null,
});

describe('costPerDistanceTrend', () => {
  it('rates each month by what was spent against what was ridden in it', () => {
    const trend = costPerDistanceTrend({
      ledger: [
        { date: '2026-08-10', amountMinor: 100_000 },
        { date: '2026-09-05', amountMinor: 50_000 },
      ],
      points: [point('2026-07-31', 1_000), point('2026-08-31', 1_500), point('2026-09-10', 1_600)],
      today: TODAY,
      distanceUnit: 'km',
      months: 3,
    });
    expect(trend.months.map((m) => m.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    // July has a reading but none before it: unmeasured.
    expect(trend.months[0]?.scaled).toBeNull();
    // ৳1,000 over 500 km → ৳2.00/km: 200 minor per km, scaled ×RATE_SCALE.
    expect(trend.months[1]?.scaled).toBe(20_000);
    // ৳500 over 100 km → ৳5.00/km.
    expect(trend.months[2]?.scaled).toBe(50_000);
  });

  it('compares the last three months with the three before as single rates', () => {
    const points = [
      point('2026-03-31', 0),
      point('2026-04-30', 100),
      point('2026-05-31', 200),
      point('2026-06-30', 300),
      point('2026-07-31', 400),
      point('2026-08-31', 500),
      point('2026-09-15', 600),
    ];
    const ledger = [
      { date: '2026-04-05', amountMinor: 30_000 },
      { date: '2026-05-05', amountMinor: 30_000 },
      { date: '2026-06-05', amountMinor: 30_000 },
      { date: '2026-07-05', amountMinor: 20_000 },
      { date: '2026-08-05', amountMinor: 20_000 },
      { date: '2026-09-05', amountMinor: 20_000 },
    ];
    const trend = costPerDistanceTrend({ ledger, points, today: TODAY, distanceUnit: 'km', months: 6 });
    // ৳900 over 300 km → ৳3.00/km; ৳600 over 300 km → ৳2.00/km.
    expect(trend.previousQuarterScaled).toBe(30_000);
    expect(trend.latestQuarterScaled).toBe(20_000);
    expect(trend.deltaScaled).toBe(-10_000);
  });

  it('has no quarter comparison when a month in it was not measured', () => {
    const trend = costPerDistanceTrend({
      ledger: [],
      points: [point('2026-09-01', 0), point('2026-09-15', 100)],
      today: TODAY,
      distanceUnit: 'km',
      months: 6,
    });
    expect(trend.latestQuarterScaled).toBeNull();
    expect(trend.deltaScaled).toBeNull();
  });
});

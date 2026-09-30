import type { IsoDate, OdometerSource } from '@/types';
import type { OdometerPoint } from './odometer';
import { buildOdometerRows } from './odometerHistory';

const point = (
  id: string,
  km: number,
  date: IsoDate,
  source: OdometerSource = 'manual',
  readingId: string | null = id,
): OdometerPoint => ({
  id,
  readingId,
  metres: km * 1000,
  date,
  source,
  sourceId: null,
  note: null,
});

describe('buildOdometerRows', () => {
  it('lists readings newest first', () => {
    const rows = buildOdometerRows([
      point('a', 34_626, '2026-09-10'),
      point('b', 34_712, '2026-09-13'),
      point('c', 34_102, '2026-09-01'),
    ]);

    expect(rows.map((r) => r.point.id)).toEqual(['b', 'a', 'c']);
  });

  it('flags only the reading a later one contradicts', () => {
    const rows = buildOdometerRows([
      point('fuel', 34_712, '2026-09-13', 'fuel', null),
      point('manual', 34_626, '2026-09-10'),
      point('typo', 60_000, '2026-09-08'),
    ]);

    expect(rows.map((r) => r.outOfSequence)).toEqual([false, false, true]);
  });

  it('leaves a clean history unflagged', () => {
    const rows = buildOdometerRows([
      point('a', 34_712, '2026-09-13'),
      point('b', 34_626, '2026-09-10'),
      point('c', 34_102, '2026-09-01'),
    ]);

    expect(rows.some((r) => r.outOfSequence)).toBe(false);
  });

  it('does not judge two readings dated the same day against each other', () => {
    const rows = buildOdometerRows([
      point('high', 34_712, '2026-09-13'),
      point('low', 34_700, '2026-09-13'),
      point('older', 34_100, '2026-09-01'),
    ]);

    expect(rows.some((r) => r.outOfSequence)).toBe(false);
  });

  it('marks a derived reading as not correctable here', () => {
    const rows = buildOdometerRows([
      point('fuel', 34_712, '2026-09-13', 'fuel', null),
      point('manual', 34_626, '2026-09-10'),
    ]);

    expect(rows.map((r) => r.correctable)).toEqual([false, true]);
  });

  it('is empty for an empty history', () => {
    expect(buildOdometerRows([])).toEqual([]);
  });
});

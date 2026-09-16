import type { SafetyArea, SafetyCheck, SafetyStatus } from '@/types';
import { conditionHistory, currentCondition, SAFETY_AREAS } from './safety';

const check = (area: SafetyArea, status: SafetyStatus, date: string, id = `${area}-${date}`): SafetyCheck => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  area, date, status, summary: `${area} ${status}`, measurements: null, note: null,
  photoPath: null, clientRef: id,
});

describe('current condition is the latest word on each area', () => {
  it('covers every area even when nothing has been checked', () => {
    const states = currentCondition([]);
    expect(states).toHaveLength(SAFETY_AREAS.length);
    expect(states.every((s) => s.status === null && s.latest === null)).toBe(true);
  });

  it('never calls an unchecked area ok', () => {
    // Green on an area nobody has looked at would be the app vouching for
    // something it has never seen.
    const states = currentCondition([check('brakes', 'ok', '2026-09-01')]);
    expect(states.find((s) => s.area === 'tyres')?.status).toBeNull();
  });

  it('takes the most recent check, not the most recently written', () => {
    const states = currentCondition([
      check('brakes', 'action', '2026-03-02'),
      check('brakes', 'ok', '2026-08-20'),
    ]);
    expect(states.find((s) => s.area === 'brakes')?.status).toBe('ok');
  });

  it('puts action first, then watch, then ok, then never checked', () => {
    const states = currentCondition([
      check('lights', 'ok', '2026-09-01'),
      check('chain', 'watch', '2026-09-01'),
      check('brakes', 'action', '2026-09-01'),
    ]);
    expect(states.map((s) => s.area)).toEqual(['brakes', 'chain', 'lights', 'tyres', 'battery']);
  });
});

describe('history is everything that is no longer current', () => {
  it('excludes the checks that are the latest for their area', () => {
    const old = check('brakes', 'action', '2026-03-02');
    const now = check('brakes', 'ok', '2026-08-20');
    expect(conditionHistory([old, now]).map((c) => c.id)).toEqual([old.id]);
  });

  it('is empty when every check is still the latest for its area', () => {
    expect(conditionHistory([check('brakes', 'ok', '2026-09-01'), check('chain', 'ok', '2026-09-01')])).toEqual([]);
  });

  it('runs newest first', () => {
    const history = conditionHistory([
      check('brakes', 'ok', '2026-01-01'),
      check('brakes', 'ok', '2026-05-01'),
      check('brakes', 'ok', '2026-09-01'),
    ]);
    expect(history.map((c) => c.date)).toEqual(['2026-05-01', '2026-01-01']);
  });
});

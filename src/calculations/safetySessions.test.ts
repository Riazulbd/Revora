import type { SafetyArea, SafetyCheck, SafetyStatus } from '@/types';
import type { OdometerPoint } from './odometer';
import { currentCondition } from './safety';
import {
  actionAreas,
  actionHeadline,
  areaConditionLine,
  areaListLabel,
  daysAgoLabel,
  NEVER_CHECKED,
  observedSummary,
  areaRowLine,
  odometerMetresOn,
  readiness,
  safetySessions,
  safetyStatusLabel,
  sessionLine,
  sessionTitle,
} from './safetySessions';

const check = (
  area: SafetyArea,
  status: SafetyStatus,
  date: string,
  extra: Partial<SafetyCheck> = {},
): SafetyCheck => ({
  id: `${area}-${date}`,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  area,
  date,
  status,
  summary: '',
  measurements: null,
  note: null,
  photoPath: null,
  clientRef: `${area}-${date}`,
  ...extra,
});

const point = (date: string, metres: number, id = date): OdometerPoint => ({
  id,
  readingId: null,
  metres,
  date,
  source: 'manual',
  sourceId: null,
  note: null,
});

describe('how long ago a check was made', () => {
  it('reads as words for the days a rider thinks in', () => {
    expect(daysAgoLabel('2026-09-16', '2026-09-16')).toBe('today');
    expect(daysAgoLabel('2026-09-15', '2026-09-16')).toBe('yesterday');
    expect(daysAgoLabel('2026-09-13', '2026-09-16')).toBe('3 days ago');
  });

  it('falls back to the date rather than counting backwards into the future', () => {
    expect(daysAgoLabel('2026-09-20', '2026-09-16')).toBe('20 Sep');
  });
});

describe('the line under an area on the Current grid', () => {
  it('says never checked, which is not the same as ok', () => {
    const lights = currentCondition([]).find((s) => s.area === 'lights')!;
    expect(areaConditionLine(lights, '2026-09-16')).toBe(NEVER_CHECKED);
    expect(safetyStatusLabel(null)).toBe(NEVER_CHECKED);
  });

  it('shows how long a fault has been outstanding rather than repeating it', () => {
    const states = currentCondition([
      check('brakes', 'action', '2026-09-13', { summary: 'Front lever spongy' }),
    ]);
    const brakes = states.find((s) => s.area === 'brakes')!;
    expect(areaConditionLine(brakes, '2026-09-16')).toBe('Action · 3 days ago');
  });

  it('shows what was observed for anything not asking for action', () => {
    const states = currentCondition([check('chain', 'watch', '2026-09-13', { summary: 'slack 32 mm' })]);
    expect(areaConditionLine(states.find((s) => s.area === 'chain')!, '2026-09-16')).toBe(
      'Watch · slack 32 mm',
    );
  });

  it('falls back to the date when the rider wrote nothing down', () => {
    const states = currentCondition([check('battery', 'ok', '2026-09-12')]);
    expect(areaConditionLine(states.find((s) => s.area === 'battery')!, '2026-09-16')).toBe('OK · 12 Sep');
  });
});

describe('the areas asking for action', () => {
  it('is empty when a later check cleared the fault', () => {
    const checks = [check('brakes', 'action', '2026-03-02'), check('brakes', 'ok', '2026-08-20')];
    expect(actionAreas(checks)).toHaveLength(0);
    expect(actionHeadline(actionAreas(checks))).toBeNull();
  });

  it('reads as a sentence, with the verb agreeing with the area', () => {
    expect(actionHeadline(actionAreas([check('brakes', 'action', '2026-09-13')]))).toBe(
      'Brakes need action',
    );
    expect(actionHeadline(actionAreas([check('chain', 'action', '2026-09-13')]))).toBe(
      'Chain needs action',
    );
  });

  it('names every area that is outstanding', () => {
    const states = actionAreas([
      check('brakes', 'action', '2026-09-13'),
      check('chain', 'action', '2026-09-13'),
    ]);
    expect(actionHeadline(states)).toBe('Chain and brakes need action');
  });
});

describe('checks grouped into the walk-arounds they came from', () => {
  const checks = [
    check('tyres', 'ok', '2026-09-13', { summary: 'tread 3.1 mm' }),
    check('chain', 'watch', '2026-09-13', { summary: 'slack 32 mm' }),
    check('brakes', 'action', '2026-09-13', { summary: 'front lever spongy', photoPath: 'p.jpg' }),
    check('battery', 'ok', '2026-09-13'),
    check('lights', 'ok', '2026-09-13'),
    check('chain', 'ok', '2026-08-28'),
    check('tyres', 'ok', '2026-08-28'),
  ];

  it('puts the newest day first and counts the areas looked at', () => {
    const sessions = safetySessions(checks);
    expect(sessions.map((s) => s.date)).toEqual(['2026-09-13', '2026-08-28']);
    expect(sessions[0]?.areaCount).toBe(5);
    expect(sessions[1]?.areaCount).toBe(2);
  });

  it('reads worst first inside a day', () => {
    expect(safetySessions(checks)[0]?.rows.map((r) => r.status)).toEqual(['action', 'watch', 'ok']);
  });

  it('collapses areas that agree into one row rather than repeating OK', () => {
    const ok = safetySessions(checks)[0]?.rows.find((r) => r.status === 'ok');
    expect(ok?.label).toBe('Tyres, battery, lights');
    expect(ok?.detail).toBe('tread 3.1 mm');
    expect(ok?.checkIds).toHaveLength(3);
  });

  it('carries the status as words, not only as a colour', () => {
    expect(safetySessions(checks)[0]?.rows.map((r) => r.statusLabel)).toEqual(['Action', 'Watch', 'OK']);
  });

  it('remembers that a row has evidence behind it', () => {
    const rows = safetySessions(checks)[0]?.rows ?? [];
    expect(rows.find((r) => r.status === 'action')?.hasPhoto).toBe(true);
    expect(rows.find((r) => r.status === 'ok')?.hasPhoto).toBe(false);
  });

  it('leaves the detail null rather than inventing one', () => {
    expect(safetySessions([check('chain', 'ok', '2026-08-28')])[0]?.rows[0]?.detail).toBeNull();
  });
});

test('area lists name the first area and fold the rest in lower case', () => {
  expect(areaListLabel(['tyres', 'battery'])).toBe('Tyres, battery');
  expect(areaListLabel([])).toBe('');
});

describe('the odometer as it stood on the day of a check', () => {
  const points = [point('2026-08-01', 34_180_000), point('2026-09-10', 34_712_000), point('2026-09-20', 35_000_000)];

  it('reads the last figure on or before the day, never one from the future', () => {
    expect(odometerMetresOn(points, '2026-09-13')).toBe(34_712_000);
  });

  it('takes the higher reading when two land on the same day', () => {
    expect(odometerMetresOn([...points, point('2026-09-10', 34_760_000, 'b')], '2026-09-13')).toBe(34_760_000);
  });

  it('gives null rather than a guess when nothing precedes the day', () => {
    expect(odometerMetresOn(points, '2026-07-01')).toBeNull();
    expect(odometerMetresOn([], '2026-09-13')).toBeNull();
  });
});

describe('a summary that only echoes the status', () => {
  // A walk-around marks an area OK without a word; the schema still demands a
  // summary, so it stores "OK". Reading that back as "OK · OK" is noise.
  const battery = check('battery', 'ok', '2026-09-12', { summary: 'OK' });

  it('counts as nothing written', () => {
    expect(observedSummary(battery)).toBeNull();
  });

  it('lets the tile fall back to the date, as the board draws it', () => {
    const states = currentCondition([battery]);
    expect(areaConditionLine(states.find((s) => s.area === 'battery')!, '2026-09-16')).toBe('OK · 12 Sep');
  });

  it('keeps it out of a session row detail', () => {
    expect(safetySessions([battery])[0]?.rows[0]?.detail).toBeNull();
  });
});

describe('the Figma Safety hero', () => {
  const checks = [
    check('tyres', 'ok', '2026-09-14', { measurements: { frontPsi: 29, rearPsi: 33 } }),
    check('chain', 'ok', '2026-09-14', { summary: 'Clean and lubed' }),
    check('brakes', 'watch', '2026-09-14', { summary: 'Front lever spongy' }),
    check('battery', 'ok', '2026-09-03', { summary: 'Starts first try' }),
    check('lights', 'action', '2026-09-14', { summary: 'Rear left indicator out' }),
  ];

  it('counts the good areas and colours one segment per area in walk order', () => {
    const ready = readiness(checks, '2026-09-16');
    expect(ready.good).toBe(3);
    expect(ready.total).toBe(5);
    expect(ready.segments).toEqual(['ok', 'ok', 'watch', 'ok', 'action']);
    expect(ready.checkedLabel).toBe('Checked 2 days ago');
    expect(ready.sentence).toBe('Brakes need a look, and rear left indicator out.');
  });

  it('says nothing when everything is fine, and leaves unchecked areas blank', () => {
    const ready = readiness([check('tyres', 'ok', '2026-09-14')], '2026-09-16');
    expect(ready.sentence).toBeNull();
    expect(ready.segments).toEqual(['ok', null, null, null, null]);
    expect(readiness([], '2026-09-16').checkedLabel).toBeNull();
  });

  it('puts tyre pressures on the row when both were measured', () => {
    const [tyres, chain] = currentCondition(checks).filter((s) => s.area === 'tyres' || s.area === 'chain');
    expect(areaRowLine(tyres!)).toBe('29 / 33 psi · 14 Sep');
    expect(areaRowLine(chain!)).toBe('Clean and lubed · 14 Sep');
  });

  it('titles a day by how many areas it covered', () => {
    const [walk, single] = safetySessions(checks);
    expect(sessionTitle(walk!)).toBe('Walk-around check');
    expect(sessionLine(walk!)).toBe('Rear left indicator out, Front lever spongy · 4 areas');
    expect(sessionTitle(single!)).toBe('Condition check');
    expect(sessionLine(single!)).toBe('Starts first try · all good');
    expect(sessionTitle({ date: '2026-09-01', areaCount: 2, rows: [] })).toBe('Condition check');
  });
});

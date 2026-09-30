import type { MaintenanceRule } from '@/types';
import type { MaintenanceStatus } from './maintenance';
import { INITIAL_ODOMETER_POINT_ID, type OdometerPoint } from './odometer';
import {
  activityDetail,
  activityTitle,
  agoPhrase,
  compactAgo,
  costPerDistanceNote,
  lastRideMetres,
  maintenanceDueLine,
  maintenanceHighlights,
  odometerUpdatedLine,
  weekdayDate,
} from './dashboard';

const TODAY = '2026-09-16';

const point = (over: Partial<OdometerPoint> & { metres: number; date: string }): OdometerPoint => ({
  id: `p:${over.metres}`,
  readingId: null,
  source: 'fuel',
  sourceId: null,
  note: null,
  ...over,
});

const status = (over: Partial<MaintenanceStatus>): MaintenanceStatus => ({
  kind: 'good',
  dueAtMetres: null,
  remainingMetres: null,
  dueOnDate: null,
  remainingDays: null,
  neverCompleted: false,
  ...over,
});

const rule = (id: string, name: string): MaintenanceRule =>
  ({
    id,
    name,
    intervalMetres: 3_000_000,
    intervalDays: null,
    lastCompletedMetres: 0,
    lastCompletedDate: null,
  }) as unknown as MaintenanceRule;

describe('lastRideMetres', () => {
  it('is the gap between the two newest points', () => {
    const points = [
      point({ metres: 34_712_000, date: '2026-09-13' }),
      point({ metres: 34_626_000, date: '2026-09-08' }),
      point({ metres: 34_000_000, date: '2026-08-30' }),
    ];
    expect(lastRideMetres(points)).toBe(86_000);
  });

  it('is unknown rather than zero when there is only one reading', () => {
    expect(lastRideMetres([point({ metres: 6_214_000, date: TODAY })])).toBeNull();
    expect(lastRideMetres([])).toBeNull();
  });

  it('refuses to report a ride when the bike did not move', () => {
    const points = [
      point({ metres: 6_214_000, date: TODAY }),
      point({ metres: 6_214_000, date: '2026-09-15' }),
    ];
    expect(lastRideMetres(points)).toBeNull();
  });
});

describe('ago phrases', () => {
  it('reads the way the board writes it', () => {
    expect(agoPhrase(TODAY, TODAY)).toBe('today');
    expect(agoPhrase('2026-09-15', TODAY)).toBe('yesterday');
    expect(agoPhrase('2026-09-13', TODAY)).toBe('3 days ago');
  });

  it('never claims a negative age for a record dated ahead', () => {
    expect(agoPhrase('2026-09-20', TODAY)).toBe('today');
    expect(compactAgo('2026-09-20', TODAY)).toBe('Today');
  });

  it('switches to weeks once days stop being useful', () => {
    expect(compactAgo('2026-09-13', TODAY)).toBe('3d ago');
    expect(compactAgo('2026-08-01', TODAY)).toBe('6w ago');
  });
});

describe('weekdayDate', () => {
  it('names the day the header prints', () => {
    // 16 September 2026 is a Wednesday; the board's own sample is a Tuesday.
    expect(weekdayDate('2026-09-15')).toBe('Tue 15 Sep');
    expect(weekdayDate(TODAY)).toBe('Wed 16 Sep');
  });
});

describe('odometerUpdatedLine', () => {
  it('names the reading and the ride that produced it', () => {
    expect(
      odometerUpdatedLine({
        latest: point({ metres: 34_712_000, date: '2026-09-13' }),
        lastRideMetres: 86_000,
        distanceUnit: 'km',
        today: TODAY,
      }),
    ).toBe('Updated 3 days ago · last ride 86 km');
  });

  it('says a setup figure is a setup figure', () => {
    expect(
      odometerUpdatedLine({
        latest: point({ id: INITIAL_ODOMETER_POINT_ID, metres: 6_214_000, date: TODAY }),
        lastRideMetres: null,
        distanceUnit: 'km',
        today: TODAY,
      }),
    ).toBe('From setup · today');
  });

  it('drops the ride rather than printing 0 km', () => {
    expect(
      odometerUpdatedLine({
        latest: point({ metres: 6_214_000, date: TODAY }),
        lastRideMetres: null,
        distanceUnit: 'km',
        today: TODAY,
      }),
    ).toBe('Updated today');
  });

  it('has an answer with no readings at all', () => {
    expect(
      odometerUpdatedLine({ latest: null, lastRideMetres: null, distanceUnit: 'km', today: TODAY }),
    ).toBe('No reading logged yet');
  });
});

describe('costPerDistanceNote', () => {
  it('names the log the figure rests on', () => {
    expect(
      costPerDistanceNote({ trackedMetres: 210_000, settledMetres: 1_000_000, distanceUnit: 'km' }),
    ).toBe('Cost / km is based on 210 km of logging so far — it settles as your log grows.');
  });

  it('falls silent once the log has settled', () => {
    expect(
      costPerDistanceNote({ trackedMetres: 1_000_000, settledMetres: 1_000_000, distanceUnit: 'km' }),
    ).toBeNull();
  });
});

describe('maintenanceHighlights', () => {
  const overdue = { rule: rule('r1', 'Engine oil'), status: status({ kind: 'overdue', remainingMetres: -310_000 }) };
  const dueSoon = { rule: rule('r2', 'Chain lube'), status: status({ kind: 'due_soon', remainingMetres: 240_000 }) };
  const fine = { rule: rule('r3', 'Air filter'), status: status({ kind: 'good', remainingMetres: 4_000_000 }) };

  it('shows the pressing rules, worst first, and counts the rest', () => {
    const result = maintenanceHighlights([fine, dueSoon, overdue, fine, fine, fine]);
    expect(result.shown.map((r) => r.rule.name)).toEqual(['Engine oil', 'Chain lube']);
    expect(result.otherOkCount).toBe(4);
  });

  it('shows nothing and counts everything when every rule is inside its interval', () => {
    const result = maintenanceHighlights([fine, fine]);
    expect(result.shown).toEqual([]);
    expect(result.otherOkCount).toBe(2);
  });
});

describe('maintenanceDueLine', () => {
  it('uses the board wording for distance', () => {
    expect(maintenanceDueLine(status({ remainingMetres: 240_000 }), 'km')).toBe('Due in 240 km');
    expect(maintenanceDueLine(status({ remainingMetres: -310_000 }), 'km')).toBe('Overdue by 310 km');
  });

  it('falls back to days when a rule has no distance interval', () => {
    expect(maintenanceDueLine(status({ remainingDays: 12 }), 'km')).toBe('Due in 12 days');
    expect(maintenanceDueLine(status({ remainingDays: -1 }), 'km')).toBe('Overdue by 1 day');
    expect(maintenanceDueLine(status({ remainingDays: 0 }), 'km')).toBe('Due today');
  });

  it('says what is missing rather than projecting from nothing', () => {
    expect(maintenanceDueLine(status({ neverCompleted: true, remainingMetres: 10 }), 'km')).toBe(
      'Never completed',
    );
    expect(maintenanceDueLine(status({}), 'km')).toBe('No interval set');
  });
});

describe('activityTitle', () => {
  it('puts the kind in front, and does not repeat it', () => {
    expect(activityTitle({ source: 'fuel', label: 'Fuel — 8.2 L' })).toBe('Fuel · 8.2 L');
    expect(activityTitle({ source: 'service', label: 'Brake pads' })).toBe('Service · Brake pads');
    expect(activityTitle({ source: 'manual', label: 'Parking' })).toBe('Expense · Parking');
  });
});

describe('activityDetail', () => {
  const context = {
    fuelEntries: [{ id: 'f1', odometerMetres: 34_712_000 }],
    services: [
      { id: 's1', workshop: 'Rahim Motors', selfService: false },
      { id: 's2', workshop: null, selfService: true },
    ],
  };

  it('quotes what the record knows', () => {
    expect(
      activityDetail({ source: 'fuel', sourceId: 'f1', date: '2026-09-13' }, context, 'km'),
    ).toBe('13 Sep · 34,712 km');
    expect(
      activityDetail({ source: 'service', sourceId: 's1', date: '2026-09-09' }, context, 'km'),
    ).toBe('9 Sep · Rahim Motors');
    expect(
      activityDetail({ source: 'service', sourceId: 's2', date: '2026-05-18' }, context, 'km'),
    ).toBe('18 May · self-service');
  });

  it('stops at the date rather than inventing a detail', () => {
    expect(
      activityDetail({ source: 'manual', sourceId: 'e1', date: '2026-09-08' }, context, 'km'),
    ).toBe('8 Sep');
    expect(
      activityDetail({ source: 'fuel', sourceId: 'gone', date: '2026-09-08' }, context, 'km'),
    ).toBe('8 Sep');
  });
});

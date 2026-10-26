import type { MaintenanceStatus } from './maintenance';
import { describeProjection, projectServicePlan } from './serviceplan';

const status = (over: Partial<MaintenanceStatus> = {}): MaintenanceStatus => ({
  kind: 'good',
  dueAtMetres: null,
  remainingMetres: null,
  dueOnDate: null,
  remainingDays: null,
  neverCompleted: false,
  ...over,
});

const entry = (id: string, name: string, over: Partial<MaintenanceStatus> = {}) => ({
  rule: { id, name },
  status: status(over),
});

const TODAY = '2026-09-16';
/** 800 km a month, the pace the Service plan board is drawn at. */
const EIGHT_HUNDRED_KM = 800_000;

describe('projectServicePlan', () => {
  it('turns remaining distance into a date at the rider’s own pace', () => {
    const [row] = projectServicePlan({
      rules: [entry('r1', 'Chain lube', { kind: 'good', dueAtMetres: 34_952_000, remainingMetres: 240_000 })],
      monthlyMetres: EIGHT_HUNDRED_KM,
      today: TODAY,
    });

    // 240 km at 800 km / 30.44 days ≈ 26.3 m/day → 9 days out.
    expect(row?.projectedOn).toBe('2026-09-25');
    expect(row?.overdue).toBe(false);
    expect(row?.dueAtMetres).toBe(34_952_000);
  });

  it('projects no date at all when there is too little history for a rate', () => {
    const [row] = projectServicePlan({
      rules: [entry('r1', 'Chain lube', { dueAtMetres: 34_952_000, remainingMetres: 240_000 })],
      monthlyMetres: null,
      today: TODAY,
    });

    expect(row?.projectedOn).toBeNull();
    expect(row?.dueAtMetres).toBe(34_952_000);
  });

  it('marks an overdue rule overdue and dates nothing', () => {
    const [row] = projectServicePlan({
      rules: [
        entry('r1', 'Engine oil', { kind: 'overdue', dueAtMetres: 34_402_000, remainingMetres: -310_000 }),
      ],
      monthlyMetres: EIGHT_HUNDRED_KM,
      today: TODAY,
    });

    expect(row?.overdue).toBe(true);
    expect(row?.projectedOn).toBeNull();
  });

  it('takes whichever of distance and calendar comes first', () => {
    const [row] = projectServicePlan({
      rules: [
        entry('r1', 'Air filter', {
          dueAtMetres: 40_000_000,
          remainingMetres: 5_000_000,
          dueOnDate: '2026-11-01',
          remainingDays: 46,
        }),
      ],
      monthlyMetres: EIGHT_HUNDRED_KM,
      today: TODAY,
    });

    // 5,000 km at 800 km a month is over six months away; the date interval wins.
    expect(row?.projectedOn).toBe('2026-11-01');
  });

  it('drops a rule that can never fall due', () => {
    const rows = projectServicePlan({
      rules: [entry('r1', 'Nothing set')],
      monthlyMetres: EIGHT_HUNDRED_KM,
      today: TODAY,
    });

    expect(rows).toHaveLength(0);
  });

  it('sorts overdue first, then by the odometer it falls due at', () => {
    const rows = projectServicePlan({
      rules: [
        entry('r3', 'Spark plug', { dueAtMetres: 40_150_000, remainingMetres: 5_438_000 }),
        entry('r2', 'Air filter', { dueAtMetres: 36_150_000, remainingMetres: 1_438_000 }),
        entry('r1', 'Engine oil', { kind: 'overdue', dueAtMetres: 34_402_000, remainingMetres: -310_000 }),
      ],
      monthlyMetres: EIGHT_HUNDRED_KM,
      today: TODAY,
    });

    expect(rows.map((r) => r.name)).toEqual(['Engine oil', 'Air filter', 'Spark plug']);
  });
});

describe('describeProjection', () => {
  it('counts days inside a fortnight', () => {
    expect(describeProjection('2026-09-19', TODAY)).toBe('In about 3 days');
    expect(describeProjection('2026-09-17', TODAY)).toBe('In about a day');
    expect(describeProjection(TODAY, TODAY)).toBe('Due now');
  });

  it('names a part of the month near term', () => {
    expect(describeProjection('2026-10-04', TODAY)).toBe('Around early Oct');
    expect(describeProjection('2026-10-15', TODAY)).toBe('Around mid Oct');
    expect(describeProjection('2026-10-28', TODAY)).toBe('Around late Oct');
  });

  it('names the month further out, and the year once it is more than one away', () => {
    expect(describeProjection('2027-02-11', TODAY)).toBe('Around Feb');
    expect(describeProjection('2027-08-02', TODAY)).toBe('Around Aug');
    expect(describeProjection('2028-01-02', TODAY)).toBe('Around Jan 2028');
  });

  it('says nothing when there is no date', () => {
    expect(describeProjection(null, TODAY)).toBeNull();
  });
});

import type { VaultDocument } from '@/types';
import type { MaintenanceStatus } from './maintenance';
import { buildReminders, type ReminderRule } from './reminders';

const TODAY = '2026-09-16';

const doc = (id: string, title: string, expiresOn: string | null): VaultDocument => ({
  id, userId: 'u1', bikeId: 'b1', createdAt: 1, updatedAt: 1,
  kind: 'insurance', customKindLabel: null, title, reference: 'POL-99',
  issuedOn: null, expiresOn, filePath: null, keepOfflineCopy: true, notes: null, clientRef: id,
});

const status = (over: Partial<MaintenanceStatus>): MaintenanceStatus => ({
  kind: 'good', dueAtMetres: null, remainingMetres: null, dueOnDate: null,
  remainingDays: null, neverCompleted: false, ...over,
});

const rule = (id: string, name: string, warnAheadDays: number): ReminderRule => ({
  id, name, warnAheadDays,
});

const base = { rules: [], documents: [], today: TODAY };

describe('document expiry: 30, 14, 3 and the day itself', () => {
  // Hand-computed from 2026-10-16: minus 30 is 2026-09-16 (September has 30
  // days, so 16 Oct − 16 days lands on 30 Sep, and 14 more on 16 Sep); minus 14
  // is 2026-10-02; minus 3 is 2026-10-13.
  const reminders = buildReminders({ ...base, documents: [doc('d1', 'Insurance', '2026-10-16')] });

  it('schedules exactly four, on the promised days', () => {
    expect(reminders.map((r) => r.fireOn)).toEqual([
      '2026-09-16',
      '2026-10-02',
      '2026-10-13',
      '2026-10-16',
    ]);
  });

  it('keys every id off the document id, so a delete takes them with it', () => {
    expect(reminders.map((r) => r.id)).toEqual([
      'doc:d1:30',
      'doc:d1:14',
      'doc:d1:3',
      'doc:d1:0',
    ]);
  });

  it('says how long is left, and on the day says today', () => {
    expect(reminders[0]!.title).toBe('Insurance expires in 30 days');
    expect(reminders[2]!.title).toBe('Insurance expires in 3 days');
    expect(reminders[3]!.title).toBe('Insurance expires today');
  });

  it('quotes the date and never the policy number, which a lock screen would show', () => {
    expect(reminders[0]!.body).toBe('Valid until 16 Oct 2026.');
    for (const reminder of reminders) expect(reminder!.body).not.toContain('POL-99');
  });

  it('routes to the document itself, not a list the rider has to search', () => {
    for (const reminder of reminders) expect(reminder!.route).toBe('/records/document?id=d1');
  });
});

describe('dates already gone are dropped, not fired', () => {
  it('keeps only the leads still ahead', () => {
    // Eight days out: the 30- and 14-day marks are behind us.
    const reminders = buildReminders({ ...base, documents: [doc('d1', 'Tax token', '2026-09-24')] });
    expect(reminders.map((r) => r.id)).toEqual(['doc:d1:3', 'doc:d1:0']);
    expect(reminders.map((r) => r.fireOn)).toEqual(['2026-09-21', '2026-09-24']);
  });

  it('fires the day-of reminder when the document expires today', () => {
    const reminders = buildReminders({ ...base, documents: [doc('d1', 'Fitness', TODAY)] });
    expect(reminders).toEqual([
      {
        id: 'doc:d1:0',
        fireOn: TODAY,
        title: 'Fitness expires today',
        body: 'Valid until 16 Sep 2026.',
        route: '/records/document?id=d1',
      },
    ]);
  });

  it('nags once today for a document that already lapsed rather than going quiet', () => {
    const [reminder, ...rest] = buildReminders({
      ...base,
      documents: [doc('d1', 'Registration', '2026-08-30')],
    });
    expect(rest).toEqual([]);
    expect(reminder!.id).toBe('doc:d1:expired');
    expect(reminder!.fireOn).toBe(TODAY);
    expect(reminder!.title).toBe('Registration has expired');
    expect(reminder!.body).toBe('Expired 30 Aug 2026. Renew it before your next ride.');
  });

  it('ignores a document with no expiry date at all', () => {
    expect(buildReminders({ ...base, documents: [doc('d1', 'Purchase invoice', null)] })).toEqual([]);
  });
});

describe('maintenance rules that fall due on a date', () => {
  it('warns on the rule’s own warn-ahead day and again on the day', () => {
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Engine oil & filter', 14),
          status: status({ kind: 'upcoming', dueOnDate: '2026-10-16', remainingDays: 30 }),
        },
      ],
    });
    expect(reminders).toEqual([
      {
        id: 'rule:r1:warn',
        fireOn: '2026-10-02',
        title: 'Engine oil & filter is due in 14 days',
        body: 'Due 16 Oct 2026.',
        route: '/maintenance/rule?id=r1',
      },
      {
        id: 'rule:r1:due',
        fireOn: '2026-10-16',
        title: 'Engine oil & filter is due today',
        body: 'Scheduled for 16 Oct 2026.',
        route: '/maintenance/rule?id=r1',
      },
    ]);
  });

  it('honours each rule’s own lead rather than one house lead time', () => {
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Chain clean, lube & tension', 3),
          status: status({ kind: 'upcoming', dueOnDate: '2026-09-30', remainingDays: 14 }),
        },
      ],
    });
    expect(reminders.map((r) => r.fireOn)).toEqual(['2026-09-27', '2026-09-30']);
  });

  it('drops the warn-ahead day once it has passed, keeping the due day', () => {
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Tyre pressure & tread', 7),
          status: status({ kind: 'due_soon', dueOnDate: '2026-09-20', remainingDays: 4 }),
        },
      ],
    });
    expect(reminders.map((r) => r.id)).toEqual(['rule:r1:due']);
  });

  it('does not put two notifications on one morning when the warn-ahead is zero', () => {
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Wash', 0),
          status: status({ kind: 'upcoming', dueOnDate: '2026-09-30', remainingDays: 14 }),
        },
      ],
    });
    expect(reminders.map((r) => r.id)).toEqual(['rule:r1:due']);
  });

  it('nags once today for a rule past its date, saying how late it is', () => {
    const [reminder, ...rest] = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Air filter', 30),
          status: status({ kind: 'overdue', dueOnDate: '2026-09-01', remainingDays: -15 }),
        },
      ],
    });
    expect(rest).toEqual([]);
    expect(reminder).toEqual({
      id: 'rule:r1:overdue',
      fireOn: TODAY,
      title: 'Air filter is overdue',
      body: 'Was due 1 Sep 2026 — 15 days ago.',
      route: '/maintenance/rule?id=r1',
    });
  });

  it('skips a rule the rider turned off', () => {
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: { ...rule('r1', 'Air filter', 30), enabled: false },
          status: status({ kind: 'overdue', dueOnDate: '2026-09-01', remainingDays: -15 }),
        },
      ],
    });
    expect(reminders).toEqual([]);
  });
});

describe('distance-based rules cannot be scheduled by date', () => {
  it('schedules nothing for a rule that is overdue on distance alone', () => {
    // 310 km past due, but no date exists on which that becomes true — the
    // odometer only moves when the rider logs a reading. The in-app attention
    // list carries this one.
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Engine oil & filter', 14),
          status: status({
            kind: 'overdue',
            dueAtMetres: 42_000_000,
            remainingMetres: -310_000,
            dueOnDate: null,
            remainingDays: null,
          }),
        },
      ],
    });
    expect(reminders).toEqual([]);
  });

  it('warns on the date arm of a rule that is overdue on distance but fine on time', () => {
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Engine oil & filter', 14),
          status: status({
            kind: 'overdue',
            remainingMetres: -310_000,
            dueOnDate: '2026-10-16',
            remainingDays: 30,
          }),
        },
      ],
    });
    expect(reminders.map((r) => r.id)).toEqual(['rule:r1:warn', 'rule:r1:due']);
  });

  it('schedules nothing for a rule that has never been completed', () => {
    const reminders = buildReminders({
      ...base,
      rules: [
        {
          rule: rule('r1', 'Brake pads & fluid', 30),
          status: status({ kind: 'unknown', neverCompleted: true }),
        },
      ],
    });
    expect(reminders).toEqual([]);
  });
});

describe('the rider’s two switches', () => {
  const input = {
    today: TODAY,
    documents: [doc('d1', 'Insurance', '2026-10-16')],
    rules: [
      {
        rule: rule('r1', 'Engine oil & filter', 14),
        status: status({ kind: 'upcoming', dueOnDate: '2026-10-16', remainingDays: 30 }),
      },
    ],
  };

  it('schedules both kinds by default, soonest first', () => {
    const reminders = buildReminders(input);
    expect(reminders.map((r) => `${r.fireOn} ${r.id}`)).toEqual([
      '2026-09-16 doc:d1:30',
      '2026-10-02 doc:d1:14',
      '2026-10-02 rule:r1:warn',
      '2026-10-13 doc:d1:3',
      '2026-10-16 doc:d1:0',
      '2026-10-16 rule:r1:due',
    ]);
  });

  it('drops maintenance reminders when that switch is off', () => {
    const reminders = buildReminders({ ...input, maintenanceEnabled: false });
    expect(reminders.every((r) => r.id.startsWith('doc:'))).toBe(true);
    expect(reminders).toHaveLength(4);
  });

  it('drops document reminders when that switch is off', () => {
    const reminders = buildReminders({ ...input, documentExpiryEnabled: false });
    expect(reminders.map((r) => r.id)).toEqual(['rule:r1:warn', 'rule:r1:due']);
  });

  it('schedules nothing at all when both are off', () => {
    expect(
      buildReminders({ ...input, maintenanceEnabled: false, documentExpiryEnabled: false }),
    ).toEqual([]);
  });
});

describe('ids survive a rebuild so cancel-and-reschedule is stable', () => {
  it('produces the same ids for the same data', () => {
    const input = { ...base, documents: [doc('d1', 'Insurance', '2026-10-16')] };
    expect(buildReminders(input).map((r) => r.id)).toEqual(buildReminders(input).map((r) => r.id));
  });

  it('stops producing a deleted document’s ids entirely', () => {
    const before = buildReminders({ ...base, documents: [doc('d1', 'Insurance', '2026-10-16')] });
    const after = buildReminders({ ...base, documents: [] });
    expect(before.length).toBe(4);
    expect(after).toEqual([]);
  });
});

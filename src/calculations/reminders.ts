import type { IsoDate, MaintenanceRule, VaultDocument } from '@/types';
import type { MaintenanceStatus } from './maintenance';
import { addDays, compareIso, formatLongDate } from '@/utils/date';

/**
 * The reminders Revora promises, as dates.
 *
 * Five screens tell the rider that "reminders fire at 30, 14 and 3 days before
 * an expiry date" and that they are "scheduled on this phone". This file is the
 * arithmetic behind that sentence: it turns the already-computed maintenance
 * statuses and the documents in the vault into a flat list of
 * `{ id, fireOn, title, body, route }`, and nothing else.
 *
 * Three rules hold it together:
 *
 *   - **It derives nothing of its own.** Whether a rule is overdue and when it
 *     next falls due are `MaintenanceStatus` fields, computed once in
 *     `analyseBike()`. A reminder can therefore never disagree with the badge
 *     on the bell or the row on the Dashboard (requirement 6 / mistake 4).
 *   - **Every id is keyed off the record id.** `doc:<documentId>:14`,
 *     `rule:<ruleId>:due`. Because the service cancels everything and
 *     reschedules from this list on every change rather than diffing, a deleted
 *     document's three pending notifications simply fail to be re-created — no
 *     orphan can survive an edit or a delete.
 *   - **Nothing is scheduled in the past.** A date already gone is dropped here,
 *     not silently fired by the OS.
 *
 * **Distance-based rules are deliberately absent.** "Due in 300 km" depends on
 * the odometer, which only moves when the rider logs a reading, so there is no
 * date on which it can honestly be scheduled — guessing one from average
 * mileage would produce a notification that is wrong most of the time. A
 * distance rule with no `intervalDays` therefore contributes no reminder and is
 * left to the in-app attention list, which recomputes every time the app opens.
 */

/** The lead times the app promises, in days before the expiry date. */
export const DOCUMENT_LEAD_DAYS: readonly number[] = [30, 14, 3, 0];

export type Reminder = {
  /** Stable and derived from the record id, so a delete takes its reminders with it. */
  id: string;
  /** The calendar day the notification should arrive — never a `Date`, never UTC. */
  fireOn: IsoDate;
  title: string;
  body: string;
  /** An expo-router href, ready for `router.push()` when the rider taps it. */
  route: string;
};

/**
 * The fields a rule must carry. A structural subset rather than
 * `MaintenanceRule` so tests can build one in a line, exactly as `attention.ts`
 * does.
 */
export type ReminderRule = Pick<MaintenanceRule, 'id' | 'name' | 'warnAheadDays'> & {
  enabled?: boolean;
};

export type ReminderInput = {
  /** `analytics.maintenance.rules` — already filtered to enabled rules. */
  rules: readonly { rule: ReminderRule; status: MaintenanceStatus }[];
  documents: readonly VaultDocument[];
  today: IsoDate;
  /** `profile.notifications.maintenanceDue`. Defaults to on, as the screen does. */
  maintenanceEnabled?: boolean;
  /** `profile.notifications.documentExpiry`. Defaults to on, as the screen does. */
  documentExpiryEnabled?: boolean;
};

function dayWord(days: number): string {
  return days === 1 ? 'day' : 'days';
}

/**
 * Document reminders.
 *
 * A document expiring 2026-10-16, seen on 2026-09-16, schedules four: 09-16
 * (thirty days out), 10-02, 10-13 and 10-16 itself. One already expired has all
 * four dates behind it, so it gets a single reminder today instead of silently
 * dropping off the list — an expired tax token is the most expensive thing in
 * the vault to forget.
 *
 * The body quotes the date and nothing else. A policy or registration number
 * would land on a lock screen, where it is readable without unlocking the phone.
 */
function documentReminders(document: VaultDocument, today: IsoDate): Reminder[] {
  const { expiresOn } = document;
  if (expiresOn === null) return [];

  const route = `/records/document?id=${document.id}`;

  if (compareIso(expiresOn, today) < 0) {
    return [
      {
        id: `doc:${document.id}:expired`,
        fireOn: today,
        title: `${document.title} has expired`,
        body: `Expired ${formatLongDate(expiresOn)}. Renew it before your next ride.`,
        route,
      },
    ];
  }

  const out: Reminder[] = [];
  for (const lead of DOCUMENT_LEAD_DAYS) {
    const fireOn = addDays(expiresOn, -lead);
    if (compareIso(fireOn, today) < 0) continue;
    out.push({
      id: `doc:${document.id}:${lead}`,
      fireOn,
      title:
        lead === 0
          ? `${document.title} expires today`
          : `${document.title} expires in ${lead} ${dayWord(lead)}`,
      body: `Valid until ${formatLongDate(expiresOn)}.`,
      route,
    });
  }
  return out;
}

/**
 * Maintenance reminders, for rules that fall due on a date.
 *
 * Two dates per rule: the day it enters its own warn-ahead window, and the day
 * it is actually due. `warnAheadDays` is the rider's setting, so a chain rule
 * warning three days out and an air filter warning thirty both behave as
 * configured rather than on one house lead time.
 *
 * When the rule is already past its date, the pair is behind us and a single
 * reminder goes out today instead.
 */
function ruleReminders(
  rule: ReminderRule,
  status: MaintenanceStatus,
  today: IsoDate,
): Reminder[] {
  // Distance-only rules have no `dueOnDate` — see the note at the top of the file.
  if (rule.enabled === false) return [];
  const dueOn = status.dueOnDate;
  if (dueOn === null) return [];

  const route = `/maintenance/rule?id=${rule.id}`;

  // `remainingDays` is the date arm of the status specifically, so a rule that
  // is overdue on distance but fine on time is not falsely nagged about here.
  if (status.remainingDays !== null && status.remainingDays < 0) {
    const late = Math.abs(status.remainingDays);
    return [
      {
        id: `rule:${rule.id}:overdue`,
        fireOn: today,
        title: `${rule.name} is overdue`,
        body: `Was due ${formatLongDate(dueOn)} — ${late} ${dayWord(late)} ago.`,
        route,
      },
    ];
  }

  const out: Reminder[] = [];
  const warnOn = addDays(dueOn, -rule.warnAheadDays);
  // A zero warn-ahead would otherwise put two notifications on the same morning.
  if (rule.warnAheadDays > 0 && compareIso(warnOn, today) >= 0) {
    out.push({
      id: `rule:${rule.id}:warn`,
      fireOn: warnOn,
      title: `${rule.name} is due in ${rule.warnAheadDays} ${dayWord(rule.warnAheadDays)}`,
      body: `Due ${formatLongDate(dueOn)}.`,
      route,
    });
  }
  if (compareIso(dueOn, today) >= 0) {
    out.push({
      id: `rule:${rule.id}:due`,
      fireOn: dueOn,
      title: `${rule.name} is due today`,
      body: `Scheduled for ${formatLongDate(dueOn)}.`,
      route,
    });
  }
  return out;
}

/**
 * Every reminder that should currently exist on this phone, soonest first.
 *
 * The result is a complete replacement for what is scheduled — the service
 * cancels and rewrites from it rather than working out a diff, because a diff
 * has to be right about deletions and this cannot be wrong about them.
 */
export function buildReminders(input: ReminderInput): Reminder[] {
  const out: Reminder[] = [];

  if (input.maintenanceEnabled !== false) {
    for (const { rule, status } of input.rules) {
      out.push(...ruleReminders(rule, status, input.today));
    }
  }

  if (input.documentExpiryEnabled !== false) {
    for (const document of input.documents) {
      out.push(...documentReminders(document, input.today));
    }
  }

  return out.sort((a, b) => {
    const byDate = compareIso(a.fireOn, b.fireOn);
    if (byDate !== 0) return byDate;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { buildReminders, type Reminder, type ReminderInput } from '@/calculations/reminders';
import { isoToDate } from '@/utils/date';
import { log } from './logger';

/**
 * The reminders, actually on the phone.
 *
 * Five screens promise the rider that "reminders fire at 30, 14 and 3 days
 * before an expiry date" and that they are "scheduled on this phone, so they
 * arrive whether or not you have a connection". This file is the half of that
 * sentence the OS has to keep: it takes the list `buildReminders()` computed and
 * hands each entry to Android's alarm manager as a *local* notification. No
 * server, no push token, no connection.
 *
 * Four rules govern it:
 *
 *   - **It derives nothing.** Every title, body, date and route arrives already
 *     computed from `src/calculations/reminders.ts`, which reads the same
 *     `analyseBike()` statuses the Dashboard and the bell badge read. A
 *     notification can therefore never contradict what the app shows when the
 *     rider opens it (requirement 6 / mistake 4).
 *   - **Cancel and rewrite, never diff.** `scheduleRemindersFor()` clears every
 *     pending reminder and re-creates the current list. A diff has to be right
 *     about deletions; this cannot be wrong about them. Delete a document and
 *     its three pending notifications are simply not written back.
 *   - **Ids are the record's own.** `doc:<documentId>:14`, `rule:<ruleId>:due`.
 *     Passing them to `scheduleNotificationAsync` as the `identifier` means the
 *     same reminder can never be scheduled twice, even if two writes land
 *     together and both trigger a reschedule.
 *   - **Nothing here throws into a screen.** A rider who declined the permission,
 *     or an emulator with no notification service at all, must not turn a saved
 *     fuel entry into an error toast. Every failure is logged and swallowed.
 *
 * **Distance-based maintenance rules are deliberately never scheduled.** "Due in
 * 300 km" depends on the odometer, which moves only when the rider logs a
 * reading, so there is no date on which it honestly becomes true — inventing one
 * from average mileage would produce a notification that is wrong most of the
 * time. Those rules carry no `dueOnDate`, contribute no reminder, and are left
 * to the in-app attention list, which recomputes every time the app opens.
 */

/** The one Android channel. Its name is what the rider sees in system settings. */
export const REMINDER_CHANNEL_ID = 'revora-reminders';
export const REMINDER_CHANNEL_NAME = 'Maintenance & documents';

/**
 * The local hour reminders arrive, on the fire date.
 *
 * 09:00 is after the commute has been decided but early enough to act on —
 * a document expiring today is still renewable, and a service can still be
 * booked. It is local wall-clock time, built from the calendar date with
 * `isoToDate`, so it never drifts through UTC (requirement 64).
 */
export const REMINDER_HOUR = 9;

/**
 * Android's alarm manager degrades badly past a few dozen exact alarms, and a
 * rider with forty pending notifications is being nagged rather than reminded.
 * The list is sorted soonest-first, so the cut only ever drops the far future —
 * which the next reschedule, days later, will pick up again.
 */
export const MAX_SCHEDULED = 60;

export type ScheduleOutcome = {
  /** How many reminders were handed to the OS. */
  scheduled: number;
  /** Dropped because the cap was hit, not because they were wrong. */
  skipped: number;
  /** False when the OS refused everything — no permission, or no module. */
  ok: boolean;
};

/**
 * Asks for the notification permission.
 *
 * Revora never asks on first launch: the rider sees what reminders do on the
 * Notifications screen and asks for them there (requirement 49 / mistake 18).
 * This is the mechanism, not the policy — the screen decides when to call it.
 */
export async function requestPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return { granted: true, canAskAgain: current.canAskAgain };
    const next = await Notifications.requestPermissionsAsync();
    return { granted: next.granted, canAskAgain: next.canAskAgain };
  } catch (error) {
    log.warn('notifications', 'permission request failed', { error: String(error) });
    return { granted: false, canAskAgain: false };
  }
}

/** Whether reminders can currently be delivered, without prompting for anything. */
export async function hasPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch (error) {
    log.warn('notifications', 'permission check failed', { error: String(error) });
    return false;
  }
}

/**
 * Creates the Android channel.
 *
 * Android 8 and later drop any notification posted to a channel that does not
 * exist — silently, with nothing in logcat that names the app. Creating it is
 * idempotent, so this runs before every schedule rather than once at startup,
 * where a cleared-data launch would miss it.
 */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: REMINDER_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F4511E',
      // The rider can still silence the channel in system settings; that is
      // theirs to decide and Revora must not fight it.
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (error) {
    log.warn('notifications', 'channel setup failed', { error: String(error) });
  }
}

/**
 * The instant a reminder should arrive.
 *
 * `fireOn` is a calendar date; the notification needs a moment. Midnight would
 * arrive while the phone is face-down on a bedside table, so it is
 * `REMINDER_HOUR` local on that date.
 *
 * When that instant has already passed — the rider opened the app at eleven and
 * the reminder was for nine this morning — it rolls forward one day rather than
 * firing on the spot. Firing immediately would mean a notification every time
 * the app is opened, because every open cancels and reschedules; rolling forward
 * keeps it to at most one a day, and tomorrow's rebuild recomputes the wording
 * against tomorrow's date anyway.
 */
export function fireInstant(reminder: Reminder, now: Date = new Date()): Date {
  const at = isoToDate(reminder.fireOn);
  at.setHours(REMINDER_HOUR, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Replaces every scheduled reminder with the ones the current data implies.
 *
 * Call it after anything that can change a due date: a service logged, a
 * document saved or deleted, a maintenance rule edited, a notification
 * preference toggled, and once when the app comes to the foreground so a phone
 * left closed for a fortnight catches up.
 *
 * It is safe to call when the permission was never granted — the OS simply has
 * nothing to deliver, and the in-app list carries the same facts regardless.
 */
export async function scheduleRemindersFor(input: ReminderInput): Promise<ScheduleOutcome> {
  const reminders = buildReminders(input);

  try {
    // Cancel first and unconditionally. If the rider has just turned both
    // switches off, or deleted their last document, the correct end state is an
    // empty queue — and that only happens if the cancel does not depend on
    // there being something to schedule afterwards.
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    log.warn('notifications', 'could not clear the schedule', { error: String(error) });
    return { scheduled: 0, skipped: reminders.length, ok: false };
  }

  if (reminders.length === 0) return { scheduled: 0, skipped: 0, ok: true };

  if (!(await hasPermission())) {
    // Not a failure: the rider declined, and the attention list still shows
    // everything. Scheduling anyway would queue notifications that the OS
    // discards, and count against the alarm budget for nothing.
    return { scheduled: 0, skipped: reminders.length, ok: true };
  }

  await ensureChannel();

  const due = reminders.slice(0, MAX_SCHEDULED);
  const skipped = reminders.length - due.length;
  let scheduled = 0;

  for (const reminder of due) {
    try {
      await Notifications.scheduleNotificationAsync({
        // The record's own id. Rescheduling overwrites rather than duplicates.
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: reminder.body,
          // Read by the tap handler to deep-link straight at the record.
          data: { route: reminder.route, reminderId: reminder.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireInstant(reminder),
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      scheduled += 1;
    } catch (error) {
      // One bad reminder must not cost the rider the other fifty-nine.
      log.warn('notifications', 'could not schedule a reminder', {
        id: reminder.id,
        error: String(error),
      });
    }
  }

  if (skipped > 0) {
    log.debug('notifications', 'reminder cap reached', { scheduled, skipped });
  }
  return { scheduled, skipped, ok: true };
}

/**
 * Clears every pending reminder.
 *
 * Used on sign-out and when the rider switches bikes away from the one the
 * queue was built from: the next rider of this phone must not be told about
 * someone else's insurance.
 */
export async function cancelAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    log.warn('notifications', 'could not cancel reminders', { error: String(error) });
  }
}

/** What is actually queued. Exposed for diagnostics, not for the UI to derive from. */
export async function scheduledReminderIds(): Promise<string[]> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    return pending.map((request) => request.identifier);
  } catch (error) {
    log.warn('notifications', 'could not read the schedule', { error: String(error) });
    return [];
  }
}

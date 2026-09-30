import { Platform } from 'react-native';

import type { VaultDocument } from '@/types';
import type { MaintenanceStatus } from '@/calculations/maintenance';
import {
  cancelAll,
  fireInstant,
  MAX_SCHEDULED,
  REMINDER_CHANNEL_ID,
  REMINDER_CHANNEL_NAME,
  requestPermission,
  scheduleRemindersFor,
} from './notifications';

/**
 * The scheduling half of the promise.
 *
 * `reminders.test.ts` proves the dates are right. This proves the phone is
 * actually told about them: that every open cancels before it writes, that the
 * identifier is the record's own id, that a declined permission is quiet rather
 * than broken, and that nothing here can throw into a screen.
 */

const mockScheduleNotificationAsync = jest.fn<Promise<string>, [Record<string, unknown>]>();
const mockCancelAllScheduledNotificationsAsync = jest.fn<Promise<void>, []>();
const mockSetNotificationChannelAsync = jest.fn<Promise<unknown>, [string, unknown]>();
const mockGetPermissionsAsync = jest.fn<Promise<{ granted: boolean; canAskAgain: boolean }>, []>();
const mockRequestPermissionsAsync = jest.fn<Promise<{ granted: boolean; canAskAgain: boolean }>, []>();
const mockGetAllScheduledNotificationsAsync = jest.fn<Promise<{ identifier: string }[]>, []>();

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...(args as [never])),
  cancelAllScheduledNotificationsAsync: () => mockCancelAllScheduledNotificationsAsync(),
  setNotificationChannelAsync: (...args: unknown[]) =>
    mockSetNotificationChannelAsync(...(args as [never, never])),
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  getAllScheduledNotificationsAsync: () => mockGetAllScheduledNotificationsAsync(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

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

const base = { rules: [], documents: [], today: TODAY };

/** What `mockScheduleNotificationAsync` was asked to write, in call order. */
function written() {
  return mockScheduleNotificationAsync.mock.calls.map(([request]) => request as {
    identifier: string;
    content: { title: string; body: string; data: { route: string } };
    trigger: { type: string; date: Date; channelId: string };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Revora ships Android-first, and the channel only exists there.
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: false });
  mockRequestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: false });
  mockCancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
  mockSetNotificationChannelAsync.mockResolvedValue(undefined);
  mockScheduleNotificationAsync.mockImplementation((request) =>
    Promise.resolve(String((request as { identifier: string }).identifier)),
  );
  mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);
});

describe('the four promised dates reach the OS', () => {
  it('schedules one local notification per reminder, keyed off the record id', async () => {
    const outcome = await scheduleRemindersFor({
      ...base,
      documents: [doc('d1', 'Insurance', '2026-10-16')],
    });

    expect(outcome).toEqual({ scheduled: 4, skipped: 0, ok: true });
    expect(written().map((r) => r.identifier)).toEqual([
      'doc:d1:30',
      'doc:d1:14',
      'doc:d1:3',
      'doc:d1:0',
    ]);
  });

  it('carries the route so a tap opens the record, not a list', async () => {
    await scheduleRemindersFor({ ...base, documents: [doc('d1', 'Insurance', '2026-10-16')] });
    for (const request of written()) {
      expect(request.content.data.route).toBe('/records/document?id=d1');
    }
  });

  it('posts to the maintenance-and-documents channel, which Android needs by name', async () => {
    await scheduleRemindersFor({ ...base, documents: [doc('d1', 'Insurance', '2026-10-16')] });
    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_CHANNEL_ID,
      expect.objectContaining({ name: REMINDER_CHANNEL_NAME }),
    );
    for (const request of written()) expect(request.trigger.channelId).toBe(REMINDER_CHANNEL_ID);
  });

  it('uses a date trigger, so it fires with no connection', async () => {
    await scheduleRemindersFor({ ...base, documents: [doc('d1', 'Insurance', '2026-10-16')] });
    for (const request of written()) expect(request.trigger.type).toBe('date');
  });
});

describe('cancel and rewrite, never diff', () => {
  it('clears the queue before writing anything', async () => {
    await scheduleRemindersFor({ ...base, documents: [doc('d1', 'Insurance', '2026-10-16')] });
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockCancelAllScheduledNotificationsAsync.mock.invocationCallOrder[0]!).toBeLessThan(
      mockScheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
  });

  it('clears the queue even when nothing is left to schedule, so a delete really deletes', async () => {
    const outcome = await scheduleRemindersFor({ ...base, documents: [] });
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(outcome).toEqual({ scheduled: 0, skipped: 0, ok: true });
  });

  it('empties the queue when the rider turns both switches off', async () => {
    const outcome = await scheduleRemindersFor({
      ...base,
      documents: [doc('d1', 'Insurance', '2026-10-16')],
      maintenanceEnabled: false,
      documentExpiryEnabled: false,
    });
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(outcome.scheduled).toBe(0);
  });

  it('caps the queue rather than flooding the alarm manager, keeping the soonest', async () => {
    const documents = Array.from({ length: 40 }, (_, i) =>
      doc(`d${i}`, `Doc ${i}`, '2026-10-16'),
    );
    const outcome = await scheduleRemindersFor({ ...base, documents });

    expect(outcome.scheduled).toBe(MAX_SCHEDULED);
    expect(outcome.skipped).toBe(160 - MAX_SCHEDULED);
    // Soonest first: all forty 30-day marks fall today, so they are kept whole,
    // and the cut lands inside the 14-day marks a fortnight out.
    const ids = written().map((r) => r.identifier);
    expect(ids.slice(0, 40).every((id) => id.endsWith(':30'))).toBe(true);
    expect(ids.slice(40).every((id) => id.endsWith(':14'))).toBe(true);
  });
});

describe('it never throws into a screen', () => {
  it('reports failure instead of rejecting when the queue cannot be cleared', async () => {
    mockCancelAllScheduledNotificationsAsync.mockRejectedValue(new Error('no notification service'));
    const outcome = await scheduleRemindersFor({
      ...base,
      documents: [doc('d1', 'Insurance', '2026-10-16')],
    });
    expect(outcome).toEqual({ scheduled: 0, skipped: 4, ok: false });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('loses one bad reminder, not the rest of them', async () => {
    mockScheduleNotificationAsync.mockImplementation((request) =>
      (request as { identifier: string }).identifier === 'doc:d1:14'
        ? Promise.reject(new Error('alarm limit'))
        : Promise.resolve('ok'),
    );
    const outcome = await scheduleRemindersFor({
      ...base,
      documents: [doc('d1', 'Insurance', '2026-10-16')],
    });
    expect(outcome.scheduled).toBe(3);
    expect(outcome.ok).toBe(true);
  });

  it('swallows a cancel that fails on sign-out', async () => {
    mockCancelAllScheduledNotificationsAsync.mockRejectedValue(new Error('gone'));
    await expect(cancelAll()).resolves.toBeUndefined();
  });
});

describe('a declined permission is quiet, not broken', () => {
  it('schedules nothing but still clears whatever was queued', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    const outcome = await scheduleRemindersFor({
      ...base,
      documents: [doc('d1', 'Insurance', '2026-10-16')],
    });
    expect(outcome).toEqual({ scheduled: 0, skipped: 4, ok: true });
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not re-prompt a rider who already granted it', async () => {
    await requestPermission();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prompts once when it has not been granted yet', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: false });
    await expect(requestPermission()).resolves.toEqual({ granted: true, canAskAgain: false });
  });

  it('reports a refusal rather than rejecting when the module is missing entirely', async () => {
    mockGetPermissionsAsync.mockRejectedValue(new Error('no native module'));
    await expect(requestPermission()).resolves.toEqual({ granted: false, canAskAgain: false });
  });
});

describe('the hour a reminder arrives', () => {
  const reminder = {
    id: 'doc:d1:3',
    fireOn: '2026-10-13' as const,
    title: 'Insurance expires in 3 days',
    body: 'Valid until 16 Oct 2026.',
    route: '/records/document?id=d1',
  };

  it('is nine in the morning, local — built from the calendar date, never UTC', () => {
    const at = fireInstant(reminder, new Date(2026, 8, 16, 8, 0, 0));
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(9); // October
    expect(at.getDate()).toBe(13);
    expect(at.getHours()).toBe(9);
    expect(at.getMinutes()).toBe(0);
  });

  it('rolls to tomorrow rather than firing the instant the app is opened', () => {
    // Opened at 11:00 on the day the reminder was for: firing now would mean a
    // notification on every single app open, because every open reschedules.
    const today = { ...reminder, fireOn: TODAY as typeof reminder.fireOn };
    const at = fireInstant(today, new Date(2026, 8, 16, 11, 0, 0));
    expect(at.getDate()).toBe(17);
    expect(at.getHours()).toBe(9);
  });

  it('still fires this morning when the app is opened before nine', () => {
    const today = { ...reminder, fireOn: TODAY as typeof reminder.fireOn };
    const at = fireInstant(today, new Date(2026, 8, 16, 6, 30, 0));
    expect(at.getDate()).toBe(16);
    expect(at.getHours()).toBe(9);
  });
});

describe('distance-only rules are never scheduled', () => {
  it('writes nothing for a rule that is overdue on kilometres alone', async () => {
    const outcome = await scheduleRemindersFor({
      ...base,
      rules: [
        {
          rule: { id: 'r1', name: 'Engine oil & filter', warnAheadDays: 14 },
          status: status({ kind: 'overdue', remainingMetres: -310_000, dueOnDate: null }),
        },
      ],
    });
    expect(outcome.scheduled).toBe(0);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

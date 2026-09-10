import type { DocumentData } from '@react-native-firebase/firestore';

import type {
  Accessory,
  AppNotification,
  CaptureItem,
  CurrencyCode,
  Expense,
  FuelAdjustment,
  FuelEntry,
  MaintenanceRule,
  OdometerReading,
  OwnedRecord,
  Part,
  SafetyCheck,
  ServiceRecord,
  VaultDocument,
  Warranty,
} from '@/types';
import type { SubscribeFn } from '@/services/liveQuery';
import {
  deleteRecord,
  deleteWhereBike,
  listCollection,
  newId,
  patchRecord,
  refreshFromServer,
  subscribeCollection,
  writeRecord,
  type CollectionName,
  type ListOptions,
  type Parser,
} from './base';
import {
  makeAccessoryParser,
  makeExpenseParser,
  makeFuelParser,
  makePartParser,
  makeServiceParser,
  parseAppNotification,
  parseCaptureItem,
  parseFuelAdjustment,
  parseMaintenanceRule,
  parseOdometerReading,
  parseSafetyCheck,
  parseVaultDocument,
  parseWarranty,
} from './parsers';
import {
  serialiseAccessory,
  serialiseExpense,
  serialiseFuelAdjustment,
  serialiseFuelEntry,
  serialiseMaintenanceRule,
  serialiseOdometerReading,
  serialisePart,
  serialiseSafetyCheck,
  serialiseService,
  serialiseVaultDocument,
  serialiseWarranty,
} from './serialisers';
import { compact, metresToKm } from './wire';

/**
 * One typed repository per collection in the shared database.
 *
 * Every read is scoped by `userId` and `bikeId`, and every write goes through
 * the serialisers so the document that lands is the one the web product expects.
 * Ids are generated locally, which is what makes a save idempotent: retrying
 * (or double-tapping) writes the same document rather than a second one.
 *
 * Money can only be read once the currency is known, so the parsers that touch
 * money are built per-call from the bike's currency.
 */

export const PAGE_SIZE = 50;
export const SUMMARY_LIMIT = 400;

export type RecordRepository<T extends OwnedRecord> = {
  name: CollectionName;
  newId: () => string;
  subscribe: (
    uid: string,
    bikeId: string,
    currency: CurrencyCode,
    options?: ListOptions,
  ) => SubscribeFn<T[]>;
  list: (uid: string, bikeId: string, currency: CurrencyCode, options?: ListOptions) => Promise<T[]>;
  refresh: (uid: string, bikeId: string, options?: ListOptions) => Promise<void>;
  save: (uid: string, record: T, isNew: boolean) => Promise<void>;
  patch: (uid: string, id: string, changes: DocumentData) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
  removeAllForBike: (uid: string, bikeId: string) => Promise<number>;
  removeAllForUser: (uid: string) => Promise<number>;
};

function makeRepository<T extends OwnedRecord>(
  name: CollectionName,
  parseFor: (currency: CurrencyCode) => Parser<T>,
  serialise: (record: T) => DocumentData,
  defaults: ListOptions,
): RecordRepository<T> {
  return {
    name,
    newId: () => newId(name),
    subscribe: (uid, bikeId, currency, options) =>
      subscribeCollection<T>({
        uid,
        name,
        bikeId,
        parse: parseFor(currency),
        options: { ...defaults, ...options },
      }),
    list: (uid, bikeId, currency, options) =>
      listCollection<T>({
        uid,
        name,
        bikeId,
        parse: parseFor(currency),
        options: { ...defaults, ...options },
      }),
    refresh: (uid, bikeId, options) =>
      refreshFromServer({ uid, name, bikeId, options: { ...defaults, ...options } }),
    save: (uid, record, isNew) =>
      writeRecord({ uid, name, id: record.id, data: serialise(record), isNew }),
    patch: (_uid, id, changes) => patchRecord({ name, id, changes }),
    remove: (_uid, id) => deleteRecord({ name, id }),
    removeAllForBike: (uid, bikeId) => deleteWhereBike({ uid, name, bikeId }),
    removeAllForUser: (uid) => deleteWhereBike({ uid, name, bikeId: null }),
  };
}

/** Parsers that need no currency still take one, so the factory stays uniform. */
const ignoreCurrency =
  <T>(parse: Parser<T>) =>
  (_currency: CurrencyCode): Parser<T> =>
    parse;

const byDateDesc: ListOptions = { orderByField: 'date', direction: 'desc', limit: SUMMARY_LIMIT };

export const fuelRepository = makeRepository<FuelEntry>(
  'fuelEntries',
  makeFuelParser,
  serialiseFuelEntry,
  byDateDesc,
);

export const fuelAdjustmentRepository = makeRepository<FuelAdjustment>(
  'fuelAdjustments',
  ignoreCurrency(parseFuelAdjustment),
  serialiseFuelAdjustment,
  byDateDesc,
);

export const odometerRepository = {
  ...makeRepository<OdometerReading>(
    'odometerEntries',
    ignoreCurrency(parseOdometerReading),
    serialiseOdometerReading,
    { orderByField: 'odometer', direction: 'desc', limit: SUMMARY_LIMIT },
  ),

  /**
   * Corrects a reading in place, keeping the rest of the row as it is.
   *
   * The stored field is kilometres and the domain is metres; that conversion
   * belongs here, not in a mutation hook.
   */
  correct(_uid: string, id: string, metres: number): Promise<void> {
    return patchRecord({ name: 'odometerEntries', id, changes: { odometer: metresToKm(metres) } });
  },
};

export const maintenanceRuleRepository = makeRepository<MaintenanceRule>(
  'maintenanceRules',
  ignoreCurrency(parseMaintenanceRule),
  serialiseMaintenanceRule,
  { orderByField: 'name', direction: 'asc', limit: 100 },
);

export const serviceRepository = makeRepository<ServiceRecord>(
  'services',
  makeServiceParser,
  serialiseService,
  byDateDesc,
);

export const partRepository = makeRepository<Part>('parts', makePartParser, serialisePart, {
  orderByField: 'installedDate',
  direction: 'desc',
  limit: SUMMARY_LIMIT,
});

export const accessoryRepository = makeRepository<Accessory>(
  'accessories',
  makeAccessoryParser,
  serialiseAccessory,
  byDateDesc,
);

export const expenseRepository = makeRepository<Expense>(
  'expenses',
  makeExpenseParser,
  (expense) => serialiseExpense(expense, 'Expense'),
  byDateDesc,
);

export const documentRepository = makeRepository<VaultDocument>(
  'documents',
  ignoreCurrency(parseVaultDocument),
  serialiseVaultDocument,
  { orderByField: 'title', direction: 'asc', limit: 200 },
);

export const warrantyRepository = makeRepository<Warranty>(
  'warranties',
  ignoreCurrency(parseWarranty),
  serialiseWarranty,
  { orderByField: 'title', direction: 'asc', limit: 200 },
);

export const safetyRepository = makeRepository<SafetyCheck>(
  'safetyChecks',
  ignoreCurrency(parseSafetyCheck),
  serialiseSafetyCheck,
  byDateDesc,
);

export const captureRepository = makeRepository<CaptureItem>(
  'captures',
  ignoreCurrency(parseCaptureItem),
  (item) =>
    compact({
      bikeId: item.bikeId,
      kind: item.kind,
      status: item.status,
      label: item.label,
      detail: item.detail,
      photoPath: item.photoPath,
      completedRecordId: item.completedRecordId,
      completedRecordType: item.completedRecordType,
    }),
  { orderByField: 'createdAt', direction: 'desc', limit: 100 },
);

/** Server-pushed notifications live in the shared `reminders` collection. */
export const notificationRepository = makeRepository<AppNotification>(
  'reminders',
  ignoreCurrency(parseAppNotification),
  (note) =>
    compact({
      bikeId: note.bikeId,
      title: note.title,
      body: note.body,
      dueAt: note.date,
      kind: note.kind,
      readAt: note.readAt,
      href: note.href,
    }),
  { orderByField: 'dueAt', direction: 'desc', limit: 100 },
);

/** Every per-bike repository, for cascade deletes. */
export const perBikeRepositories = [
  fuelRepository,
  fuelAdjustmentRepository,
  odometerRepository,
  maintenanceRuleRepository,
  serviceRepository,
  partRepository,
  accessoryRepository,
  expenseRepository,
  documentRepository,
  warrantyRepository,
  safetyRepository,
  captureRepository,
  notificationRepository,
] as const;

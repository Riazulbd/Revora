import { CURRENCY_CODES } from '@/calculations/currencies';
import type { DocumentData } from '@react-native-firebase/firestore';

import type {
  Accessory,
  AppNotification,
  Bike,
  CaptureItem,
  CurrencyCode,
  DistanceUnit,
  Expense,
  ExpenseCategory,
  FuelAdjustment,
  FuelEntry,
  MaintenanceRule,
  MileageUnit,
  OdometerReading,
  Part,
  SafetyCheck,
  ServiceRecord,
  UserProfile,
  VaultDocument,
  VolumeUnit,
  Warranty,
} from '@/types';
import { todayIso } from '@/utils/date';
import {
  readBoolean,
  readEnum,
  readMillis,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
  readStringArray,
} from './base';
import { kmToMetres, litresToMl, majorToMinor, readIsoDate, readNullableIsoDate } from './wire';

/**
 * Document → domain parsers, reading the shared schema the web product writes.
 *
 * Deliberately forgiving: a field written by an older app version, or one this
 * app has never heard of, must degrade to a sensible default rather than throw
 * inside a list render.
 *
 * Unit conversion happens here and nowhere else — kilometres become metres,
 * litres become millilitres, major currency becomes minor units.
 */

/** Every code the currency table knows; an unknown one falls back to BDT. */
const CURRENCIES: readonly CurrencyCode[] = CURRENCY_CODES;
const DISTANCE_UNITS: readonly DistanceUnit[] = ['km', 'mi'];
const VOLUME_UNITS: readonly VolumeUnit[] = ['L', 'gal_us', 'gal_uk'];
const MILEAGE_UNITS: readonly MileageUnit[] = ['km_per_l', 'l_per_100km', 'mpg_us', 'mpg_uk'];

/** Every record shares the owner, the bike and the two timestamps. */
function base(id: string, data: DocumentData) {
  const now = Date.now();
  return {
    id,
    userId: readString(data, 'userId'),
    bikeId: readString(data, 'bikeId'),
    createdAt: readMillis(data, 'createdAt', now),
    updatedAt: readMillis(data, 'updatedAt', now),
  };
}

function money(data: DocumentData, key: string, currency: CurrencyCode, fallback = 0): number {
  const v = readNullableNumber(data, key);
  return v === null ? fallback : majorToMinor(v, currency);
}

function nullableMoney(data: DocumentData, key: string, currency: CurrencyCode): number | null {
  const v = readNullableNumber(data, key);
  return v === null ? null : majorToMinor(v, currency);
}

function distance(data: DocumentData, key: string, fallback = 0): number {
  const v = readNullableNumber(data, key);
  return v === null ? fallback : kmToMetres(v);
}

function nullableDistance(data: DocumentData, key: string): number | null {
  const v = readNullableNumber(data, key);
  return v === null ? null : kmToMetres(v);
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/**
 * `users/{uid}` holds the profile and preferences. The entitlement lives in its
 * own server-written document and is merged in by the repository — the app can
 * read the tier but has no write path to it.
 */
export const parseUserProfile = (id: string, data: DocumentData): UserProfile => {
  const units = (typeof data.units === 'object' && data.units !== null ? data.units : {}) as DocumentData;
  const notifications = (
    typeof data.notifications === 'object' && data.notifications !== null ? data.notifications : {}
  ) as DocumentData;
  const now = Date.now();

  return {
    id,
    userId: id,
    createdAt: readMillis(data, 'createdAt', now),
    updatedAt: readMillis(data, 'updatedAt', now),
    displayName: readString(data, 'displayName', 'Rider'),
    email: readNullableString(data, 'email'),
    photoPath: readNullableString(data, 'photoPath') ?? readNullableString(data, 'photoUrl'),
    units: {
      // The shared schema keeps the currency at the top level, where the web
      // product's rules require it; the presentation units sit beside it.
      currency: readEnum(data, 'currency', CURRENCIES, readEnum(units, 'currency', CURRENCIES, 'BDT')),
      distance: readEnum(units, 'distance', DISTANCE_UNITS, 'km'),
      volume: readEnum(units, 'volume', VOLUME_UNITS, 'L'),
      mileage: readEnum(units, 'mileage', MILEAGE_UNITS, 'km_per_l'),
      costBasis: readEnum(units, 'costBasis', ['running', 'total'] as const, 'running'),
    },
    activeBikeId: readNullableString(data, 'activeBikeId'),
    // Replaced by the entitlements document; Free until that says otherwise.
    entitlement: { tier: 'free', source: 'none', expiresAt: null, updatedAt: 0 },
    onboardingCompletedAt: readNullableNumber(data, 'onboardingCompletedAt'),
    notifications: {
      maintenanceDue: readBoolean(notifications, 'maintenanceDue', true),
      documentExpiry: readBoolean(notifications, 'documentExpiry', true),
      permissionRequestedAt: readNullableNumber(notifications, 'permissionRequestedAt'),
    },
  };
};

/** `entitlements/{uid}` — server-written, read-only to every client. */
export const parseEntitlement = (data: DocumentData): UserProfile['entitlement'] => ({
  tier: readEnum(data, 'tier', ['free', 'pro'] as const, 'free'),
  source: readEnum(
    data,
    'source',
    ['none', 'google_play', 'apple_iap', 'web', 'promo', 'grant'] as const,
    'none',
  ),
  expiresAt: readMillis(data, 'expiresAt', 0) || null,
  updatedAt: readMillis(data, 'updatedAt', 0),
  provider: readString(data, 'provider', readString(data, 'source', 'none')),
  productId: readNullableString(data, 'productId'),
  subscriptionStatus: readNullableString(data, 'subscriptionStatus'),
  basePlanId: readNullableString(data, 'basePlanId'),
  autoRenewing: readBoolean(data, 'autoRenewing', false),
  orderId: readNullableString(data, 'orderId'),
});

// ---------------------------------------------------------------------------
// Motorcycle
// ---------------------------------------------------------------------------

export const parseBike = (id: string, data: DocumentData): Bike => {
  const currency = readEnum(data, 'currency', CURRENCIES, 'BDT');
  const company = (typeof data.company === 'object' && data.company !== null ? data.company : {}) as DocumentData;
  const now = Date.now();

  return {
    id,
    userId: readString(data, 'userId'),
    createdAt: readMillis(data, 'createdAt', now),
    updatedAt: readMillis(data, 'updatedAt', now),
    manufacturer: readString(data, 'manufacturer'),
    model: readString(data, 'model'),
    nickname: readString(data, 'nickname', 'My motorcycle'),
    year: readNullableNumber(data, 'year'),
    tankCapacityMl: (() => {
      const litres = readNullableNumber(data, 'tankCapacityLiters');
      return litres === null ? null : litresToMl(litres);
    })(),
    purchasePriceMinor: nullableMoney(data, 'purchasePrice', currency),
    purchaseDate: readNullableIsoDate(data, 'purchaseDate'),
    engineNumber: readNullableString(data, 'engineNumber'),
    chassisNumber: readNullableString(data, 'chassisNumber'),
    photoPath: readNullableString(data, 'photoPath'),
    currency,
    initialOdometerMetres: distance(data, 'initialOdometer', 0),
    storedOdometerMetres: distance(data, 'currentOdometer', 0),
    company: {
      enabled: readBoolean(company, 'enabled', false),
      companyName: readString(company, 'companyName'),
      monthlyAllowanceMinor: money(company, 'monthlyAllowance', currency, 0),
    },
    archivedAt: readBoolean(data, 'archived', false) ? readMillis(data, 'updatedAt', now) : null,
  };
};

// ---------------------------------------------------------------------------
// Fuel
// ---------------------------------------------------------------------------

export const makeFuelParser =
  (currency: CurrencyCode) =>
  (id: string, data: DocumentData): FuelEntry => ({
    ...base(id, data),
    date: readIsoDate(data, 'date', todayIso()),
    odometerMetres: distance(data, 'odometer', 0),
    litresMl: litresToMl(readNumber(data, 'liters', 0)),
    pricePerLitreMinor: money(data, 'pricePerLiter', currency, 0),
    totalCostMinor: money(data, 'totalCost', currency, 0),
    currency,
    fillType: readEnum(data, 'tankStatus', ['full', 'partial', 'unknown'] as const, 'full'),
    missedPreviousFill: readBoolean(data, 'missedPreviousFill', false),
    station: readNullableString(data, 'stationName'),
    notes: readNullableString(data, 'notes'),
    receiptPath: readNullableString(data, 'receiptPath'),
    clientRef: readString(data, 'clientRef', id),
  });

export const parseFuelAdjustment = (id: string, data: DocumentData): FuelAdjustment => ({
  ...base(id, data),
  date: readIsoDate(data, 'date', todayIso()),
  // Signed on the wire and signed in the domain: negative left the tank.
  millilitres: litresToMl(readNumber(data, 'liters', 0)),
  reason: readEnum(
    data,
    'reason',
    ['maintenance_loss', 'leak', 'drained', 'theft', 'transferred', 'added_unlogged', 'other'] as const,
    'other',
  ),
  approximate: readBoolean(data, 'approximate', false),
  note: readNullableString(data, 'note'),
  clientRef: readString(data, 'clientRef', id),
});

export const parseOdometerReading = (id: string, data: DocumentData): OdometerReading => ({
  ...base(id, data),
  metres: distance(data, 'odometer', 0),
  date: readIsoDate(data, 'date', todayIso()),
  source: readEnum(data, 'source', ['manual', 'fuel', 'service', 'expense'] as const, 'manual'),
  sourceId: readNullableString(data, 'sourceId'),
  note: readNullableString(data, 'note'),
});

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export const parseMaintenanceRule = (id: string, data: DocumentData): MaintenanceRule => {
  const intervalType = readEnum(data, 'intervalType', ['distance', 'time', 'both'] as const, 'distance');
  return {
    ...base(id, data),
    name: readString(data, 'name', 'Maintenance'),
    intervalMetres: intervalType === 'time' ? null : nullableDistance(data, 'intervalKm'),
    intervalDays: intervalType === 'distance' ? null : readNullableNumber(data, 'intervalDays'),
    warnAheadMetres: distance(data, 'warnAheadKm', 200_000),
    warnAheadDays: readNumber(data, 'warnAheadDays', 7),
    enabled: readBoolean(data, 'enabled', true),
    lastCompletedMetres: nullableDistance(data, 'lastCompletedOdometer'),
    lastCompletedDate: readNullableIsoDate(data, 'lastCompletedDate'),
    notes: readNullableString(data, 'notes'),
  };
};

// ---------------------------------------------------------------------------
// Services, parts, accessories, expenses
// ---------------------------------------------------------------------------

export const makeServiceParser =
  (currency: CurrencyCode) =>
  (id: string, data: DocumentData): ServiceRecord => {
    const performedBy = readNullableString(data, 'performedBy');
    const estimate = (
      typeof data.estimate === 'object' && data.estimate !== null ? data.estimate : null
    ) as DocumentData | null;

    return {
      ...base(id, data),
      title: readString(data, 'title', 'Service'),
      workshop: performedBy,
      selfService: performedBy === null,
      date: readIsoDate(data, 'date', todayIso()),
      odometerMetres: nullableDistance(data, 'odometer'),
      labourCostMinor: money(data, 'laborCost', currency, 0),
      partsCostMinor: money(data, 'partsCost', currency, 0),
      totalCostMinor: money(data, 'totalCost', currency, 0),
      currency,
      notes: readNullableString(data, 'notes'),
      completedRuleIds: readStringArray(data, 'completedRuleIds'),
      itemsSummary: readNullableString(data, 'itemsSummary'),
      receiptPaths: readStringArray(data, 'receiptPaths'),
      estimate:
        estimate === null
          ? null
          : {
              quoteMinor: nullableMoney(estimate, 'quote', currency),
              odometerInMetres: nullableDistance(estimate, 'odometerIn'),
              odometerOutMetres: nullableDistance(estimate, 'odometerOut'),
              askBeforeReplacing: readBoolean(estimate, 'askBeforeReplacing', true),
              approvedWork: readStringArray(estimate, 'approvedWork'),
              declinedWork: readStringArray(estimate, 'declinedWork'),
            },
      clientRef: readString(data, 'clientRef', id),
    };
  };

export const makePartParser =
  (currency: CurrencyCode) =>
  (id: string, data: DocumentData): Part => ({
    ...base(id, data),
    name: readString(data, 'name', 'Part'),
    installedOdometerMetres: distance(data, 'installedOdometer', 0),
    installedDate: readIsoDate(data, 'installedDate', todayIso()),
    expectedLifeMetres: nullableDistance(data, 'expectedLifeKm'),
    costMinor: money(data, 'cost', currency, 0),
    currency,
    fittedBy: readNullableString(data, 'fittedBy'),
    linkedServiceId: readNullableString(data, 'serviceId'),
    removedDate: readNullableIsoDate(data, 'removedDate'),
    removedOdometerMetres: nullableDistance(data, 'removedOdometer'),
    notes: readNullableString(data, 'notes'),
    clientRef: readString(data, 'clientRef', id),
  });

export const makeAccessoryParser =
  (currency: CurrencyCode) =>
  (id: string, data: DocumentData): Accessory => ({
    ...base(id, data),
    name: readString(data, 'name', 'Accessory'),
    purchaseCostMinor: money(data, 'cost', currency, 0),
    installationCostMinor: money(data, 'installationCost', currency, 0),
    currency,
    date: readIsoDate(data, 'date', todayIso()),
    notes: readNullableString(data, 'notes'),
    photoPath: readNullableString(data, 'photoPath'),
    linkedServiceId: readNullableString(data, 'serviceId'),
    clientRef: readString(data, 'clientRef', id),
  });

/**
 * The shared `expenses` collection is wider than Revora's manual-expense
 * concept: the web product also files fuel, maintenance, parts and accessory
 * costs there. Those rows already have a record of their own in this app, so
 * they are parsed but marked `derived` and kept out of the ledger — counting
 * them would be the double-count this product refuses to make.
 */
export const makeExpenseParser =
  (currency: CurrencyCode) =>
  (id: string, data: DocumentData): Expense => {
    const category = readEnum(
      data,
      'category',
      [
        'fuel',
        'maintenance',
        'parts',
        'accessories',
        'insurance',
        'registration',
        'wash',
        'parking',
        'fine',
        'other',
      ] as const,
      'other',
    );

    return {
      ...base(id, data),
      amountMinor: money(data, 'amount', currency, 0),
      currency,
      category: toDomainCategory(category),
      /** True when another record in this app already carries this cost. */
      derived: category === 'fuel' || category === 'parts' || category === 'accessories',
      linkedRuleId: readNullableString(data, 'maintenanceRuleId'),
      date: readIsoDate(data, 'date', todayIso()),
      note: readNullableString(data, 'title') ?? readNullableString(data, 'notes'),
      clientRef: readString(data, 'clientRef', id),
    };
  };

const CATEGORY_FROM_WIRE: Record<string, ExpenseCategory> = {
  fuel: 'other',
  maintenance: 'other',
  parts: 'other',
  accessories: 'other',
  insurance: 'insurance',
  registration: 'registration',
  wash: 'wash',
  parking: 'parking',
  fine: 'fine',
  other: 'other',
};

function toDomainCategory(wire: string): ExpenseCategory {
  return CATEGORY_FROM_WIRE[wire] ?? 'other';
}

// ---------------------------------------------------------------------------
// Records the mobile design adds
// ---------------------------------------------------------------------------

export const parseVaultDocument = (id: string, data: DocumentData): VaultDocument => ({
  ...base(id, data),
  kind: readEnum(
    data,
    'kind',
    ['registration', 'insurance', 'tax_token', 'fitness', 'licence', 'custom'] as const,
    'custom',
  ),
  customKindLabel: readNullableString(data, 'customKindLabel'),
  title: readString(data, 'title', 'Document'),
  reference: readNullableString(data, 'reference'),
  expiresOn: readNullableIsoDate(data, 'expiresOn'),
  filePath: readNullableString(data, 'filePath'),
  keepOfflineCopy: readBoolean(data, 'keepOfflineCopy', false),
  notes: readNullableString(data, 'notes'),
  clientRef: readString(data, 'clientRef', id),
});

export const parseWarranty = (id: string, data: DocumentData): Warranty => ({
  ...base(id, data),
  title: readString(data, 'title', 'Warranty'),
  provider: readNullableString(data, 'provider'),
  purchasedFrom: readNullableString(data, 'purchasedFrom'),
  coverage: readNullableString(data, 'coverage'),
  validUntil: readNullableIsoDate(data, 'validUntil'),
  claimStatus: readEnum(data, 'claimStatus', ['none', 'open', 'settled', 'rejected'] as const, 'none'),
  evidencePaths: readStringArray(data, 'evidencePaths'),
  reminderDaysBefore: readNullableNumber(data, 'reminderDaysBefore'),
  clientRef: readString(data, 'clientRef', id),
});

export const parseSafetyCheck = (id: string, data: DocumentData): SafetyCheck => {
  const raw = data.measurements;
  let measurements: Record<string, number> | null = null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const entries = Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    );
    measurements = entries.length > 0 ? Object.fromEntries(entries) : null;
  }

  return {
    ...base(id, data),
    area: readEnum(data, 'area', ['tyres', 'chain', 'brakes', 'battery', 'lights'] as const, 'tyres'),
    date: readIsoDate(data, 'date', todayIso()),
    status: readEnum(data, 'status', ['ok', 'watch', 'action'] as const, 'ok'),
    summary: readString(data, 'summary', 'Condition check'),
    measurements,
    note: readNullableString(data, 'note'),
    photoPath: readNullableString(data, 'photoPath'),
    clientRef: readString(data, 'clientRef', id),
  };
};

export const parseCaptureItem = (id: string, data: DocumentData): CaptureItem => ({
  ...base(id, data),
  kind: readEnum(data, 'kind', ['fuel', 'receipt', 'odometer', 'note'] as const, 'note'),
  status: readEnum(data, 'status', ['queued', 'completed'] as const, 'queued'),
  label: readString(data, 'label', 'Capture'),
  detail: readNullableString(data, 'detail'),
  photoPath: readNullableString(data, 'photoPath'),
  completedRecordId: readNullableString(data, 'completedRecordId'),
  completedRecordType: readNullableString(data, 'completedRecordType') as CaptureItem['completedRecordType'],
});

/** The shared `reminders` collection backs server-pushed notifications. */
export const parseAppNotification = (id: string, data: DocumentData): AppNotification => ({
  ...base(id, data),
  kind: readEnum(data, 'kind', ['maintenance', 'document', 'sync', 'system'] as const, 'system'),
  title: readString(data, 'title', 'Revora'),
  body: readString(data, 'body'),
  date: readIsoDate(data, 'dueAt', todayIso()),
  readAt: readNullableNumber(data, 'readAt'),
  href: readNullableString(data, 'href'),
});

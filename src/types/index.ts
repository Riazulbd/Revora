/**
 * Revora domain model.
 *
 * Storage conventions — these exist so arithmetic is exact and timezone-safe:
 *
 *  · Money     → integer **minor units** (poisha for BDT, cents for USD …).
 *                Never a float. See src/calculations/money.ts.
 *  · Volume    → integer **millilitres**.
 *  · Distance  → integer **metres**.
 *  · Calendar  → `'YYYY-MM-DD'` local date strings, never a Date or UTC
 *                timestamp, so "1 September" can never render as "31 August".
 *  · Instants  → epoch milliseconds (createdAt / updatedAt only).
 *
 * Every record carries `userId` and (except the user profile) `bikeId`. Both are
 * re-checked server-side by firestore.rules — the client is never trusted.
 */

export type IsoDate = string; // 'YYYY-MM-DD'
export type Millis = number;

export type CurrencyCode = 'BDT' | 'INR' | 'USD' | 'EUR' | 'GBP' | 'PKR' | 'LKR' | 'NPR';
export type DistanceUnit = 'km' | 'mi';
export type VolumeUnit = 'L' | 'gal_us' | 'gal_uk';
export type MileageUnit = 'km_per_l' | 'l_per_100km' | 'mpg_us' | 'mpg_uk';

/** Fields every stored record shares. */
export type BaseRecord = {
  id: string;
  userId: string;
  createdAt: Millis;
  updatedAt: Millis;
};

export type OwnedRecord = BaseRecord & { bikeId: string };

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type UnitPreferences = {
  currency: CurrencyCode;
  distance: DistanceUnit;
  volume: VolumeUnit;
  mileage: MileageUnit;
};

export type PlanTier = 'free' | 'pro';

/**
 * Entitlement always comes from the backend document, never from local state,
 * and never from a payment SDK directly. Google Play / Apple / web billing all
 * write `source` + `expiresAt` here through a verified server callable.
 */
export type Entitlement = {
  tier: PlanTier;
  source: 'none' | 'google_play' | 'apple_iap' | 'web' | 'promo' | 'grant';
  /** Epoch ms; null means perpetual (grants) or not applicable. */
  expiresAt: Millis | null;
  updatedAt: Millis;
};

export type UserProfile = BaseRecord & {
  displayName: string;
  email: string | null;
  photoPath: string | null;
  units: UnitPreferences;
  activeBikeId: string | null;
  entitlement: Entitlement;
  onboardingCompletedAt: Millis | null;
  notifications: {
    maintenanceDue: boolean;
    documentExpiry: boolean;
    /** Set once the OS permission prompt has been answered, either way. */
    permissionRequestedAt: Millis | null;
  };
};

// ---------------------------------------------------------------------------
// Motorcycle
// ---------------------------------------------------------------------------

export type CompanyAllowance = {
  enabled: boolean;
  companyName: string;
  /** Minor units per calendar month. */
  monthlyAllowanceMinor: number;
};

export type Bike = OwnedRecordWithoutBike & {
  manufacturer: string;
  model: string;
  nickname: string;
  year: number | null;
  /** Millilitres. */
  tankCapacityMl: number | null;
  purchasePriceMinor: number | null;
  purchaseDate: IsoDate | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  photoPath: string | null;
  currency: CurrencyCode;
  /** The reading the garage started from, in metres. */
  initialOdometerMetres: number;
  /**
   * The odometer as the shared schema stores it, in metres.
   *
   * Revora *derives* the current odometer from the reading history so that
   * editing an old fuel log corrects it automatically. This field is what the
   * web product reads, so it is written back on every save and folded into the
   * derivation as one more candidate reading — the two can never disagree.
   */
  storedOdometerMetres: number;
  company: CompanyAllowance;
  archivedAt: Millis | null;
};

/** A bike is itself the owning entity, so it has no `bikeId`. */
type OwnedRecordWithoutBike = BaseRecord;

// ---------------------------------------------------------------------------
// Odometer
// ---------------------------------------------------------------------------

/** Matches the shared schema's `odometerEntries.source` enum exactly. */
export type OdometerSource = 'manual' | 'fuel' | 'service' | 'expense';

/**
 * The odometer is an append-only history. A bike's "current odometer" is always
 * derived as the maximum reading — it is never a mutable field on the bike, so
 * there is exactly one source of truth (requirement 63).
 */
export type OdometerReading = OwnedRecord & {
  /** Integer metres. */
  metres: number;
  date: IsoDate;
  source: OdometerSource;
  /** Id of the fuel/service/part record this reading came from, when derived. */
  sourceId: string | null;
  note: string | null;
};

// ---------------------------------------------------------------------------
// Fuel
// ---------------------------------------------------------------------------

export type FillType = 'full' | 'partial' | 'unknown';

/**
 * Reasons carried by the shared backend's `fuelAdjustments` collection.
 * `added_unlogged` is the only one that normally carries a positive volume.
 */
export type FuelAdjustmentReason =
  | 'maintenance_loss'
  | 'leak'
  | 'drained'
  | 'theft'
  | 'transferred'
  | 'added_unlogged'
  | 'other';

/**
 * Fuel that moved without covering distance.
 *
 * An adjustment is an event on the motorcycle's timeline, not a field on a fill:
 * a leak happens between fills, not at one. It is applied to whichever
 * full-to-full interval its date falls inside.
 *
 * `millilitres` is **signed**. Negative is fuel that left the tank without
 * propelling the bike; positive is fuel that went in without being logged as a
 * fill. Zero is meaningless and is rejected.
 *
 * The rider's original fill is never altered by one (requirement 16).
 */
export type FuelAdjustment = OwnedRecord & {
  date: IsoDate;
  /** Signed integer millilitres. Never zero. */
  millilitres: number;
  reason: FuelAdjustmentReason;
  /** True when the rider estimated the amount rather than measured it. */
  approximate: boolean;
  note: string | null;
  clientRef: string;
};

export type FuelEntry = OwnedRecord & {
  date: IsoDate;
  /** Integer metres, as read at the pump. */
  odometerMetres: number;
  /** Raw litres purchased, in millilitres. Never mutated by adjustments. */
  litresMl: number;
  /** Minor units per litre. */
  pricePerLitreMinor: number;
  /** Minor units. Always equals round(litresMl * pricePerLitreMinor / 1000). */
  totalCostMinor: number;
  currency: CurrencyCode;
  fillType: FillType;
  /**
   * True when the rider knows a fill went unlogged before this one. The interval
   * that ends here cannot be trusted and is excluded from mileage.
   */
  missedPreviousFill: boolean;
  station: string | null;
  notes: string | null;
  receiptPath: string | null;
  /** Client-generated, stable across retries — makes saving idempotent. */
  clientRef: string;
};

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export type MaintenanceStatusKind = 'overdue' | 'due_soon' | 'upcoming' | 'good' | 'unknown';

export type MaintenanceRule = OwnedRecord & {
  name: string;
  /** Integer metres between completions; null when the rule is time-only. */
  intervalMetres: number | null;
  /** Days between completions; null when the rule is distance-only. */
  intervalDays: number | null;
  /** Integer metres of warning before the due point. */
  warnAheadMetres: number;
  /** Days of warning before a time-based due date. */
  warnAheadDays: number;
  enabled: boolean;
  lastCompletedMetres: number | null;
  lastCompletedDate: IsoDate | null;
  notes: string | null;
};

export type MaintenanceCompletion = OwnedRecord & {
  ruleId: string;
  date: IsoDate;
  odometerMetres: number;
  costMinor: number | null;
  currency: CurrencyCode;
  workshop: string | null;
  notes: string | null;
  /**
   * Set when the completion was recorded as part of a service. The cost then
   * belongs to the service record and is NOT counted again in the ledger.
   */
  serviceId: string | null;
};

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/**
 * Estimate guard — the quote a workshop gave against the invoice they charged,
 * plus the work the rider approved and declined. Optional throughout: a
 * self-service oil change has none of it.
 */
export type WorkshopEstimate = {
  quoteMinor: number | null;
  odometerInMetres: number | null;
  odometerOutMetres: number | null;
  /** The workshop must confirm extra work before doing it. */
  askBeforeReplacing: boolean;
  approvedWork: string[];
  declinedWork: string[];
};

export type ServiceRecord = OwnedRecord & {
  title: string;
  workshop: string | null;
  selfService: boolean;
  date: IsoDate;
  odometerMetres: number | null;
  labourCostMinor: number;
  partsCostMinor: number;
  totalCostMinor: number;
  currency: CurrencyCode;
  notes: string | null;
  /** Maintenance rules reset by this service. */
  completedRuleIds: string[];
  itemsSummary: string | null;
  receiptPaths: string[];
  estimate: WorkshopEstimate | null;
  clientRef: string;
};

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export type Part = OwnedRecord & {
  name: string;
  installedOdometerMetres: number;
  installedDate: IsoDate;
  /** Integer metres the part is expected to last; null when unknown. */
  expectedLifeMetres: number | null;
  costMinor: number;
  currency: CurrencyCode;
  fittedBy: string | null;
  /**
   * When set, the cost lives on the service record and must not be counted
   * again in the ledger (requirement 28).
   */
  linkedServiceId: string | null;
  removedDate: IsoDate | null;
  removedOdometerMetres: number | null;
  notes: string | null;
  clientRef: string;
};

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------

export type Accessory = OwnedRecord & {
  name: string;
  purchaseCostMinor: number;
  installationCostMinor: number;
  currency: CurrencyCode;
  date: IsoDate;
  notes: string | null;
  photoPath: string | null;
  linkedServiceId: string | null;
  clientRef: string;
};

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export type ExpenseCategory =
  | 'registration'
  | 'insurance'
  | 'parking'
  | 'toll'
  | 'wash'
  | 'fine'
  | 'gear'
  | 'modification'
  | 'other';

/**
 * A cost from the shared `expenses` collection.
 *
 * The web product also files fuel, parts and accessory costs here, and those
 * already have a record of their own in this app. Such a row is marked
 * `derived` and kept out of the ledger — counting it would be exactly the
 * double-count this product refuses to make (requirement 28).
 */
export type Expense = OwnedRecord & {
  amountMinor: number;
  currency: CurrencyCode;
  category: ExpenseCategory;
  /** True when another record in this app already carries this cost. */
  derived: boolean;
  /** Set when the expense records a standalone maintenance completion. */
  linkedRuleId: string | null;
  date: IsoDate;
  note: string | null;
  clientRef: string;
};

/** Where a ledger line came from. Exactly one line per underlying record. */
export type LedgerSource = 'fuel' | 'service' | 'part' | 'accessory' | 'maintenance' | 'manual';

export type LedgerEntry = {
  id: string;
  sourceId: string;
  source: LedgerSource;
  label: string;
  date: IsoDate;
  amountMinor: number;
  currency: CurrencyCode;
};

// ---------------------------------------------------------------------------
// Records: documents, warranties, safety
// ---------------------------------------------------------------------------

export type DocumentKind = 'registration' | 'insurance' | 'tax_token' | 'fitness' | 'licence' | 'custom';

export type VaultDocument = OwnedRecord & {
  kind: DocumentKind;
  customKindLabel: string | null;
  title: string;
  reference: string | null;
  expiresOn: IsoDate | null;
  filePath: string | null;
  keepOfflineCopy: boolean;
  notes: string | null;
  clientRef: string;
};

export type Warranty = OwnedRecord & {
  title: string;
  provider: string | null;
  purchasedFrom: string | null;
  coverage: string | null;
  validUntil: IsoDate | null;
  claimStatus: 'none' | 'open' | 'settled' | 'rejected';
  evidencePaths: string[];
  reminderDaysBefore: number | null;
  clientRef: string;
};

export type SafetyArea = 'tyres' | 'chain' | 'brakes' | 'battery' | 'lights';
export type SafetyStatus = 'ok' | 'watch' | 'action';

export type SafetyCheck = OwnedRecord & {
  area: SafetyArea;
  date: IsoDate;
  status: SafetyStatus;
  summary: string;
  measurements: Record<string, number> | null;
  note: string | null;
  photoPath: string | null;
  clientRef: string;
};

// ---------------------------------------------------------------------------
// Fast Capture queue
// ---------------------------------------------------------------------------

export type CaptureKind = 'fuel' | 'receipt' | 'odometer' | 'note';
export type CaptureStatus = 'queued' | 'completed';

export type CaptureItem = OwnedRecord & {
  kind: CaptureKind;
  status: CaptureStatus;
  label: string;
  detail: string | null;
  photoPath: string | null;
  /** Set once the capture has been turned into a real record. */
  completedRecordId: string | null;
  completedRecordType: LedgerSource | 'odometer' | null;
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type AppNotificationKind = 'maintenance' | 'document' | 'sync' | 'system';

export type AppNotification = OwnedRecord & {
  kind: AppNotificationKind;
  title: string;
  body: string;
  /** 'YYYY-MM-DD' the notification refers to. */
  date: IsoDate;
  readAt: Millis | null;
  /** Router href the row opens, when it has a destination. */
  href: string | null;
};

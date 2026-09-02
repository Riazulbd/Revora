import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromServer,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryConstraint,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

import { db } from '@/services/firebase';
import { toAppError } from '@/services/errors';
import type { SubscribeFn } from '@/services/liveQuery';

/**
 * The Firestore boundary.
 *
 * Revora shares one database with the Revora web product, and the web product's
 * schema is the canonical one: **flat, top-level collections**, every document
 * carrying the `userId` of its owner and (except a bike) the `bikeId` it belongs
 * to. The deployed ruleset checks both on every read and write, and denies
 * anything it does not explicitly name.
 *
 *     bikes/{id}            fuelEntries/{id}       fuelAdjustments/{id}
 *     odometerEntries/{id}  maintenanceRules/{id}  services/{id}
 *     serviceItems/{id}     parts/{id}             accessories/{id}
 *     expenses/{id}         reminders/{id}         users/{uid}
 *
 * Screens never import this file. They go through a feature repository, which is
 * the only layer that knows Firestore exists — and the only layer that knows the
 * wire format differs from the domain model.
 */

export type CollectionName =
  | 'bikes'
  | 'fuelEntries'
  | 'fuelAdjustments'
  | 'odometerEntries'
  | 'maintenanceRules'
  | 'services'
  | 'serviceItems'
  | 'parts'
  | 'accessories'
  | 'expenses'
  | 'reminders'
  | 'documents'
  | 'warranties'
  | 'safetyChecks'
  | 'captures';

export function userDoc(uid: string) {
  return doc(db(), 'users', uid);
}

export function entitlementDoc(uid: string) {
  return doc(db(), 'entitlements', uid);
}

export function topCollection(name: CollectionName) {
  return collection(db(), name);
}

export function recordDoc(name: CollectionName, id: string) {
  return doc(db(), name, id);
}

/** A freshly minted document id, available offline. */
export function newId(name: CollectionName): string {
  return doc(topCollection(name)).id;
}

type Snapshot = QuerySnapshot<DocumentData>;
type DocSnapshot = DocumentSnapshot<DocumentData>;

/**
 * Turns a stored document into a domain record.
 *
 * Documents are read defensively: the web product writes these same collections,
 * and it may carry fields this app has never heard of. `parse` fills gaps with
 * sane defaults and returns null for a document it cannot make sense of, so one
 * odd row can never crash a list.
 */
export type Parser<T> = (id: string, data: DocumentData) => T | null;

function mapSnapshot<T>(snapshot: Snapshot, parse: Parser<T>): T[] {
  const out: T[] = [];
  snapshot.forEach((docSnap: DocumentSnapshot<DocumentData>) => {
    const data = docSnap.data();
    if (!data) return;
    const parsed = parse(docSnap.id, data);
    if (parsed !== null) out.push(parsed);
  });
  return out;
}

export type ListOptions = {
  orderByField?: string;
  direction?: 'asc' | 'desc';
  /** Hard cap on rows — screens always pass one (mistake 22). */
  limit?: number;
};

/**
 * Every query is scoped by `userId` *and* `bikeId`.
 *
 * The `userId` filter is not a security control — the ruleset is — but it is
 * required: a query that could match another rider's document is rejected
 * wholesale by Firestore rather than filtered, so the filter has to be there for
 * the read to succeed at all.
 */
function buildQuery(uid: string, name: CollectionName, bikeId: string | null, options: ListOptions) {
  const constraints: QueryConstraint[] = [where('userId', '==', uid)];
  if (bikeId !== null) constraints.push(where('bikeId', '==', bikeId));
  if (options.orderByField) constraints.push(orderBy(options.orderByField, options.direction ?? 'desc'));
  if (options.limit !== undefined) constraints.push(limitTo(options.limit));
  return query(topCollection(name), ...constraints);
}

export function subscribeCollection<T>(input: {
  uid: string;
  name: CollectionName;
  bikeId: string | null;
  parse: Parser<T>;
  options?: ListOptions;
}): SubscribeFn<T[]> {
  return (onData, onError) => {
    const q = buildQuery(input.uid, input.name, input.bikeId, input.options ?? {});
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot) return;
        onData(mapSnapshot(snapshot, input.parse));
      },
      (error) => onError(toAppError(error)),
    );
  };
}

export function subscribeDoc<T>(input: {
  ref: DocumentReference<DocumentData>;
  parse: Parser<T>;
}): SubscribeFn<T | null> {
  return (onData, onError) =>
    onSnapshot(
      input.ref,
      { includeMetadataChanges: true },
      (snapshot: DocSnapshot | null) => {
        if (!snapshot) return;
        const data = snapshot.data();
        onData(data ? input.parse(snapshot.id, data) : null);
      },
      (error) => onError(toAppError(error)),
    );
}

export async function listCollection<T>(input: {
  uid: string;
  name: CollectionName;
  bikeId: string | null;
  parse: Parser<T>;
  options?: ListOptions;
}): Promise<T[]> {
  try {
    const snapshot = await getDocs(buildQuery(input.uid, input.name, input.bikeId, input.options ?? {}));
    return mapSnapshot(snapshot, input.parse);
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Forces a read from the server, bypassing the local cache — what
 * pull-to-refresh actually does (requirement 53). Offline it rejects rather than
 * serving stale data, and the caller reports that instead of spinning forever.
 */
export async function refreshFromServer(input: {
  uid: string;
  name: CollectionName;
  bikeId: string | null;
  options?: ListOptions;
}): Promise<void> {
  try {
    await getDocsFromServer(buildQuery(input.uid, input.name, input.bikeId, input.options ?? {}));
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Writes a document, always merging.
 *
 * Merging matters for two reasons the shared database makes unavoidable:
 *
 *  · the web product may hold fields this app has never heard of, and a full
 *    replace would silently delete them;
 *  · the ruleset freezes `userId` and `createdAt` after creation, so an update
 *    must simply not send them — the merged document keeps the stored values and
 *    the immutability check passes whatever type the web wrote them as.
 *
 * A field the rider cleared is sent as an explicit `null`, which merge does
 * store, so clearing a note really clears it.
 */
export async function writeRecord(input: {
  name: CollectionName;
  id: string;
  data: DocumentData;
  /** True the first time this record is written. */
  isNew: boolean;
  uid: string;
}): Promise<void> {
  const now = Timestamp.fromMillis(Date.now());
  const payload: DocumentData = { ...input.data, updatedAt: now };

  if (input.isNew) {
    payload.userId = input.uid;
    payload.createdAt = now;
  } else {
    delete payload.userId;
    delete payload.createdAt;
  }

  try {
    await setDoc(recordDoc(input.name, input.id), payload, { merge: true });
  } catch (error) {
    throw toAppError(error);
  }
}

/** A partial update. Never touches the immutable fields. */
export async function patchRecord(input: {
  name: CollectionName;
  id: string;
  changes: DocumentData;
}): Promise<void> {
  const { userId: _u, createdAt: _c, ...changes } = input.changes;
  try {
    await setDoc(
      recordDoc(input.name, input.id),
      { ...changes, updatedAt: Timestamp.fromMillis(Date.now()) },
      { merge: true },
    );
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteRecord(input: { name: CollectionName; id: string }): Promise<void> {
  try {
    await deleteDoc(recordDoc(input.name, input.id));
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Deletes every record in a collection belonging to one bike, in batches.
 * Used when a motorcycle is removed and when an account is deleted.
 */
export async function deleteWhereBike(input: {
  uid: string;
  name: CollectionName;
  bikeId: string | null;
}): Promise<number> {
  let removed = 0;
  // Firestore caps a batch at 500 writes.
  for (;;) {
    const snapshot = await getDocs(buildQuery(input.uid, input.name, input.bikeId, { limit: 400 }));
    if (snapshot.empty) break;
    const batch = writeBatch(db());
    snapshot.forEach((docSnap: DocumentSnapshot<DocumentData>) => batch.delete(docSnap.ref));
    await batch.commit();
    removed += snapshot.size;
    if (snapshot.size < 400) break;
  }
  return removed;
}

// --- defensive field readers ------------------------------------------------

export function readString(data: DocumentData, key: string, fallback = ''): string {
  const v = data[key];
  return typeof v === 'string' ? v : fallback;
}

export function readNullableString(data: DocumentData, key: string): string | null {
  const v = data[key];
  return typeof v === 'string' && v !== '' ? v : null;
}

export function readNumber(data: DocumentData, key: string, fallback = 0): number {
  const v = data[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function readNullableNumber(data: DocumentData, key: string): number | null {
  const v = data[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function readBoolean(data: DocumentData, key: string, fallback = false): boolean {
  const v = data[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function readStringArray(data: DocumentData, key: string): string[] {
  const v = data[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function readEnum<T extends string>(
  data: DocumentData,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = data[key];
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * `createdAt` / `updatedAt` reach us as a Firestore `Timestamp` from the web, or
 * as a number from an older client. Both become epoch milliseconds.
 */
export function readMillis(data: DocumentData, key: string, fallback: number): number {
  const v = data[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && typeof (v as Timestamp).toMillis === 'function') {
    return (v as Timestamp).toMillis();
  }
  return fallback;
}

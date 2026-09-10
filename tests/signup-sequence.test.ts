import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where, Timestamp } from 'firebase/firestore';

import type { Accessory, Bike, Expense, FuelAdjustment, FuelEntry, MaintenanceRule, OdometerReading, Part, SafetyCheck, ServiceRecord, VaultDocument } from '@/types';
import {
  serialiseAccessory,
  serialiseBike,
  serialiseExpense,
  serialiseFuelAdjustment,
  serialiseFuelEntry,
  serialiseMaintenanceRule,
  serialiseOdometerReading,
  serialisePart,
  serialiseSafetyCheck,
  serialiseService,
  serialiseVaultDocument,
} from '@/repositories/serialisers';

/**
 * The app's entire write path, replayed against the PRODUCTION ruleset.
 *
 * `firestore.rules` in this repo is the live "Moto Companion" ruleset fetched
 * from the project, plus the additive mobile block. Every payload below is
 * produced by the same serialisers the app ships, so a schema drift between the
 * app and the deployed rules fails here — not in a rider's hands at a petrol
 * pump.
 */

const PROJECT_ID = 'revora-signup-test';
const UID = 'new-rider';
const BIKE_ID = 'bike-1';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const now = 1_760_000_000_000;
const stamp = { createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now) };
const owned = { id: 'x', userId: UID, bikeId: BIKE_ID, createdAt: now, updatedAt: now };

const bike: Bike = {
  id: BIKE_ID,
  userId: UID,
  createdAt: now,
  updatedAt: now,
  manufacturer: 'Honda',
  model: 'Hornet 2.0',
  nickname: 'Honda Hornet',
  year: 2025,
  tankCapacityMl: 12_000,
  purchasePriceMinor: 28_500_000,
  purchaseDate: '2026-07-12',
  engineNumber: null,
  chassisNumber: null,
  photoPath: null,
  currency: 'BDT',
  initialOdometerMetres: 4_700_000,
  storedOdometerMetres: 4_700_000,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 },
  archivedAt: null,
};

/** Writes exactly what repositories/base.writeRecord() would write on create. */
function creationPayload(data: Record<string, unknown>) {
  return { ...data, userId: UID, ...stamp };
}

/**
 * Motorcycles are created by the `createBike` callable, which uses the Admin SDK
 * and so bypasses these rules — the plan limit is checked there, transactionally,
 * against the server entitlement. Rules deny the client create outright, so every
 * test below that needs an existing bike seeds it the way the server does.
 */
async function seedBikeAsServer(id = BIKE_ID) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bikes', id), creationPayload(serialiseBike(bike)));
  });
}

describe('the first-run sequence against the production ruleset', () => {
  it('walks sign-up and onboarding, with the bike arriving only from the server', async () => {
    const db = env.authenticatedContext(UID).firestore();

    // 1. profileRepository.ensure(): read, then create with the required currency.
    await assertSucceeds(getDoc(doc(db, 'users', UID)));
    await assertSucceeds(
      setDoc(
        doc(db, 'users', UID),
        {
          userId: UID,
          createdAt: now,
          updatedAt: now,
          displayName: 'Riaz',
          email: 'rider@example.com',
          currency: 'BDT',
          units: { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l' },
          activeBikeId: null,
          onboardingCompletedAt: null,
          notifications: { maintenanceDue: true, documentExpiry: true, permissionRequestedAt: null },
        },
        { merge: true },
      ),
    );

    // 2. The garage listener.
    await assertSucceeds(
      getDocs(
        query(collection(db, 'bikes'), where('userId', '==', UID), orderBy('createdAt', 'asc'), limit(50)),
      ),
    );

    // 3. useAddBike: the client cannot write the bike itself, whatever it claims.
    await assertFails(setDoc(doc(db, 'bikes', BIKE_ID), creationPayload(serialiseBike(bike)), { merge: true }));
    // createBike accepts this exact payload and writes it as the server.
    await seedBikeAsServer();

    // 4. The opening odometer reading.
    const reading: OdometerReading = {
      ...owned,
      id: 'odo-1',
      metres: 4_700_000,
      date: '2026-07-12',
      source: 'manual',
      sourceId: null,
      note: 'Starting reading',
    };
    await assertSucceeds(
      setDoc(doc(db, 'odometerEntries', reading.id), creationPayload(serialiseOdometerReading(reading)), {
        merge: true,
      }),
    );

    // 5. A seeded maintenance rule.
    const rule: MaintenanceRule = {
      ...owned,
      id: 'rule-oil',
      name: 'Engine oil & filter',
      intervalMetres: 3_000_000,
      intervalDays: 180,
      warnAheadMetres: 300_000,
      warnAheadDays: 14,
      enabled: true,
      lastCompletedMetres: 4_700_000,
      lastCompletedDate: '2026-07-12',
      notes: null,
    };
    await assertSucceeds(
      setDoc(doc(db, 'maintenanceRules', rule.id), creationPayload(serialiseMaintenanceRule(rule)), {
        merge: true,
      }),
    );

    // 6. The profile update that records the active bike.
    await assertSucceeds(
      setDoc(doc(db, 'users', UID), { activeBikeId: BIKE_ID, onboardingCompletedAt: now, updatedAt: now }, { merge: true }),
    );

    // 7. Every listener the dashboard opens.
    for (const name of [
      'fuelEntries',
      'fuelAdjustments',
      'odometerEntries',
      'maintenanceRules',
      'services',
      'parts',
      'accessories',
      'expenses',
    ]) {
      await assertSucceeds(
        getDocs(query(collection(db, name), where('userId', '==', UID), where('bikeId', '==', BIKE_ID), limit(400))),
      );
    }
  });

  it('accepts every record type the app writes, serialised exactly as it writes them', async () => {
    const db = env.authenticatedContext(UID).firestore();
    await seedBikeAsServer();

    const fuel: FuelEntry = {
      ...owned,
      id: 'fuel-1',
      date: '2026-08-30',
      odometerMetres: 5_180_000,
      litresMl: 9_000,
      pricePerLitreMinor: 14_500,
      totalCostMinor: 130_500,
      currency: 'BDT',
      fillType: 'full',
      missedPreviousFill: false,
      station: 'Padma Oil, Mirpur 10',
      notes: null,
      receiptPath: null,
      clientRef: 'fuel-1',
    };
    await assertSucceeds(setDoc(doc(db, 'fuelEntries', fuel.id), creationPayload(serialiseFuelEntry(fuel)), { merge: true }));

    const adjustment: FuelAdjustment = {
      ...owned,
      id: 'adj-1',
      date: '2026-08-25',
      millilitres: -1_000,
      reason: 'maintenance_loss',
      approximate: false,
      note: 'Service / idle use (not ridden)',
      clientRef: 'fuel-1:maintenance_loss',
    };
    await assertSucceeds(
      setDoc(doc(db, 'fuelAdjustments', adjustment.id), creationPayload(serialiseFuelAdjustment(adjustment)), {
        merge: true,
      }),
    );

    const service: ServiceRecord = {
      ...owned,
      id: 'svc-1',
      title: 'Yongli brake pads — front',
      workshop: 'Rahim Moto Care',
      selfService: false,
      date: '2026-08-24',
      odometerMetres: 5_000_000,
      labourCostMinor: 40_000,
      partsCostMinor: 150_000,
      totalCostMinor: 190_000,
      currency: 'BDT',
      notes: null,
      completedRuleIds: [],
      itemsSummary: null,
      receiptPaths: [],
      estimate: {
        quoteMinor: 240_000,
        odometerInMetres: 4_998_000,
        odometerOutMetres: 5_000_000,
        askBeforeReplacing: true,
        approvedWork: ['Front brake pads'],
        declinedWork: [],
      },
      clientRef: 'svc-1',
    };
    await assertSucceeds(setDoc(doc(db, 'services', service.id), creationPayload(serialiseService(service)), { merge: true }));

    const part: Part = {
      ...owned,
      id: 'part-1',
      name: 'Yongli front brake pads',
      installedOdometerMetres: 5_000_000,
      installedDate: '2026-08-24',
      expectedLifeMetres: 8_000_000,
      costMinor: 190_000,
      currency: 'BDT',
      fittedBy: 'Rahim Moto Care',
      linkedServiceId: 'svc-1',
      removedDate: null,
      removedOdometerMetres: null,
      notes: null,
      clientRef: 'part-1',
    };
    await assertSucceeds(setDoc(doc(db, 'parts', part.id), creationPayload(serialisePart(part)), { merge: true }));

    const accessory: Accessory = {
      ...owned,
      id: 'acc-1',
      name: 'Givi 27L tail box',
      purchaseCostMinor: 800_000,
      installationCostMinor: 90_000,
      currency: 'BDT',
      date: '2026-08-10',
      notes: null,
      photoPath: null,
      linkedServiceId: null,
      clientRef: 'acc-1',
    };
    await assertSucceeds(
      setDoc(doc(db, 'accessories', accessory.id), creationPayload(serialiseAccessory(accessory)), { merge: true }),
    );

    const expense: Expense = {
      ...owned,
      id: 'exp-1',
      amountMinor: 6_000,
      currency: 'BDT',
      category: 'parking',
      derived: false,
      linkedRuleId: null,
      date: '2026-08-28',
      note: 'Parking — Bashundhara',
      clientRef: 'exp-1',
    };
    await assertSucceeds(
      setDoc(doc(db, 'expenses', expense.id), creationPayload(serialiseExpense(expense, 'Expense')), { merge: true }),
    );

    const documentRecord: VaultDocument = {
      ...owned,
      id: 'doc-1',
      kind: 'insurance',
      customKindLabel: null,
      title: 'Insurance — 3rd party',
      reference: 'TP-4432871',
      expiresOn: '2026-09-24',
      filePath: null,
      keepOfflineCopy: true,
      notes: null,
      clientRef: 'doc-1',
    };
    await assertSucceeds(
      setDoc(doc(db, 'documents', documentRecord.id), creationPayload(serialiseVaultDocument(documentRecord)), {
        merge: true,
      }),
    );

    const check: SafetyCheck = {
      ...owned,
      id: 'chk-1',
      area: 'tyres',
      date: '2026-08-26',
      status: 'ok',
      summary: 'F 29 / R 33 psi',
      measurements: { frontPsi: 29, rearPsi: 33 },
      note: null,
      photoPath: null,
      clientRef: 'chk-1',
    };
    await assertSucceeds(
      setDoc(doc(db, 'safetyChecks', check.id), creationPayload(serialiseSafetyCheck(check)), { merge: true }),
    );
  });

  it('still refuses another rider’s records and a self-granted entitlement', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore();
      await setDoc(doc(admin, 'bikes', 'their-bike'), {
        userId: 'someone-else',
        nickname: 'Their bike',
        manufacturer: 'X',
        model: 'Y',
        initialOdometer: 0,
        currentOdometer: 0,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    const db = env.authenticatedContext(UID).firestore();
    await assertFails(getDoc(doc(db, 'bikes', 'their-bike')));
    await assertFails(
      getDocs(query(collection(db, 'fuelEntries'), where('userId', '==', 'someone-else'))),
    );
    await assertFails(setDoc(doc(db, 'entitlements', UID), { tier: 'pro' }));
    await assertFails(getDoc(doc(db, 'entitlements', 'someone-else')));
    await assertSucceeds(getDoc(doc(db, 'entitlements', UID)));
  });

  it('accepts a correction that lowers a reading and the bike odometer with it', async () => {
    const db = env.authenticatedContext(UID).firestore();
    await seedBikeAsServer();
    const mistake: OdometerReading = {
      ...owned, id: 'odo-typo', metres: 6_000_000, date: '2026-09-01',
      source: 'manual', sourceId: null, note: null,
    };
    await assertSucceeds(
      setDoc(doc(db, 'odometerEntries', mistake.id), creationPayload(serialiseOdometerReading(mistake)), {
        merge: true,
      }),
    );

    // useCorrectOdometerReading: patch the reading down, then the bike's copy.
    await assertSucceeds(
      setDoc(doc(db, 'odometerEntries', mistake.id), { odometer: 5588, updatedAt: now }, { merge: true }),
    );
    await assertSucceeds(
      setDoc(
        doc(db, 'bikes', BIKE_ID),
        { ...serialiseBike({ ...bike, storedOdometerMetres: 5_588_000 }), updatedAt: now },
        { merge: true },
      ),
    );

    // Deleting a reading outright is the other half of a correction.
    await assertSucceeds(deleteDoc(doc(db, 'odometerEntries', mistake.id)));
  });

  it('an update never has to resend the frozen fields', async () => {
    const db = env.authenticatedContext(UID).firestore();
    await seedBikeAsServer();

    // patchRecord(): merge without userId/createdAt — the stored values stand.
    await assertSucceeds(
      setDoc(doc(db, 'bikes', BIKE_ID), { ...serialiseBike({ ...bike, nickname: 'Hornet' }), updatedAt: now }, { merge: true }),
    );

    // A write that tries to hand the bike to another account is refused.
    await assertFails(
      setDoc(doc(db, 'bikes', BIKE_ID), { userId: 'someone-else' }, { merge: true }),
    );
  });
});

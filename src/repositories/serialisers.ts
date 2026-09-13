import type { DocumentData } from '@react-native-firebase/firestore';

import type {
  Accessory,
  Bike,
  Expense,
  FuelAdjustment,
  FuelEntry,
  MaintenanceRule,
  OdometerReading,
  Part,
  SafetyCheck,
  ServiceRecord,
  VaultDocument,
  Warranty,
  ServiceItem,
} from '@/types';
import { compact, metresToKm, minorToMajor, mlToLitres } from './wire';

/**
 * Domain → document.
 *
 * The mirror of `parsers.ts`, and the other half of the unit boundary: metres
 * become kilometres, millilitres become litres, minor units become major.
 *
 * Field names are the shared schema's, because the web product reads these same
 * documents. Optional values the rider cleared are written as explicit `null` —
 * a merging write ignores a missing key, so omitting one would leave the old
 * value in place.
 */

export const serialiseBike = (bike: Bike): DocumentData =>
  compact({
    bikeId: undefined,
    nickname: bike.nickname,
    // The shared ruleset requires a non-empty manufacturer and model.
    manufacturer: bike.manufacturer.trim() === '' ? 'Unknown' : bike.manufacturer,
    model: bike.model.trim() === '' ? 'Unknown' : bike.model,
    year: bike.year,
    initialOdometer: metresToKm(bike.initialOdometerMetres),
    currentOdometer: metresToKm(bike.storedOdometerMetres),
    archived: bike.archivedAt !== null,
    tankCapacityLiters: bike.tankCapacityMl === null ? null : mlToLitres(bike.tankCapacityMl),
    purchasePrice:
      bike.purchasePriceMinor === null ? null : minorToMajor(bike.purchasePriceMinor, bike.currency),
    purchaseDate: bike.purchaseDate,
    engineNumber: bike.engineNumber,
    chassisNumber: bike.chassisNumber,
    photoPath: bike.photoPath,
    currency: bike.currency,
    company: {
      enabled: bike.company.enabled,
      companyName: bike.company.companyName,
      monthlyAllowance: minorToMajor(bike.company.monthlyAllowanceMinor, bike.currency),
    },
  });

export const serialiseFuelEntry = (entry: FuelEntry): DocumentData =>
  compact({
    bikeId: entry.bikeId,
    date: entry.date,
    odometer: metresToKm(entry.odometerMetres),
    liters: mlToLitres(entry.litresMl),
    tankStatus: entry.fillType,
    missedPreviousFill: entry.missedPreviousFill,
    pricePerLiter: minorToMajor(entry.pricePerLitreMinor, entry.currency),
    totalCost: minorToMajor(entry.totalCostMinor, entry.currency),
    stationName: entry.station,
    notes: entry.notes,
    receiptPath: entry.receiptPath,
    clientRef: entry.clientRef,
  });

export const serialiseFuelAdjustment = (adjustment: FuelAdjustment): DocumentData =>
  compact({
    bikeId: adjustment.bikeId,
    date: adjustment.date,
    // Signed on the wire, exactly as the shared ruleset expects.
    liters: mlToLitres(adjustment.millilitres),
    reason: adjustment.reason,
    approximate: adjustment.approximate,
    note: adjustment.note,
    clientRef: adjustment.clientRef,
  });

export const serialiseOdometerReading = (reading: OdometerReading): DocumentData =>
  compact({
    bikeId: reading.bikeId,
    date: reading.date,
    odometer: metresToKm(reading.metres),
    source: reading.source,
    sourceId: reading.sourceId,
    note: reading.note,
  });

export const serialiseMaintenanceRule = (rule: MaintenanceRule): DocumentData =>
  compact({
    bikeId: rule.bikeId,
    name: rule.name,
    intervalType:
      rule.intervalMetres !== null && rule.intervalDays !== null
        ? 'both'
        : rule.intervalDays !== null
          ? 'time'
          : 'distance',
    intervalKm: rule.intervalMetres === null ? null : metresToKm(rule.intervalMetres),
    intervalDays: rule.intervalDays,
    warnAheadKm: metresToKm(rule.warnAheadMetres),
    warnAheadDays: rule.warnAheadDays,
    enabled: rule.enabled,
    lastCompletedOdometer:
      rule.lastCompletedMetres === null ? null : metresToKm(rule.lastCompletedMetres),
    lastCompletedDate: rule.lastCompletedDate,
    notes: rule.notes,
  });

export const serialiseService = (service: ServiceRecord): DocumentData =>
  compact({
    bikeId: service.bikeId,
    title: service.title,
    date: service.date,
    odometer: service.odometerMetres === null ? 0 : metresToKm(service.odometerMetres),
    laborCost: minorToMajor(service.labourCostMinor, service.currency),
    partsCost: minorToMajor(service.partsCostMinor, service.currency),
    totalCost: minorToMajor(service.totalCostMinor, service.currency),
    performedBy: service.selfService ? null : service.workshop,
    notes: service.notes,
    completedRuleIds: service.completedRuleIds,
    itemsSummary: service.itemsSummary,
    receiptPaths: service.receiptPaths,
    estimate:
      service.estimate === null
        ? null
        : {
            quote:
              service.estimate.quoteMinor === null
                ? null
                : minorToMajor(service.estimate.quoteMinor, service.currency),
            odometerIn:
              service.estimate.odometerInMetres === null
                ? null
                : metresToKm(service.estimate.odometerInMetres),
            odometerOut:
              service.estimate.odometerOutMetres === null
                ? null
                : metresToKm(service.estimate.odometerOutMetres),
            askBeforeReplacing: service.estimate.askBeforeReplacing,
            approvedWork: service.estimate.approvedWork,
            declinedWork: service.estimate.declinedWork,
          },
    clientRef: service.clientRef,
  });

export const serialisePart = (part: Part): DocumentData =>
  compact({
    bikeId: part.bikeId,
    name: part.name,
    installedOdometer: metresToKm(part.installedOdometerMetres),
    installedDate: part.installedDate,
    expectedLifeKm: part.expectedLifeMetres === null ? null : metresToKm(part.expectedLifeMetres),
    cost: minorToMajor(part.costMinor, part.currency),
    fittedBy: part.fittedBy,
    serviceId: part.linkedServiceId,
    removedDate: part.removedDate,
    removedOdometer:
      part.removedOdometerMetres === null ? null : metresToKm(part.removedOdometerMetres),
    notes: part.notes,
    clientRef: part.clientRef,
  });

export const serialiseAccessory = (accessory: Accessory): DocumentData =>
  compact({
    bikeId: accessory.bikeId,
    name: accessory.name,
    cost: minorToMajor(accessory.purchaseCostMinor, accessory.currency),
    installationCost: minorToMajor(accessory.installationCostMinor, accessory.currency),
    date: accessory.date,
    notes: accessory.notes,
    photoPath: accessory.photoPath,
    serviceId: accessory.linkedServiceId,
    clientRef: accessory.clientRef,
  });

/**
 * The shared schema needs a non-empty `title` and its own category vocabulary.
 * Revora's manual categories map onto it; anything without a home becomes
 * `other`, which is what the web product shows too.
 */
const CATEGORY_TO_WIRE: Record<Expense['category'], string> = {
  registration: 'registration',
  insurance: 'insurance',
  parking: 'parking',
  toll: 'other',
  wash: 'wash',
  fine: 'fine',
  gear: 'other',
  modification: 'other',
  other: 'other',
};

export const serialiseExpense = (expense: Expense, fallbackTitle: string): DocumentData =>
  compact({
    bikeId: expense.bikeId,
    title: expense.note && expense.note.trim() !== '' ? expense.note.trim() : fallbackTitle,
    date: expense.date,
    amount: minorToMajor(expense.amountMinor, expense.currency),
    category: CATEGORY_TO_WIRE[expense.category],
    notes: expense.note,
    maintenanceRuleId: expense.linkedRuleId,
    clientRef: expense.clientRef,
  });

export const serialiseVaultDocument = (document: VaultDocument): DocumentData =>
  compact({
    bikeId: document.bikeId,
    kind: document.kind,
    customKindLabel: document.customKindLabel,
    title: document.title,
    reference: document.reference,
    issuedOn: document.issuedOn,
    expiresOn: document.expiresOn,
    filePath: document.filePath,
    keepOfflineCopy: document.keepOfflineCopy,
    notes: document.notes,
    clientRef: document.clientRef,
  });

export const serialiseWarranty = (warranty: Warranty): DocumentData =>
  compact({
    bikeId: warranty.bikeId,
    title: warranty.title,
    provider: warranty.provider,
    purchasedFrom: warranty.purchasedFrom,
    coverage: warranty.coverage,
    validUntil: warranty.validUntil,
    claimStatus: warranty.claimStatus,
    evidencePaths: warranty.evidencePaths,
    reminderDaysBefore: warranty.reminderDaysBefore,
    clientRef: warranty.clientRef,
  });

export const serialiseSafetyCheck = (check: SafetyCheck): DocumentData =>
  compact({
    bikeId: check.bikeId,
    area: check.area,
    date: check.date,
    status: check.status,
    summary: check.summary,
    measurements: check.measurements,
    note: check.note,
    photoPath: check.photoPath,
    clientRef: check.clientRef,
  });

/**
 * `serviceItems/{id}` — one fitted part or fluid.
 *
 * `name` carries the category because the shared ruleset already requires it;
 * the product fields are additive and optional, so an item written by the web
 * product without them still parses.
 */
export const serialiseServiceItem = (item: ServiceItem): DocumentData =>
  compact({
    bikeId: item.bikeId,
    serviceId: item.serviceId,
    ruleId: item.ruleId,
    name: item.category,
    brand: item.brand,
    product: item.product,
    spec: item.spec,
    quantity: item.quantity,
    unit: item.unit,
    totalCost: item.costMinor === null ? null : minorToMajor(item.costMinor, item.currency),
  });

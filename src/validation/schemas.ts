import { z } from 'zod';

import { isIsoDate } from '@/utils/date';

/**
 * Validation.
 *
 * Schemas validate *parsed* domain values — integer metres, millilitres and
 * minor units — never raw strings. Parsing happens first (see calculations/units
 * and calculations/money), so a field can fail for exactly one reason and the
 * message can say what it is.
 */

const isoDate = z.string().refine(isIsoDate, { message: 'Choose a valid date.' });

const metres = z
  .number({ message: 'Enter a number.' })
  .int()
  .min(0, { message: 'That cannot be negative.' })
  .max(9_999_999_000, { message: 'That reading looks too large.' });

const minorAmount = z
  .number({ message: 'Enter an amount.' })
  .int()
  .min(0, { message: 'That cannot be negative.' })
  .max(9_999_999_999, { message: 'That amount looks too large.' });

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: 'Enter your email address.' })
  .email({ message: 'That email address does not look right.' });

export const passwordSchema = z
  .string()
  .min(8, { message: 'Use at least 8 characters.' })
  .max(128, { message: 'That password is too long.' });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Enter your password.' }),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, { message: 'Enter a name.' }).max(60),
  email: emailSchema,
  password: passwordSchema,
});

export const recoverSchema = z.object({ email: emailSchema });

export const bikeSchema = z.object({
  manufacturer: z.string().trim().max(60).default(''),
  model: z.string().trim().max(60).default(''),
  nickname: z.string().trim().min(1, { message: 'Give your motorcycle a name.' }).max(60),
  year: z
    .number()
    .int()
    .min(1900, { message: 'Check the year.' })
    .max(new Date().getFullYear() + 1, { message: 'Check the year.' })
    .nullable(),
  tankCapacityMl: z.number().int().positive({ message: 'Tank capacity must be more than zero.' }).nullable(),
  purchasePriceMinor: minorAmount.nullable(),
  odometerMetres: metres,
});

export const fuelEntrySchema = z
  .object({
    date: isoDate,
    odometerMetres: metres,
    litresMl: z.number().int().positive({ message: 'Enter how much fuel you added.' }),
    pricePerLitreMinor: minorAmount.nullable(),
    totalCostMinor: minorAmount.nullable(),
    fillType: z.enum(['full', 'partial', 'unknown']),
    adjustmentMl: z.number().int().min(0),
    station: z.string().trim().max(80).nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .refine((v) => v.pricePerLitreMinor !== null || v.totalCostMinor !== null, {
    message: 'Enter a price per litre or a total.',
    path: ['totalCostMinor'],
  })
  .refine((v) => v.adjustmentMl < v.litresMl, {
    message: 'Adjustments cannot use up the whole fill.',
    path: ['adjustmentMl'],
  });

export const odometerSchema = z.object({
  metres,
  date: isoDate,
  note: z.string().trim().max(200).nullable(),
});

export const maintenanceRuleSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Name this rule.' }).max(80),
    intervalMetres: z.number().int().positive().nullable(),
    intervalDays: z.number().int().positive().nullable(),
    warnAheadMetres: z.number().int().min(0),
    warnAheadDays: z.number().int().min(0),
    enabled: z.boolean(),
  })
  .refine((v) => v.intervalMetres !== null || v.intervalDays !== null, {
    message: 'Set a distance interval, a time interval, or both.',
    path: ['intervalMetres'],
  });

export const maintenanceCompletionSchema = z.object({
  date: isoDate,
  odometerMetres: metres,
  costMinor: minorAmount.nullable(),
  workshop: z.string().trim().max(80).nullable(),
  notes: z.string().trim().max(500).nullable(),
});

export const serviceSchema = z.object({
  title: z.string().trim().min(1, { message: 'Describe the work done.' }).max(120),
  workshop: z.string().trim().max(80).nullable(),
  selfService: z.boolean(),
  date: isoDate,
  odometerMetres: metres.nullable(),
  labourCostMinor: minorAmount,
  partsCostMinor: minorAmount,
  totalCostMinor: minorAmount,
  notes: z.string().trim().max(1000).nullable(),
  completedRuleIds: z.array(z.string()),
});

export const partSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name the part.' }).max(90),
  installedOdometerMetres: metres,
  installedDate: isoDate,
  expectedLifeMetres: z.number().int().positive({ message: 'Expected life must be more than zero.' }).nullable(),
  costMinor: minorAmount,
  fittedBy: z.string().trim().max(80).nullable(),
  linkedServiceId: z.string().nullable(),
});

export const accessorySchema = z.object({
  name: z.string().trim().min(1, { message: 'Name the accessory.' }).max(90),
  purchaseCostMinor: minorAmount,
  installationCostMinor: minorAmount,
  date: isoDate,
  notes: z.string().trim().max(500).nullable(),
});

export const expenseSchema = z.object({
  amountMinor: minorAmount.refine((v) => v > 0, { message: 'Enter an amount.' }),
  category: z.enum([
    'registration',
    'insurance',
    'parking',
    'toll',
    'wash',
    'fine',
    'gear',
    'modification',
    'other',
  ]),
  date: isoDate,
  note: z.string().trim().max(200).nullable(),
});

export const documentSchema = z.object({
  kind: z.enum(['registration', 'insurance', 'tax_token', 'fitness', 'licence', 'custom']),
  title: z.string().trim().min(1, { message: 'Name this document.' }).max(90),
  reference: z.string().trim().max(80).nullable(),
  expiresOn: isoDate.nullable(),
  keepOfflineCopy: z.boolean(),
  notes: z.string().trim().max(500).nullable(),
});

export const warrantySchema = z.object({
  title: z.string().trim().min(1, { message: 'Name this warranty.' }).max(90),
  provider: z.string().trim().max(80).nullable(),
  purchasedFrom: z.string().trim().max(80).nullable(),
  coverage: z.string().trim().max(200).nullable(),
  validUntil: isoDate.nullable(),
  reminderDaysBefore: z.number().int().min(0).max(365).nullable(),
});

export const safetyCheckSchema = z.object({
  area: z.enum(['tyres', 'chain', 'brakes', 'battery', 'lights']),
  date: isoDate,
  status: z.enum(['ok', 'watch', 'action']),
  summary: z.string().trim().min(1, { message: 'Describe what you found.' }).max(120),
  note: z.string().trim().max(500).nullable(),
});

export const companySchema = z.object({
  enabled: z.boolean(),
  companyName: z.string().trim().max(80),
  monthlyAllowanceMinor: minorAmount,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type BikeInput = z.infer<typeof bikeSchema>;
export type FuelEntryInput = z.infer<typeof fuelEntrySchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type PartInput = z.infer<typeof partSchema>;
export type AccessoryInput = z.infer<typeof accessorySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type MaintenanceRuleInput = z.infer<typeof maintenanceRuleSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export type WarrantyInput = z.infer<typeof warrantySchema>;
export type SafetyCheckInput = z.infer<typeof safetyCheckSchema>;

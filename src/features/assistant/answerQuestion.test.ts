import { analyseBike, type BikeAnalytics, type GarageData } from '@/calculations/analytics';
import type { Bike, FuelEntry, UnitPreferences } from '@/types';
import { answerQuestion, SUGGESTED_QUESTIONS } from './answerQuestion';

/**
 * The assistant must never invent a number.
 *
 * These tests pin the contract: an answer either quotes a figure that exists in
 * the analysis, or says it does not have one. It must never produce a plausible
 * but fabricated value (requirement 36).
 */

const units: UnitPreferences = { currency: 'BDT', distance: 'km', volume: 'L', mileage: 'km_per_l' };

const bike: Bike = {
  id: 'b1',
  userId: 'u1',
  createdAt: 1,
  updatedAt: 1,
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
  initialOdometerMetres: 0,
  storedOdometerMetres: 0,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 },
  archivedAt: null,
};

const fill = (id: string, km: number, litres: number, date: string, order: number): FuelEntry => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: order,
  updatedAt: order,
  date,
  odometerMetres: km * 1000,
  litresMl: litres * 1000,
  pricePerLitreMinor: 14_500,
  totalCostMinor: Math.round(litres * 14_500),
  currency: 'BDT',
  fillType: 'full',
  missedPreviousFill: false,
  station: null,
  notes: null,
  receiptPath: null,
  clientRef: id,
});

const base: GarageData = {
  bike,
  fuelEntries: [],
  fuelAdjustments: [],
  odometerReadings: [],
  rules: [],
  services: [],
  parts: [],
  accessories: [],
  expenses: [],
  units,
  today: '2026-09-01',
};

const empty = analyseBike(base);
const withFills = analyseBike({
  ...base,
  fuelEntries: [fill('f1', 4845, 11, '2026-08-20', 1), fill('f2', 5180, 9, '2026-08-30', 2)],
});

function hasDigits(text: string): boolean {
  return /\d/.test(text);
}

describe('the assistant only speaks from the record', () => {
  it('answers with a real figure when one exists', () => {
    const answer = answerQuestion("what's my average mileage?", withFills);
    expect(answer.matched).toBe(true);
    // 335 km on 9 L = 37.2 km/L
    expect(answer.text).toContain('37.2');
  });

  it('refuses to quote a mileage it does not have', () => {
    const answer = answerQuestion("what's my average mileage?", empty);
    expect(answer.matched).toBe(true);
    expect(hasDigits(answer.text.replace(/second/i, ''))).toBe(false);
    expect(answer.text).toMatch(/do not have|not have/i);
  });

  it('refuses to quote a cost per km without distance', () => {
    const answer = answerQuestion('what does this bike cost per km?', empty);
    expect(answer.text).toMatch(/need more distance/i);
  });

  it('says plainly when it does not understand', () => {
    const answer = answerQuestion('what is the meaning of life', withFills);
    expect(answer.matched).toBe(false);
    expect(answer.text).toMatch(/only answer from what you've logged/i);
  });

  it('handles having no motorcycle at all', () => {
    const answer = answerQuestion('anything', null);
    expect(answer.matched).toBe(false);
    expect(answer.text).toMatch(/add a motorcycle/i);
  });

  it('answers every suggested question without falling through', () => {
    for (const question of SUGGESTED_QUESTIONS) {
      const answer = answerQuestion(question, withFills);
      expect(answer.matched).toBe(true);
      expect(answer.text.length).toBeGreaterThan(10);
    }
  });

  it('never emits a broken number', () => {
    for (const question of SUGGESTED_QUESTIONS) {
      for (const analytics of [empty, withFills] as BikeAnalytics[]) {
        const answer = answerQuestion(question, analytics);
        expect(answer.text).not.toMatch(/NaN|Infinity|undefined|null/);
      }
    }
  });
});

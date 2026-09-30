import type { Bike } from '@/types';
import { bikeDescriptor, knownOdometerMetres, summariseGarage } from './garage';

const base: Bike = {
  id: 'b1',
  userId: 'u1',
  createdAt: 1,
  updatedAt: 1,
  manufacturer: 'Bajaj',
  model: 'Pulsar NS200',
  nickname: 'The Red One',
  year: 2022,
  tankCapacityMl: 12_000,
  purchasePriceMinor: null,
  purchaseDate: null,
  engineNumber: null,
  chassisNumber: null,
  photoPath: null,
  currency: 'BDT',
  initialOdometerMetres: 0,
  storedOdometerMetres: 0,
  company: { enabled: false, companyName: '', monthlyAllowanceMinor: 0 },
  archivedAt: null,
};

const bike = (over: Partial<Bike>): Bike => ({ ...base, ...over });

describe('the line under a motorcycle name', () => {
  it('reads "Bajaj Pulsar NS200 · 2022"', () => {
    expect(bikeDescriptor(base)).toBe('Bajaj Pulsar NS200 · 2022');
  });

  it('drops the separator rather than printing a dangling middot', () => {
    expect(bikeDescriptor({ manufacturer: 'Honda', model: '', year: null })).toBe('Honda');
    expect(bikeDescriptor({ manufacturer: '', model: '', year: 2019 })).toBe('2019');
    expect(bikeDescriptor({ manufacturer: '  ', model: '  ', year: null })).toBe('');
  });
});

describe('the odometer a garage card can honestly print', () => {
  it('takes the higher of the opening reading and the stored figure', () => {
    expect(knownOdometerMetres({ initialOdometerMetres: 12_000, storedOdometerMetres: 34_712_000 })).toBe(
      34_712_000,
    );
    expect(knownOdometerMetres({ initialOdometerMetres: 5_180_000, storedOdometerMetres: 0 })).toBe(5_180_000);
  });

  it('returns null rather than zero when nothing is known, so the card shows a dash', () => {
    expect(knownOdometerMetres({ initialOdometerMetres: 0, storedOdometerMetres: 0 })).toBeNull();
  });
});

describe('the garage list', () => {
  const bikes = [
    bike({ id: 'archived', nickname: 'Old CD80', manufacturer: 'Honda', model: 'CD80', year: null, archivedAt: Date.UTC(2026, 2, 18) }),
    bike({ id: 'red', nickname: 'The Red One', storedOdometerMetres: 34_712_000 }),
    bike({ id: 'gixxer', nickname: 'Gixxer', manufacturer: 'Suzuki', model: 'Gixxer SF', year: 2023 }),
  ];

  it('puts the motorcycle in use first, then the rest, then the archived ones', () => {
    const rows = summariseGarage({ bikes, activeBikeId: 'gixxer', activeOdometerMetres: 12_408_000 });
    expect(rows.map((r) => r.id)).toEqual(['gixxer', 'red', 'archived']);
    expect(rows.map((r) => r.status)).toEqual(['active', 'other', 'archived']);
  });

  it('prints the derived reading for the active bike and the document figure for the others', () => {
    const rows = summariseGarage({ bikes, activeBikeId: 'gixxer', activeOdometerMetres: 12_408_000 });
    expect(rows[0]?.odometerMetres).toBe(12_408_000);
    expect(rows[1]?.odometerMetres).toBe(34_712_000);
  });

  it('falls back to the bike document while the analysis is still loading', () => {
    const rows = summariseGarage({ bikes, activeBikeId: 'red', activeOdometerMetres: null });
    expect(rows[0]?.odometerMetres).toBe(34_712_000);
  });

  it('leaves the odometer null when the garage has never recorded one', () => {
    const rows = summariseGarage({ bikes, activeBikeId: 'gixxer', activeOdometerMetres: null });
    expect(rows[0]?.odometerMetres).toBeNull();
  });

  it('carries the month a bike was archived, for "sold Mar 2026"', () => {
    const rows = summariseGarage({ bikes, activeBikeId: 'gixxer' });
    expect(rows[2]?.archivedMonth).toBe('2026-03');
    expect(rows[0]?.archivedMonth).toBeNull();
  });

  it('never calls an archived motorcycle the active one, even if the profile points at it', () => {
    const rows = summariseGarage({ bikes, activeBikeId: 'archived' });
    expect(rows.find((r) => r.id === 'archived')?.status).toBe('archived');
    expect(rows.some((r) => r.status === 'active')).toBe(false);
  });

  it('keeps an empty garage empty', () => {
    expect(summariseGarage({ bikes: [], activeBikeId: null })).toEqual([]);
  });
});

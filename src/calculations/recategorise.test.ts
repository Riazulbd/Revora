import { accessoryAsPart, conversionLosses, partAsAccessory } from './recategorise';
import type { Accessory, Part } from '@/types';

const part: Part = {
  id: 'p1', userId: 'u1', bikeId: 'b1', createdAt: 100, updatedAt: 100,
  name: 'Seat cushion', installedOdometerMetres: 5_000_000, installedDate: '2026-09-08',
  expectedLifeMetres: 8_000_000, costMinor: 145_000, currency: 'BDT',
  fittedBy: 'Rahim Moto Care', linkedServiceId: null,
  removedDate: null, removedOdometerMetres: null, notes: 'Gel', clientRef: 'ref-p1',
};

const accessory: Accessory = {
  id: 'a1', userId: 'u1', bikeId: 'b1', createdAt: 200, updatedAt: 200,
  name: 'Givi 27L tail box', purchaseCostMinor: 800_000, installationCostMinor: 90_000,
  currency: 'BDT', date: '2026-08-14', notes: null, photoPath: 'users/u1/accessory/a1.jpg',
  linkedServiceId: null, clientRef: 'ref-a1',
};

test('a part becomes an accessory keeping its whole cost as the purchase', () => {
  const converted = partAsAccessory(part, 'new-id', 999);
  expect(converted.purchaseCostMinor).toBe(145_000);
  // Splitting a cost the rider never split would invent a figure.
  expect(converted.installationCostMinor).toBe(0);
  expect(converted.date).toBe('2026-09-08');
  expect(converted.name).toBe('Seat cushion');
  expect(converted.createdAt).toBe(100);
  expect(converted.updatedAt).toBe(999);
});

test('an accessory becomes a part at the odometer the rider gives', () => {
  const converted = accessoryAsPart(accessory, 'new-id', 5_510_000, 999);
  expect(converted.installedOdometerMetres).toBe(5_510_000);
  // Purchase plus installation, because a part carries one cost.
  expect(converted.costMinor).toBe(890_000);
  expect(converted.expectedLifeMetres).toBeNull();
  expect(converted.installedDate).toBe('2026-08-14');
});

test('the rider is told what a conversion discards, before agreeing to it', () => {
  const losses = conversionLosses('partToAccessory', part);
  expect(losses).toContain('its expected life');
  expect(losses).toContain('who fitted it');
  expect(losses).toContain('the odometer reading it was fitted at');

  const removed = { ...part, removedDate: '2026-09-10', removedOdometerMetres: 5_400_000 };
  expect(conversionLosses('partToAccessory', removed)).toContain('when it was removed');
});

test('converting the other way loses only the photo, and nothing when there is none', () => {
  expect(conversionLosses('accessoryToPart', accessory)).toEqual(['the photo']);
  expect(conversionLosses('accessoryToPart', { ...accessory, photoPath: null })).toEqual([]);
});

test('the ledger reference survives, so a linked cost is not counted twice', () => {
  const linked: Part = { ...part, linkedServiceId: 'svc-1' };
  expect(partAsAccessory(linked, 'new-id', 999).linkedServiceId).toBe('svc-1');
  expect(accessoryAsPart({ ...accessory, linkedServiceId: 'svc-2' }, 'new-id', 5_000_000, 999).linkedServiceId)
    .toBe('svc-2');
});

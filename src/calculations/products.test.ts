import { describeProduct, knownProducts, productsFor } from './products';
import type { ServiceItem, ServiceRecord } from '@/types';

let seq = 0;

const service = (id: string, date: string): ServiceRecord => ({
  id,
  userId: 'u1',
  bikeId: 'b1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Service',
  workshop: 'Rahim Moto Care',
  selfService: false,
  date,
  odometerMetres: 5_000_000,
  labourCostMinor: 0,
  partsCostMinor: 0,
  totalCostMinor: 0,
  currency: 'BDT',
  notes: null,
  completedRuleIds: [],
  itemsSummary: null,
  receiptPaths: [],
  estimate: null,
  clientRef: id,
});

const item = (over: Partial<ServiceItem> & { serviceId: string; category: string }): ServiceItem => {
  seq += 1;
  return {
    id: `i${seq}`,
    userId: 'u1',
    bikeId: 'b1',
    createdAt: seq,
    updatedAt: seq,
    ruleId: null,
    brand: null,
    product: null,
    spec: null,
    quantity: 1,
    unit: 'piece',
    costMinor: null,
    currency: 'BDT',
    ...over,
  };
};

const services = [service('s1', '2026-03-10'), service('s2', '2026-08-24')];

test('remembers a product per category, most recently used first', () => {
  const products = knownProducts(
    [
      item({ serviceId: 's1', category: 'Engine oil', brand: 'Motul', product: '7100', spec: '10W-40', costMinor: 180_000 }),
      item({ serviceId: 's2', category: 'Engine oil', brand: 'AMSOIL', product: 'Metric Motorcycle Oil', spec: '10W-30', costMinor: 150_000 }),
      item({ serviceId: 's2', category: 'Oil filter', brand: 'Honda OEM', costMinor: 45_000 }),
    ],
    services,
  );
  expect(products.map((p) => p.brand)).toEqual(['AMSOIL', 'Honda OEM', 'Motul']);
  expect(productsFor(products, 'Engine oil').map((p) => p.brand)).toEqual(['AMSOIL', 'Motul']);
});

test('the same oil in a different grade is a different product', () => {
  const products = knownProducts(
    [
      item({ serviceId: 's1', category: 'Engine oil', brand: 'AMSOIL', product: 'Metric', spec: '10W-40' }),
      item({ serviceId: 's2', category: 'Engine oil', brand: 'AMSOIL', product: 'Metric', spec: '10W-30' }),
    ],
    services,
  );
  expect(products).toHaveLength(2);
});

test('the same product counts uses and keeps the latest price', () => {
  const products = knownProducts(
    [
      item({ serviceId: 's1', category: 'Engine oil', brand: 'AMSOIL', spec: '10W-30', costMinor: 140_000 }),
      item({ serviceId: 's2', category: 'Engine oil', brand: 'amsoil', spec: '10w-30', costMinor: 150_000 }),
    ],
    services,
  );
  expect(products).toHaveLength(1);
  expect(products[0]!.timesUsed).toBe(2);
  expect(products[0]!.lastCostMinor).toBe(150_000);
  expect(products[0]!.lastUsedOn).toBe('2026-08-24');
});

test('a line recording only that the job was done is not a product', () => {
  // Selecting "Engine oil" without naming one is a completed item, and must not
  // clutter the suggestions with a blank entry.
  expect(knownProducts([item({ serviceId: 's2', category: 'Engine oil' })], services)).toEqual([]);
});

test('an item whose service no longer exists is dropped', () => {
  const products = knownProducts(
    [item({ serviceId: 'deleted', category: 'Engine oil', brand: 'AMSOIL' })],
    services,
  );
  expect(products).toEqual([]);
});

test('describes a product from whichever parts were recorded', () => {
  expect(describeProduct({ brand: 'AMSOIL', product: 'Metric Motorcycle Oil', spec: '10W-30' }))
    .toBe('AMSOIL Metric Motorcycle Oil · 10W-30');
  expect(describeProduct({ brand: 'Honda OEM', product: null, spec: null })).toBe('Honda OEM');
  expect(describeProduct({ brand: null, product: null, spec: 'CPR8EA-9' })).toBe('CPR8EA-9');
});

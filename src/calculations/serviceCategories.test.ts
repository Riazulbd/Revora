import {
  filterServices,
  primaryServiceCategory,
  serviceCategories,
  serviceFilters,
  serviceItemUnit,
  serviceMatchesFilter,
  serviceSpendMinor,
} from './serviceCategories';
import type { ServiceRecord } from '@/types';

let seq = 0;
const service = (title: string, itemsSummary: string | null = null, totalCostMinor = 0): ServiceRecord => {
  seq += 1;
  return {
    id: `s${seq}`, userId: 'u1', bikeId: 'b1', createdAt: seq, updatedAt: seq,
    title, workshop: 'Rahim Motors', selfService: false, date: '2026-09-09',
    odometerMetres: 34_650_000, labourCostMinor: 0, partsCostMinor: 0, totalCostMinor,
    currency: 'BDT', notes: null, completedRuleIds: [], itemsSummary,
    receiptPaths: [], estimate: null, clientRef: `r${seq}`,
  };
};

test('a service that covers two jobs belongs to both filters', () => {
  const both = service('Brake pads + oil change');
  expect(serviceCategories(both)).toEqual(['oil', 'brakes']);
  expect(serviceMatchesFilter(both, 'oil')).toBe(true);
  expect(serviceMatchesFilter(both, 'brakes')).toBe(true);
  expect(serviceMatchesFilter(both, 'chain')).toBe(false);
  expect(serviceMatchesFilter(both, 'all')).toBe(true);
});

test('the row glyph stands for one job, or for none of them', () => {
  // The board draws the general wrench on "Brake pads + oil change" precisely
  // because it is neither an oil change nor a brake job on its own.
  expect(primaryServiceCategory(service('Brake pads + oil change'))).toBe('other');
  expect(primaryServiceCategory(service('Chain + sprocket set'))).toBe('chain');
  expect(primaryServiceCategory(service('Oil change'))).toBe('oil');
  expect(primaryServiceCategory(service('Full service'))).toBe('other');
});

test('the item summary is read as well as the title', () => {
  const vague = service('Annual visit', 'Engine oil, Air filter');
  expect(serviceCategories(vague)).toEqual(['oil']);
});

test('only categories the rider has actually used become chips', () => {
  expect(serviceFilters([service('Oil change'), service('Chain lube')])).toEqual([
    'all',
    'oil',
    'chain',
  ]);
  // A service matching nothing is reachable through its own chip, not lost.
  expect(serviceFilters([service('Fork seal')])).toEqual(['all', 'other']);
  expect(serviceFilters([])).toEqual(['all']);
});

test('filtering keeps the rows and the total in step', () => {
  const all = [
    service('Brake pads + oil change', null, 165_000),
    service('Chain + sprocket set', null, 385_000),
    service('Oil change', null, 82_000),
  ];
  expect(serviceSpendMinor(all)).toBe(632_000);

  const oil = filterServices(all, 'oil');
  expect(oil.map((s) => s.title)).toEqual(['Brake pads + oil change', 'Oil change']);
  expect(serviceSpendMinor(oil)).toBe(247_000);

  expect(serviceSpendMinor(filterServices(all, 'tyres'))).toBe(0);
});

test('fluids are counted in litres, parts in pieces', () => {
  expect(serviceItemUnit('Engine oil & filter')).toBe('litre');
  expect(serviceItemUnit('Coolant flush')).toBe('litre');
  expect(serviceItemUnit('Air filter')).toBe('piece');
  expect(serviceItemUnit('Tyre pressure & tread')).toBe('piece');
});

import { matchingWorkshops, recentWorkshops } from './workshops';
import type { ServiceRecord } from '@/types';

let seq = 0;
const service = (workshop: string | null, date: string): ServiceRecord => {
  seq += 1;
  return {
    id: `s${seq}`, userId: 'u1', bikeId: 'b1', createdAt: seq, updatedAt: seq,
    title: 'Service', workshop, selfService: workshop === null, date,
    odometerMetres: 5_000_000, labourCostMinor: 0, partsCostMinor: 0, totalCostMinor: 0,
    currency: 'BDT', notes: null, completedRuleIds: [], itemsSummary: null,
    receiptPaths: [], estimate: null, clientRef: `r${seq}`,
  };
};

test('offers workshops most recently used first', () => {
  const list = recentWorkshops([
    service('Rahim Moto Care', '2026-07-01'),
    service('Honda Service Center', '2026-08-20'),
    service('ABC Motors', '2026-06-02'),
  ]);
  expect(list).toEqual(['Honda Service Center', 'Rahim Moto Care', 'ABC Motors']);
});

test('one workshop however it was spaced or capitalised, keeping the latest spelling', () => {
  const list = recentWorkshops([
    service('rahim moto  care', '2026-08-20'),
    service('Rahim Moto Care', '2026-07-01'),
  ]);
  expect(list).toEqual(['rahim moto care']);
});

test('self-service records contribute no workshop', () => {
  expect(recentWorkshops([service(null, '2026-08-20'), service('  ', '2026-08-10')])).toEqual([]);
});

test('suggestions narrow as the rider types, and stop once it matches exactly', () => {
  const all = ['Honda Service Center', 'Rahim Moto Care', 'ABC Motors'];
  expect(matchingWorkshops(all, '')).toHaveLength(3);
  expect(matchingWorkshops(all, 'mot')).toEqual(['Rahim Moto Care', 'ABC Motors']);
  // Nothing left to offer once the name is fully typed.
  expect(matchingWorkshops(all, 'ABC Motors')).toEqual([]);
});

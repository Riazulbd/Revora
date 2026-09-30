import type { KnownProduct } from '@/types';
import { brandChoices, brandLabel } from './brandChoices';

const TODAY = '2026-09-16';

const product = (over: Partial<KnownProduct> = {}): KnownProduct => ({
  category: 'Engine oil',
  brand: 'Shell',
  product: 'Advance AX7',
  spec: '10W-40',
  lastUsedOn: '2026-08-02',
  lastCostMinor: 78_000,
  timesUsed: 3,
  ...over,
});

describe('brandLabel', () => {
  it('runs brand, product and grade together as the board prints them', () => {
    expect(brandLabel(product())).toBe('Shell Advance AX7 10W-40');
  });

  it('skips the parts the rider never recorded', () => {
    expect(brandLabel(product({ product: null, spec: null }))).toBe('Shell');
  });
});

describe('brandChoices', () => {
  const history: KnownProduct[] = [
    product(),
    product({ brand: 'Mobil', product: 'Super Moto', spec: '20W-40', lastUsedOn: '2026-05-11' }),
    product({ brand: 'Motul', product: '3000', spec: '10W-30', lastUsedOn: '2024-02-10' }),
    product({ category: 'Air filter', brand: 'K&N', product: 'BA-2002', spec: null, lastUsedOn: '2026-06-01' }),
  ];

  it('notes the most recent as used last time and the rest by month', () => {
    const choices = brandChoices(history, 'Engine oil', TODAY);

    expect(choices.map((c) => c.label)).toEqual([
      'Shell Advance AX7 10W-40',
      'Mobil Super Moto 20W-40',
      'Motul 3000 10W-30',
    ]);
    expect(choices.map((c) => c.note)).toEqual(['used last time', 'used in May', null]);
  });

  it('offers nothing from another category', () => {
    expect(brandChoices(history, 'Chain lube', TODAY)).toEqual([]);
  });

  it('matches the category regardless of case and spacing', () => {
    expect(brandChoices(history, '  engine   oil ', TODAY)).toHaveLength(3);
  });

  it('drops a line that names nothing at all', () => {
    const nameless = [product({ brand: null, product: null, spec: null })];
    expect(brandChoices(nameless, 'Engine oil', TODAY)).toEqual([]);
  });
});

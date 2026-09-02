import type { MileageUnit } from '@/types';
import {
  costPerDistance,
  displayToMetres,
  displayToMl,
  efficiencyFrom,
  efficiencyToDisplay,
  metresToDisplay,
  mlToDisplay,
  parseDistanceToMetres,
  parseVolumeToMl,
  RATE_SCALE,
} from './units';

describe('distance', () => {
  it('converts kilometres', () => {
    expect(metresToDisplay(5_180_000, 'km')).toBe(5180);
    expect(displayToMetres(5180, 'km')).toBe(5_180_000);
  });

  it('converts miles', () => {
    expect(metresToDisplay(1_609_344, 'mi')).toBeCloseTo(1000, 6);
    expect(displayToMetres(1000, 'mi')).toBe(1_609_344);
  });

  it('parses an odometer field', () => {
    expect(parseDistanceToMetres('5,180', 'km')).toBe(5_180_000);
    expect(parseDistanceToMetres('5180.4', 'km')).toBe(5_180_400);
    expect(parseDistanceToMetres('abc', 'km')).toBeNull();
  });
});

describe('volume', () => {
  it('converts litres', () => {
    expect(mlToDisplay(9000, 'L')).toBe(9);
    expect(displayToMl(9, 'L')).toBe(9000);
  });

  it('converts US gallons', () => {
    expect(mlToDisplay(3785.411784, 'gal_us')).toBeCloseTo(1, 9);
    expect(displayToMl(1, 'gal_us')).toBe(3785);
  });

  it('parses a litres field', () => {
    expect(parseVolumeToMl('9', 'L')).toBe(9000);
    expect(parseVolumeToMl('9.35', 'L')).toBe(9350);
    expect(parseVolumeToMl('', 'L')).toBeNull();
  });
});

describe('efficiency', () => {
  const e = efficiencyFrom(335_000, 8_000)!;

  it('is null without both a distance and a volume', () => {
    expect(efficiencyFrom(0, 8000)).toBeNull();
    expect(efficiencyFrom(335_000, 0)).toBeNull();
    expect(efficiencyFrom(-1, 8000)).toBeNull();
  });

  const cases: [MileageUnit, number][] = [
    ['km_per_l', 41.875],
    ['l_per_100km', 100 / 41.875],
    ['mpg_us', (335_000 / 8_000 / 1609.344) * 3785.411784],
    ['mpg_uk', (335_000 / 8_000 / 1609.344) * 4546.09],
  ];

  it.each(cases)('converts to %s', (unit, expected) => {
    expect(efficiencyToDisplay(e, unit)).toBeCloseTo(expected, 6);
  });
});

describe('cost per distance', () => {
  it('scales a fractional rate into an integer', () => {
    // BDT 24,720 over 5,180 km = BDT 4.77/km → 477 at RATE_SCALE 100
    const scaled = costPerDistance(2_472_000, 5_180_000, 'km')!;
    expect(scaled).toBe(Math.round((2_472_000 * RATE_SCALE * 1000) / 5_180_000));
  });

  it('is null with no distance to divide by', () => {
    expect(costPerDistance(2_472_000, 0, 'km')).toBeNull();
  });
});

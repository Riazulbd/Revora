import { efficiencyFrom } from '@/calculations/units';
import {
  costPerDistanceHint,
  formatCurrency,
  formatDistance,
  formatMileage,
  formatMileageValue,
  formatNumber,
  formatRate,
  formatVolume,
  NO_VALUE,
} from './format';

describe('never shows a broken number to the rider', () => {
  const broken = [NaN, Infinity, -Infinity, null, undefined];

  it.each(broken)('renders %p as the em dash', (value) => {
    expect(formatNumber(value as number)).toBe(NO_VALUE);
    expect(formatDistance(value as number, 'km')).toBe(NO_VALUE);
    expect(formatVolume(value as number, 'L')).toBe(NO_VALUE);
    expect(formatCurrency(value as number, 'BDT')).toBe(NO_VALUE);
    expect(formatRate(value as number, 'BDT')).toBe(NO_VALUE);
  });

  it('renders a missing mileage as the em dash', () => {
    expect(formatMileage(null, 'km_per_l')).toBe(NO_VALUE);
    expect(formatMileageValue(undefined, 'km_per_l')).toBe(NO_VALUE);
  });

  it('never emits the strings NaN, Infinity, undefined or null', () => {
    const rendered = broken.flatMap((v) => [
      formatNumber(v as number),
      formatDistance(v as number, 'km'),
      formatCurrency(v as number, 'BDT'),
      formatMileage(null, 'km_per_l'),
    ]);
    for (const r of rendered) {
      expect(r).not.toMatch(/NaN|Infinity|undefined|null/);
    }
  });
});

describe('display precision', () => {
  it('shows mileage to one decimal', () => {
    expect(formatMileageValue(efficiencyFrom(335_000, 8_000), 'km_per_l')).toBe('41.9');
    expect(formatMileageValue(efficiencyFrom(335_000, 9_000), 'km_per_l')).toBe('37.2');
  });

  it('groups long distances', () => {
    expect(formatDistance(128_450_000, 'km')).toBe('128,450 km');
  });

  it('shows volume to one decimal', () => {
    expect(formatVolume(9_000, 'L')).toBe('9.0 L');
    expect(formatVolume(11_500, 'L')).toBe('11.5 L');
  });

  it('formats money the way the design does', () => {
    expect(formatCurrency(130_500, 'BDT')).toBe('BDT 1,305');
    expect(formatCurrency(12_575_000, 'BDT')).toBe('BDT 125,750');
  });

  it('formats a fractional rate to one decimal', () => {
    // 4.8 per km, stored scaled by 100 × 100
    expect(formatRate(48_000, 'BDT')).toBe('BDT 4.8');
  });

  it('renders a genuine zero as zero, not as missing', () => {
    expect(formatCurrency(0, 'BDT')).toBe('BDT 0');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('rate formatting respects the currency scale', () => {
  it('renders a cost per kilometre to one decimal', () => {
    // BDT 14,260 over 1,280 km = BDT 11.14/km
    const scaled = Math.round((1_426_000 * 100 * 1000) / 1_280_000);
    expect(formatRate(scaled, 'BDT')).toBe('BDT 11.1');
  });

  it('drops the decimal on a large rate', () => {
    // BDT 14,260 over 10 km = BDT 1,426/km
    const scaled = Math.round((1_426_000 * 100 * 1000) / 10_000);
    expect(formatRate(scaled, 'BDT')).toBe('BDT 1,426');
  });
});

describe('a withheld cost per distance explains itself', () => {
  it('names the threshold and the distance still to go', () => {
    const hint = costPerDistanceHint(665_000, 1_000_000, 'km');
    expect(hint).toContain('1,000 km');
    expect(hint).toContain('335 km to go');
  });

  it('says nothing once the figure is trustworthy', () => {
    expect(costPerDistanceHint(1_000_000, 1_000_000, 'km')).toBeNull();
    expect(costPerDistanceHint(2_400_000, 1_000_000, 'km')).toBeNull();
  });

  it('speaks the rider\'s unit, not kilometres by default', () => {
    const hint = costPerDistanceHint(0, 1_000_000, 'mi');
    expect(hint).toContain('Cost per mi');
    expect(hint).not.toContain('km');
  });
});

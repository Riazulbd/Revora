import {
  divideRound,
  formatMoney,
  formatMoneyCompact,
  parseDecimal,
  parseMoney,
} from './money';

describe('parseDecimal', () => {
  it('scales without touching a float', () => {
    expect(parseDecimal('145', 2)).toBe(14500);
    expect(parseDecimal('145.5', 2)).toBe(14550);
    expect(parseDecimal('145.55', 2)).toBe(14555);
    expect(parseDecimal('0.1', 2)).toBe(10);
    expect(parseDecimal('.5', 2)).toBe(50);
  });

  it('survives the classic float traps', () => {
    // 0.1 + 0.2 in minor units is exactly 30.
    expect(parseDecimal('0.1', 2)! + parseDecimal('0.2', 2)!).toBe(30);
    expect(parseDecimal('1.005', 2)).toBe(101); // half-up, not 100 as float rounding gives
    expect(parseDecimal('8.115', 2)).toBe(812);
  });

  it('strips grouping separators', () => {
    expect(parseDecimal('1,305', 2)).toBe(130500);
    expect(parseDecimal('12 500', 2)).toBe(1250000);
  });

  it('rejects anything that is not a plain non-negative decimal', () => {
    expect(parseDecimal('', 2)).toBeNull();
    expect(parseDecimal('abc', 2)).toBeNull();
    expect(parseDecimal('-5', 2)).toBeNull();
    expect(parseDecimal('1.2.3', 2)).toBeNull();
    expect(parseDecimal('.', 2)).toBeNull();
    expect(parseDecimal('1e5', 2)).toBeNull();
  });

  it('parses money at the currency scale', () => {
    expect(parseMoney('1,305', 'BDT')).toBe(130500);
  });
});

describe('divideRound', () => {
  it('rounds half away from zero', () => {
    expect(divideRound(5, 2)).toBe(3);
    expect(divideRound(-5, 2)).toBe(-3);
    expect(divideRound(4, 2)).toBe(2);
    expect(divideRound(1, 3)).toBe(0);
    expect(divideRound(2, 3)).toBe(1);
  });

  it('never divides by zero', () => {
    expect(divideRound(10, 0)).toBe(0);
  });
});

describe('formatMoney', () => {
  it('renders the design’s money style', () => {
    expect(formatMoney(130500, 'BDT')).toBe('BDT 1,305');
    expect(formatMoney(2472000, 'BDT')).toBe('BDT 24,720');
    expect(formatMoney(0, 'BDT')).toBe('BDT 0');
  });

  it('renders decimals when asked', () => {
    expect(formatMoney(130550, 'BDT', { decimals: 2 })).toBe('BDT 1,305.50');
    expect(formatMoney(48000, 'BDT', { decimals: 1 })).toBe('BDT 480.0');
  });

  it('renders the symbol form', () => {
    expect(formatMoney(130500, 'BDT', { symbol: true })).toBe('৳1,305');
  });

  it('keeps negatives readable', () => {
    expect(formatMoney(-50000, 'BDT')).toBe('-BDT 500');
  });

  it('abbreviates only large figures', () => {
    expect(formatMoneyCompact(28500000, 'BDT')).toBe('BDT 285k');
    expect(formatMoneyCompact(130500, 'BDT')).toBe('BDT 1,305');
    expect(formatMoneyCompact(1250000000, 'BDT')).toBe('BDT 12.5m');
  });
});

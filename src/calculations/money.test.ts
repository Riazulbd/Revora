import { CURRENCIES, CURRENCY_PICKER_ORDER, searchCurrencies } from './currencies';
import {
  currencyDecimals,
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

  it('breaks every exact .5 away from zero, in both directions', () => {
    // The documented policy: a derived minor unit sitting exactly on the half
    // goes UP in magnitude, never to even. Every derived total and price/L in
    // the app inherits this, so it is pinned in both signs.
    expect(divideRound(1, 2)).toBe(1); //  0.5 → 1   (not 0, which banker's rounding gives)
    expect(divideRound(-1, 2)).toBe(-1); // -0.5 → -1
    expect(divideRound(3, 2)).toBe(2); //  1.5 → 2
    expect(divideRound(-3, 2)).toBe(-2); // -1.5 → -2
    expect(divideRound(5, 2)).toBe(3); //  2.5 → 3   (banker's would give 2)
    expect(divideRound(-5, 2)).toBe(-3); // -2.5 → -3
    expect(divideRound(7, 2)).toBe(4); //  3.5 → 4
  });

  it('rounds a hair under and a hair over the half the obvious way', () => {
    // 2.49 → 2, 2.51 → 3, so the .5 case above is a boundary and not a bias.
    expect(divideRound(249, 100)).toBe(2);
    expect(divideRound(251, 100)).toBe(3);
    expect(divideRound(-249, 100)).toBe(-2);
    expect(divideRound(-251, 100)).toBe(-3);
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

  it('does not move the point when asked for more decimals than the currency has', () => {
    // JPY has no minor unit at all: 1,305 minor units IS 1,305 yen. Asking for
    // two decimals must pad, not shift — ¥1,305 is not ¥13.05.
    expect(formatMoney(1_305, 'JPY', { decimals: 2 })).toBe('JPY 1,305.00');
    expect(formatMoney(150, 'JPY', { decimals: 2 })).toBe('JPY 150.00');
  });

  it('renders a three-decimal currency at its own exponent', () => {
    // KWD has exponent 3: 1,305 fils = 1.305 KWD, and 300 fils = 0.300 KWD.
    expect(formatMoney(1_305, 'KWD', { decimals: 3 })).toBe('KWD 1.305');
    expect(formatMoney(300, 'KWD', { decimals: 3 })).toBe('KWD 0.300');
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

describe('the global currency table', () => {
  it('carries the ISO exponent, which the integer money path depends on', () => {
    // ¥1000 is 1000 minor units, not 100000 — getting this wrong misprices
    // every record in that currency by a factor of a hundred.
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KWD')).toBe(3);
    expect(currencyDecimals('USD')).toBe(2);
    expect(parseMoney('1000', 'JPY')).toBe(1000);
    expect(parseMoney('10.00', 'USD')).toBe(1000);
    expect(parseMoney('1.234', 'KWD')).toBe(1234);
  });

  it('offers the home markets first and finds a currency by code, name or symbol', () => {
    expect(CURRENCY_PICKER_ORDER[0]?.code).toBe('BDT');
    expect(searchCurrencies('yen').map((c) => c.code)).toContain('JPY');
    expect(searchCurrencies('JPY').map((c) => c.code)).toContain('JPY');
    expect(searchCurrencies('₦').map((c) => c.code)).toContain('NGN');
    expect(searchCurrencies('zzzz')).toHaveLength(0);
  });

  it('every entry is a well-formed ISO code with a usable symbol', () => {
    for (const entry of CURRENCIES) {
      expect(entry.code).toMatch(/^[A-Z]{3}$/);
      expect(entry.name.length).toBeGreaterThan(2);
      expect(entry.symbol.length).toBeGreaterThan(0);
      expect([0, 2, 3]).toContain(entry.minorUnits);
    }
    expect(new Set(CURRENCIES.map((c) => c.code)).size).toBe(CURRENCIES.length);
  });
});

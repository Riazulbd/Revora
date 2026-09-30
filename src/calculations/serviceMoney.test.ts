import { serviceMoney } from './serviceMoney';

const base = { labourMinor: 0, itemCostsMinor: [], invoiceMinor: null, typedTotalMinor: null };

test('nothing itemised: the typed total is the total, and labour is not asked for', () => {
  const money = serviceMoney({ ...base, typedTotalMinor: 180_000 });
  expect(money.itemised).toBe(false);
  expect(money.partsMinor).toBe(0);
  expect(money.totalMinor).toBe(180_000);
  expect(money.knownTotalMinor).toBe(180_000);
});

test('priced items switch the box to labour and add up to the total', () => {
  // The board's open form: ৳600 labour, ৳780 of oil, ৳1,450 of air filter.
  const money = serviceMoney({
    ...base,
    labourMinor: 60_000,
    itemCostsMinor: [78_000, 145_000],
  });
  expect(money.itemised).toBe(true);
  expect(money.partsMinor).toBe(223_000);
  expect(money.totalMinor).toBe(283_000);
});

test('an unpriced tick costs nothing and does not itemise the service', () => {
  const money = serviceMoney({ ...base, itemCostsMinor: [null, null], typedTotalMinor: 90_000 });
  expect(money.itemised).toBe(false);
  expect(money.partsMinor).toBe(0);
  expect(money.totalMinor).toBe(90_000);
});

test('the invoice is what left the rider’s pocket, whatever the parts add up to', () => {
  const money = serviceMoney({
    ...base,
    labourMinor: 60_000,
    itemCostsMinor: [78_000, 145_000],
    invoiceMinor: 385_000,
    typedTotalMinor: 100_000,
  });
  expect(money.itemised).toBe(true);
  expect(money.totalMinor).toBe(385_000);
});

test('an invoice on its own still itemises the form', () => {
  const money = serviceMoney({ ...base, invoiceMinor: 385_000 });
  expect(money.itemised).toBe(true);
  expect(money.partsMinor).toBe(0);
  expect(money.totalMinor).toBe(385_000);
});

test('a form with no figure at all has no total to print', () => {
  const money = serviceMoney(base);
  expect(money.knownTotalMinor).toBeNull();
  expect(money.totalMinor).toBe(0);
});

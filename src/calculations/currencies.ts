/**
 * The currencies Revora can keep books in.
 *
 * `minorUnits` is the ISO 4217 exponent and it is **not** decoration: money is
 * stored as an integer count of minor units, so ¥1,000 is `1000` with exponent
 * 0 while $10.00 is `1000` with exponent 2. Getting an exponent wrong misprices
 * every record in that currency by a factor of a hundred, so the values below
 * follow ISO 4217 rather than local habit.
 *
 * Symbols are the ones a rider in that country would recognise; where a script
 * has no distinct symbol the code itself is used, which is what banks print.
 */
/** Offered first: Revora's home markets, then the reserve currencies. */
const PRIORITY = ['BDT', 'INR', 'PKR', 'LKR', 'NPR', 'USD', 'EUR', 'GBP'] as const;

const TABLE = [
  ['AED', 'UAE dirham', 'د.إ', 2], ['AFN', 'Afghan afghani', '؋', 2],
  ['ALL', 'Albanian lek', 'L', 2], ['AMD', 'Armenian dram', '֏', 2],
  ['ANG', 'Netherlands Antillean guilder', 'ƒ', 2], ['AOA', 'Angolan kwanza', 'Kz', 2],
  ['ARS', 'Argentine peso', '$', 2], ['AUD', 'Australian dollar', 'A$', 2],
  ['AWG', 'Aruban florin', 'ƒ', 2], ['AZN', 'Azerbaijani manat', '₼', 2],
  ['BAM', 'Bosnia-Herzegovina mark', 'KM', 2], ['BBD', 'Barbadian dollar', '$', 2],
  ['BDT', 'Bangladeshi taka', '৳', 2], ['BGN', 'Bulgarian lev', 'лв', 2],
  ['BHD', 'Bahraini dinar', '.د.ب', 3], ['BIF', 'Burundian franc', 'FBu', 0],
  ['BMD', 'Bermudian dollar', '$', 2], ['BND', 'Brunei dollar', '$', 2],
  ['BOB', 'Bolivian boliviano', 'Bs', 2], ['BRL', 'Brazilian real', 'R$', 2],
  ['BSD', 'Bahamian dollar', '$', 2], ['BTN', 'Bhutanese ngultrum', 'Nu.', 2],
  ['BWP', 'Botswana pula', 'P', 2], ['BYN', 'Belarusian rouble', 'Br', 2],
  ['BZD', 'Belize dollar', '$', 2], ['CAD', 'Canadian dollar', 'C$', 2],
  ['CDF', 'Congolese franc', 'FC', 2], ['CHF', 'Swiss franc', 'CHF', 2],
  ['CLP', 'Chilean peso', '$', 0], ['CNY', 'Chinese yuan', '¥', 2],
  ['COP', 'Colombian peso', '$', 2], ['CRC', 'Costa Rican colón', '₡', 2],
  ['CUP', 'Cuban peso', '$', 2], ['CVE', 'Cape Verdean escudo', '$', 2],
  ['CZK', 'Czech koruna', 'Kč', 2], ['DJF', 'Djiboutian franc', 'Fdj', 0],
  ['DKK', 'Danish krone', 'kr', 2], ['DOP', 'Dominican peso', '$', 2],
  ['DZD', 'Algerian dinar', 'د.ج', 2], ['EGP', 'Egyptian pound', 'E£', 2],
  ['ERN', 'Eritrean nakfa', 'Nfk', 2], ['ETB', 'Ethiopian birr', 'Br', 2],
  ['EUR', 'Euro', '€', 2], ['FJD', 'Fijian dollar', '$', 2],
  ['GBP', 'Pound sterling', '£', 2], ['GEL', 'Georgian lari', '₾', 2],
  ['GHS', 'Ghanaian cedi', '₵', 2], ['GMD', 'Gambian dalasi', 'D', 2],
  ['GNF', 'Guinean franc', 'FG', 0], ['GTQ', 'Guatemalan quetzal', 'Q', 2],
  ['GYD', 'Guyanese dollar', '$', 2], ['HKD', 'Hong Kong dollar', 'HK$', 2],
  ['HNL', 'Honduran lempira', 'L', 2], ['HTG', 'Haitian gourde', 'G', 2],
  ['HUF', 'Hungarian forint', 'Ft', 2], ['IDR', 'Indonesian rupiah', 'Rp', 2],
  ['ILS', 'Israeli new shekel', '₪', 2], ['INR', 'Indian rupee', '₹', 2],
  ['IQD', 'Iraqi dinar', 'ع.د', 3], ['IRR', 'Iranian rial', '﷼', 2],
  ['ISK', 'Icelandic króna', 'kr', 0], ['JMD', 'Jamaican dollar', '$', 2],
  ['JOD', 'Jordanian dinar', 'د.ا', 3], ['JPY', 'Japanese yen', '¥', 0],
  ['KES', 'Kenyan shilling', 'KSh', 2], ['KGS', 'Kyrgyzstani som', 'с', 2],
  ['KHR', 'Cambodian riel', '៛', 2], ['KMF', 'Comorian franc', 'CF', 0],
  ['KRW', 'South Korean won', '₩', 0], ['KWD', 'Kuwaiti dinar', 'د.ك', 3],
  ['KYD', 'Cayman Islands dollar', '$', 2], ['KZT', 'Kazakhstani tenge', '₸', 2],
  ['LAK', 'Lao kip', '₭', 2], ['LBP', 'Lebanese pound', 'ل.ل', 2],
  ['LKR', 'Sri Lankan rupee', 'Rs', 2], ['LRD', 'Liberian dollar', '$', 2],
  ['LSL', 'Lesotho loti', 'L', 2], ['LYD', 'Libyan dinar', 'ل.د', 3],
  ['MAD', 'Moroccan dirham', 'د.م.', 2], ['MDL', 'Moldovan leu', 'L', 2],
  ['MGA', 'Malagasy ariary', 'Ar', 2], ['MKD', 'Macedonian denar', 'ден', 2],
  ['MMK', 'Myanmar kyat', 'K', 2], ['MNT', 'Mongolian tögrög', '₮', 2],
  ['MOP', 'Macanese pataca', 'MOP$', 2], ['MUR', 'Mauritian rupee', '₨', 2],
  ['MVR', 'Maldivian rufiyaa', '.ރ', 2], ['MWK', 'Malawian kwacha', 'MK', 2],
  ['MXN', 'Mexican peso', '$', 2], ['MYR', 'Malaysian ringgit', 'RM', 2],
  ['MZN', 'Mozambican metical', 'MT', 2], ['NAD', 'Namibian dollar', '$', 2],
  ['NGN', 'Nigerian naira', '₦', 2], ['NIO', 'Nicaraguan córdoba', 'C$', 2],
  ['NOK', 'Norwegian krone', 'kr', 2], ['NPR', 'Nepalese rupee', 'रू', 2],
  ['NZD', 'New Zealand dollar', 'NZ$', 2], ['OMR', 'Omani rial', 'ر.ع.', 3],
  ['PAB', 'Panamanian balboa', 'B/.', 2], ['PEN', 'Peruvian sol', 'S/', 2],
  ['PGK', 'Papua New Guinean kina', 'K', 2], ['PHP', 'Philippine peso', '₱', 2],
  ['PKR', 'Pakistani rupee', '₨', 2], ['PLN', 'Polish złoty', 'zł', 2],
  ['PYG', 'Paraguayan guaraní', '₲', 0], ['QAR', 'Qatari riyal', 'ر.ق', 2],
  ['RON', 'Romanian leu', 'lei', 2], ['RSD', 'Serbian dinar', 'дин', 2],
  ['RUB', 'Russian rouble', '₽', 2], ['RWF', 'Rwandan franc', 'FRw', 0],
  ['SAR', 'Saudi riyal', 'ر.س', 2], ['SBD', 'Solomon Islands dollar', '$', 2],
  ['SCR', 'Seychellois rupee', '₨', 2], ['SDG', 'Sudanese pound', 'ج.س.', 2],
  ['SEK', 'Swedish krona', 'kr', 2], ['SGD', 'Singapore dollar', 'S$', 2],
  ['SLE', 'Sierra Leonean leone', 'Le', 2], ['SOS', 'Somali shilling', 'Sh', 2],
  ['SRD', 'Surinamese dollar', '$', 2], ['SSP', 'South Sudanese pound', '£', 2],
  ['SVC', 'Salvadoran colón', '₡', 2], ['SYP', 'Syrian pound', '£', 2],
  ['SZL', 'Eswatini lilangeni', 'L', 2], ['THB', 'Thai baht', '฿', 2],
  ['TJS', 'Tajikistani somoni', 'SM', 2], ['TMT', 'Turkmenistani manat', 'm', 2],
  ['TND', 'Tunisian dinar', 'د.ت', 3], ['TOP', 'Tongan paʻanga', 'T$', 2],
  ['TRY', 'Turkish lira', '₺', 2], ['TTD', 'Trinidad & Tobago dollar', '$', 2],
  ['TWD', 'New Taiwan dollar', 'NT$', 2], ['TZS', 'Tanzanian shilling', 'TSh', 2],
  ['UAH', 'Ukrainian hryvnia', '₴', 2], ['UGX', 'Ugandan shilling', 'USh', 0],
  ['USD', 'US dollar', '$', 2], ['UYU', 'Uruguayan peso', '$', 2],
  ['UZS', 'Uzbekistani sum', "so'm", 2], ['VES', 'Venezuelan bolívar', 'Bs.', 2],
  ['VND', 'Vietnamese đồng', '₫', 0], ['VUV', 'Vanuatu vatu', 'VT', 0],
  ['WST', 'Samoan tālā', 'T', 2], ['XAF', 'Central African CFA franc', 'FCFA', 0],
  ['XCD', 'East Caribbean dollar', '$', 2], ['XOF', 'West African CFA franc', 'CFA', 0],
  ['XPF', 'CFP franc', '₣', 0], ['YER', 'Yemeni rial', '﷼', 2],
  ['ZAR', 'South African rand', 'R', 2], ['ZMW', 'Zambian kwacha', 'ZK', 2],
  ['ZWG', 'Zimbabwe gold', 'ZiG', 2],
] as const satisfies readonly (readonly [string, string, string, 0 | 2 | 3])[];

export type CurrencyCode = (typeof TABLE)[number][0];

export type CurrencyEntry = {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  readonly minorUnits: 0 | 2 | 3;
};

export const CURRENCIES: readonly CurrencyEntry[] = TABLE.map(
  ([code, name, symbol, minorUnits]) => ({ code, name, symbol, minorUnits }),
);

const BY_CODE = new Map<string, CurrencyEntry>(CURRENCIES.map((entry) => [entry.code, entry]));

export const CURRENCY_CODES: readonly CurrencyCode[] = CURRENCIES.map((entry) => entry.code);

export function currencyEntry(code: string): CurrencyEntry | undefined {
  return BY_CODE.get(code);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && BY_CODE.has(value);
}

/**
 * Home markets first, then everything else alphabetically by name — a rider in
 * Dhaka should not scroll past the Afghan afghani to reach the taka.
 */
export const CURRENCY_PICKER_ORDER: readonly CurrencyEntry[] = [
  ...PRIORITY.map((code) => BY_CODE.get(code)!),
  ...CURRENCIES.filter(
    (entry) => !(PRIORITY as readonly string[]).includes(entry.code),
  ).sort(
    (a, b) => a.name.localeCompare(b.name),
  ),
];

/** Matches a code, a name or a symbol, so "yen", "JPY" and "¥" all find it. */
export function searchCurrencies(term: string): readonly CurrencyEntry[] {
  const needle = term.trim().toLowerCase();
  if (needle === '') return CURRENCY_PICKER_ORDER;
  return CURRENCY_PICKER_ORDER.filter(
    (entry) =>
      entry.code.toLowerCase().includes(needle) ||
      entry.name.toLowerCase().includes(needle) ||
      entry.symbol.toLowerCase().includes(needle),
  );
}

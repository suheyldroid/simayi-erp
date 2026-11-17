import createError from "http-errors";

type Currency = {
  readonly code: string;
  readonly name: string;
  readonly fractionDigits: number;
};

/**
 * Server-owned ISO 4217 catalog snapshot taken from the official SIX list-one
 * feed published 2026-09-17 (`Ccy`, `CcyNm`, `CcyMnrUnts`). It is a static
 * constant: no runtime network call, ICU lookup, database row or dependency
 * contributes identity, display name or minor-unit digits.
 *
 * Included: circulating national currencies. Excluded on purpose: funds and
 * units of account (BOV, CHE, CHW, CLF, COU, MXV, USN, UYI, UYW, XAD, XBA-XBD,
 * XDR, XSU, XUA), precious metals (XAG, XAU, XPD, XPT), testing codes (XTS) and
 * the no-currency code (XXX), matching this product's existing policy.
 *
 * Retired codes are absent: ANG was replaced by XCG on 2025-03-31 and BGN was
 * replaced by EUR on 2026-01-01. This list is the authority for NEW selections
 * only. Currency codes already stored on a purchase-order line are historical
 * facts and are never renamed, converted or re-validated against it.
 */
const catalog: readonly Currency[] = [
  { code: "AED", name: "UAE Dirham", fractionDigits: 2 },
  { code: "AFN", name: "Afghani", fractionDigits: 2 },
  { code: "ALL", name: "Lek", fractionDigits: 2 },
  { code: "AMD", name: "Armenian Dram", fractionDigits: 2 },
  { code: "AOA", name: "Kwanza", fractionDigits: 2 },
  { code: "ARS", name: "Argentine Peso", fractionDigits: 2 },
  { code: "AUD", name: "Australian Dollar", fractionDigits: 2 },
  { code: "AWG", name: "Aruban Florin", fractionDigits: 2 },
  { code: "AZN", name: "Azerbaijan Manat", fractionDigits: 2 },
  { code: "BAM", name: "Convertible Mark", fractionDigits: 2 },
  { code: "BBD", name: "Barbados Dollar", fractionDigits: 2 },
  { code: "BDT", name: "Taka", fractionDigits: 2 },
  { code: "BHD", name: "Bahraini Dinar", fractionDigits: 3 },
  { code: "BIF", name: "Burundi Franc", fractionDigits: 0 },
  { code: "BMD", name: "Bermudian Dollar", fractionDigits: 2 },
  { code: "BND", name: "Brunei Dollar", fractionDigits: 2 },
  { code: "BOB", name: "Boliviano", fractionDigits: 2 },
  { code: "BRL", name: "Brazilian Real", fractionDigits: 2 },
  { code: "BSD", name: "Bahamian Dollar", fractionDigits: 2 },
  { code: "BTN", name: "Ngultrum", fractionDigits: 2 },
  { code: "BWP", name: "Pula", fractionDigits: 2 },
  { code: "BYN", name: "Belarusian Ruble", fractionDigits: 2 },
  { code: "BZD", name: "Belize Dollar", fractionDigits: 2 },
  { code: "CAD", name: "Canadian Dollar", fractionDigits: 2 },
  { code: "CDF", name: "Congolese Franc", fractionDigits: 2 },
  { code: "CHF", name: "Swiss Franc", fractionDigits: 2 },
  { code: "CLP", name: "Chilean Peso", fractionDigits: 0 },
  { code: "CNY", name: "Yuan Renminbi", fractionDigits: 2 },
  { code: "COP", name: "Colombian Peso", fractionDigits: 2 },
  { code: "CRC", name: "Costa Rican Colon", fractionDigits: 2 },
  { code: "CUP", name: "Cuban Peso", fractionDigits: 2 },
  { code: "CVE", name: "Cabo Verde Escudo", fractionDigits: 2 },
  { code: "CZK", name: "Czech Koruna", fractionDigits: 2 },
  { code: "DJF", name: "Djibouti Franc", fractionDigits: 0 },
  { code: "DKK", name: "Danish Krone", fractionDigits: 2 },
  { code: "DOP", name: "Dominican Peso", fractionDigits: 2 },
  { code: "DZD", name: "Algerian Dinar", fractionDigits: 2 },
  { code: "EGP", name: "Egyptian Pound", fractionDigits: 2 },
  { code: "ERN", name: "Nakfa", fractionDigits: 2 },
  { code: "ETB", name: "Ethiopian Birr", fractionDigits: 2 },
  { code: "EUR", name: "Euro", fractionDigits: 2 },
  { code: "FJD", name: "Fiji Dollar", fractionDigits: 2 },
  { code: "FKP", name: "Falkland Islands Pound", fractionDigits: 2 },
  { code: "GBP", name: "Pound Sterling", fractionDigits: 2 },
  { code: "GEL", name: "Lari", fractionDigits: 2 },
  { code: "GHS", name: "Ghana Cedi", fractionDigits: 2 },
  { code: "GIP", name: "Gibraltar Pound", fractionDigits: 2 },
  { code: "GMD", name: "Dalasi", fractionDigits: 2 },
  { code: "GNF", name: "Guinean Franc", fractionDigits: 0 },
  { code: "GTQ", name: "Quetzal", fractionDigits: 2 },
  { code: "GYD", name: "Guyana Dollar", fractionDigits: 2 },
  { code: "HKD", name: "Hong Kong Dollar", fractionDigits: 2 },
  { code: "HNL", name: "Lempira", fractionDigits: 2 },
  { code: "HTG", name: "Gourde", fractionDigits: 2 },
  { code: "HUF", name: "Forint", fractionDigits: 2 },
  { code: "IDR", name: "Rupiah", fractionDigits: 2 },
  { code: "ILS", name: "New Israeli Sheqel", fractionDigits: 2 },
  { code: "INR", name: "Indian Rupee", fractionDigits: 2 },
  { code: "IQD", name: "Iraqi Dinar", fractionDigits: 3 },
  { code: "IRR", name: "Iranian Rial", fractionDigits: 2 },
  { code: "ISK", name: "Iceland Krona", fractionDigits: 0 },
  { code: "JMD", name: "Jamaican Dollar", fractionDigits: 2 },
  { code: "JOD", name: "Jordanian Dinar", fractionDigits: 3 },
  { code: "JPY", name: "Yen", fractionDigits: 0 },
  { code: "KES", name: "Kenyan Shilling", fractionDigits: 2 },
  { code: "KGS", name: "Som", fractionDigits: 2 },
  { code: "KHR", name: "Riel", fractionDigits: 2 },
  { code: "KMF", name: "Comorian Franc", fractionDigits: 0 },
  { code: "KPW", name: "North Korean Won", fractionDigits: 2 },
  { code: "KRW", name: "Won", fractionDigits: 0 },
  { code: "KWD", name: "Kuwaiti Dinar", fractionDigits: 3 },
  { code: "KYD", name: "Cayman Islands Dollar", fractionDigits: 2 },
  { code: "KZT", name: "Tenge", fractionDigits: 2 },
  { code: "LAK", name: "Lao Kip", fractionDigits: 2 },
  { code: "LBP", name: "Lebanese Pound", fractionDigits: 2 },
  { code: "LKR", name: "Sri Lanka Rupee", fractionDigits: 2 },
  { code: "LRD", name: "Liberian Dollar", fractionDigits: 2 },
  { code: "LSL", name: "Loti", fractionDigits: 2 },
  { code: "LYD", name: "Libyan Dinar", fractionDigits: 3 },
  { code: "MAD", name: "Moroccan Dirham", fractionDigits: 2 },
  { code: "MDL", name: "Moldovan Leu", fractionDigits: 2 },
  { code: "MGA", name: "Malagasy Ariary", fractionDigits: 2 },
  { code: "MKD", name: "Denar", fractionDigits: 2 },
  { code: "MMK", name: "Kyat", fractionDigits: 2 },
  { code: "MNT", name: "Tugrik", fractionDigits: 2 },
  { code: "MOP", name: "Pataca", fractionDigits: 2 },
  { code: "MRU", name: "Ouguiya", fractionDigits: 2 },
  { code: "MUR", name: "Mauritius Rupee", fractionDigits: 2 },
  { code: "MVR", name: "Rufiyaa", fractionDigits: 2 },
  { code: "MWK", name: "Malawi Kwacha", fractionDigits: 2 },
  { code: "MXN", name: "Mexican Peso", fractionDigits: 2 },
  { code: "MYR", name: "Malaysian Ringgit", fractionDigits: 2 },
  { code: "MZN", name: "Mozambique Metical", fractionDigits: 2 },
  { code: "NAD", name: "Namibia Dollar", fractionDigits: 2 },
  { code: "NGN", name: "Naira", fractionDigits: 2 },
  { code: "NIO", name: "Cordoba Oro", fractionDigits: 2 },
  { code: "NOK", name: "Norwegian Krone", fractionDigits: 2 },
  { code: "NPR", name: "Nepalese Rupee", fractionDigits: 2 },
  { code: "NZD", name: "New Zealand Dollar", fractionDigits: 2 },
  { code: "OMR", name: "Rial Omani", fractionDigits: 3 },
  { code: "PAB", name: "Balboa", fractionDigits: 2 },
  { code: "PEN", name: "Sol", fractionDigits: 2 },
  { code: "PGK", name: "Kina", fractionDigits: 2 },
  { code: "PHP", name: "Philippine Peso", fractionDigits: 2 },
  { code: "PKR", name: "Pakistan Rupee", fractionDigits: 2 },
  { code: "PLN", name: "Zloty", fractionDigits: 2 },
  { code: "PYG", name: "Guarani", fractionDigits: 0 },
  { code: "QAR", name: "Qatari Rial", fractionDigits: 2 },
  { code: "RON", name: "Romanian Leu", fractionDigits: 2 },
  { code: "RSD", name: "Serbian Dinar", fractionDigits: 2 },
  { code: "RUB", name: "Russian Ruble", fractionDigits: 2 },
  { code: "RWF", name: "Rwanda Franc", fractionDigits: 0 },
  { code: "SAR", name: "Saudi Riyal", fractionDigits: 2 },
  { code: "SBD", name: "Solomon Islands Dollar", fractionDigits: 2 },
  { code: "SCR", name: "Seychelles Rupee", fractionDigits: 2 },
  { code: "SDG", name: "Sudanese Pound", fractionDigits: 2 },
  { code: "SEK", name: "Swedish Krona", fractionDigits: 2 },
  { code: "SGD", name: "Singapore Dollar", fractionDigits: 2 },
  { code: "SHP", name: "Saint Helena Pound", fractionDigits: 2 },
  { code: "SLE", name: "Leone", fractionDigits: 2 },
  { code: "SOS", name: "Somali Shilling", fractionDigits: 2 },
  { code: "SRD", name: "Surinam Dollar", fractionDigits: 2 },
  { code: "SSP", name: "South Sudanese Pound", fractionDigits: 2 },
  { code: "STN", name: "Dobra", fractionDigits: 2 },
  { code: "SVC", name: "El Salvador Colon", fractionDigits: 2 },
  { code: "SYP", name: "Syrian Pound", fractionDigits: 2 },
  { code: "SZL", name: "Lilangeni", fractionDigits: 2 },
  { code: "THB", name: "Baht", fractionDigits: 2 },
  { code: "TJS", name: "Somoni", fractionDigits: 2 },
  { code: "TMT", name: "Turkmenistan New Manat", fractionDigits: 2 },
  { code: "TND", name: "Tunisian Dinar", fractionDigits: 3 },
  { code: "TOP", name: "Pa’anga", fractionDigits: 2 },
  { code: "TRY", name: "Turkish Lira", fractionDigits: 2 },
  { code: "TTD", name: "Trinidad and Tobago Dollar", fractionDigits: 2 },
  { code: "TWD", name: "New Taiwan Dollar", fractionDigits: 2 },
  { code: "TZS", name: "Tanzanian Shilling", fractionDigits: 2 },
  { code: "UAH", name: "Hryvnia", fractionDigits: 2 },
  { code: "UGX", name: "Uganda Shilling", fractionDigits: 0 },
  { code: "USD", name: "US Dollar", fractionDigits: 2 },
  { code: "UYU", name: "Peso Uruguayo", fractionDigits: 2 },
  { code: "UZS", name: "Uzbekistan Sum", fractionDigits: 2 },
  { code: "VED", name: "Bolívar Soberano", fractionDigits: 2 },
  { code: "VES", name: "Bolívar Soberano", fractionDigits: 2 },
  { code: "VND", name: "Dong", fractionDigits: 0 },
  { code: "VUV", name: "Vatu", fractionDigits: 0 },
  { code: "WST", name: "Tala", fractionDigits: 2 },
  { code: "XAF", name: "CFA Franc BEAC", fractionDigits: 0 },
  { code: "XCD", name: "East Caribbean Dollar", fractionDigits: 2 },
  { code: "XCG", name: "Caribbean Guilder", fractionDigits: 2 },
  { code: "XOF", name: "CFA Franc BCEAO", fractionDigits: 0 },
  { code: "XPF", name: "CFP Franc", fractionDigits: 0 },
  { code: "YER", name: "Yemeni Rial", fractionDigits: 2 },
  { code: "ZAR", name: "Rand", fractionDigits: 2 },
  { code: "ZMW", name: "Zambian Kwacha", fractionDigits: 2 },
  { code: "ZWG", name: "Zimbabwe Gold", fractionDigits: 2 },
].sort((left, right) => (left.code < right.code ? -1 : 1));

const activeCodes: ReadonlySet<string> = new Set(
  catalog.map((currency) => currency.code),
);

/**
 * Server-owned currency policy. There is no CRUD, no rate data and no
 * conversion: callers may only accept or reject a code and echo the catalog.
 */
export abstract class CurrencyCatalog {
  static items(): readonly Currency[] {
    return catalog;
  }

  /** Canonical uppercase active code, or 422 when it cannot be selected. */
  static canonical(value: string): string {
    const code = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || !activeCodes.has(code))
      throw new createError.UnprocessableEntity("Unsupported currency code");
    return code;
  }

  /** True when a stored code is in the current selectable catalog. */
  static active(value: string): boolean {
    return activeCodes.has(value);
  }
}

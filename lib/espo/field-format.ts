// Định dạng giá trị field để hiển thị: địa chỉ, tiền tệ, tên người. Port từ `views/fields/address`
// (getFormattedAddress1..4 @47519), `views/fields/currency` (@45640) và `person-name`.
import type { NumberFormat } from "./format";

type Values = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

/** Địa chỉ theo `settings.addressFormat` (1–4), mỗi dòng cách nhau `\n`. */
export function formatAddress(name: string, values: Values, format = 1): string {
  const street = text(values[`${name}Street`]);
  const city = text(values[`${name}City`]);
  const state = text(values[`${name}State`]);
  const country = text(values[`${name}Country`]);
  const postalCode = text(values[`${name}PostalCode`]);
  const lines: string[] = [];

  switch (format) {
    case 2:
      lines.push(street, [postalCode, city].filter(Boolean).join(" "), [state, country].filter(Boolean).join(" "));
      break;
    case 3:
      lines.push(country, [postalCode, state, city].filter(Boolean).join(" "), street);
      break;
    case 4:
      lines.push(
        street,
        city,
        [[country, state].filter(Boolean).join(" - "), postalCode].filter(Boolean).join(" "),
      );
      break;
    default: {
      let cityLine = city;

      if (state) {
        cityLine += (city ? ", " : "") + state;
      }

      if (postalCode) {
        cityLine += (city || state ? " " : "") + postalCode;
      }

      lines.push(street, cityLine, country);
    }
  }

  return lines.filter(Boolean).join("\n");
}

export type CurrencyOptions = {
  /** `settings.currencyFormat`: 1 = "1,000.00 USD", 2 = "$1,000.00", 3 = "1,000.00 $". */
  currencyFormat?: number;
  /** `settings.currencyDecimalPlaces` hoặc `decimalPlaces` của field; `null` = tối đa 3 chữ số. */
  decimalPlaces?: number | null;
  symbolMap?: Record<string, string>;
};

/** Số tiền theo `formatNumberDetail` của classic (làm tròn, đệm số 0, dấu phân cách của người dùng). */
export function formatCurrencyAmount(value: number, numbers: NumberFormat, decimalPlaces: number | null | undefined): string {
  if (decimalPlaces === 0) {
    return numbers.formatFloat(value, 0);
  }

  if (decimalPlaces) {
    return numbers.formatFloat(value, decimalPlaces);
  }

  // Classic: tối đa 3 chữ số thập phân, không đệm.
  return numbers.formatFloat(Math.round(value * 1000) / 1000);
}

export function formatCurrency(
  value: unknown,
  currency: string | null | undefined,
  numbers: NumberFormat,
  options: CurrencyOptions = {},
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  const amount = formatCurrencyAmount(value, numbers, options.decimalPlaces);
  const code = currency ?? "";
  const symbol = options.symbolMap?.[code] ?? "";

  switch (options.currencyFormat) {
    case 2:
      return `${symbol}${amount}`;
    case 3:
      return `${amount} ${symbol}`.trim();
    default:
      return `${amount} ${code}`.trim();
  }
}

/**
 * Họ tên theo `settings.personNameFormat` (mặc định `firstLast`), kèm danh xưng đã dịch.
 */
export function formatPersonName(
  name: string,
  values: Values,
  format = "firstLast",
  translateSalutation: (value: string) => string = (value) => value,
): string {
  const suffix = name.charAt(0).toUpperCase() + name.slice(1);
  const salutation = text(values[`salutation${suffix}`]);
  const first = text(values[`first${suffix}`]);
  const last = text(values[`last${suffix}`]);
  const middle = text(values[`middle${suffix}`]);
  const parts =
    format === "lastFirst"
      ? [last, first]
      : format === "firstMiddleLast"
        ? [first, middle, last]
        : format === "lastFirstMiddle"
          ? [last, first, middle]
          : [first, last];
  const full = parts.filter(Boolean).join(" ");

  if (!full) {
    return text(values[name]);
  }

  return salutation ? `${translateSalutation(salutation)} ${full}` : full;
}

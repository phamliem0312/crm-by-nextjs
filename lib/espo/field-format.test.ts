import { describe, expect, it } from "vitest";
import { formatAddress, formatCurrency, formatPersonName } from "./field-format";
import { NumberFormat } from "./format";

const address = {
  billingAddressStreet: "1 Main St",
  billingAddressCity: "Springfield",
  billingAddressState: "IL",
  billingAddressPostalCode: "62701",
  billingAddressCountry: "USA",
};

describe("formatAddress (port getFormattedAddress1..4)", () => {
  it.each([
    [1, "1 Main St\nSpringfield, IL 62701\nUSA"],
    [2, "1 Main St\n62701 Springfield\nIL USA"],
    [3, "USA\n62701 IL Springfield\n1 Main St"],
    [4, "1 Main St\nSpringfield\nUSA - IL 62701"],
  ])("format %i", (format, expected) => {
    expect(formatAddress("billingAddress", address, format)).toBe(expected);
  });

  it("skips empty parts", () => {
    expect(formatAddress("billingAddress", { billingAddressCity: "Hanoi", billingAddressCountry: "Vietnam" })).toBe(
      "Hanoi\nVietnam",
    );
    expect(formatAddress("billingAddress", {})).toBe("");
  });
});

describe("formatCurrency (port currency detail-1..3)", () => {
  const numbers = new NumberFormat({ thousandSeparator: ",", decimalMark: "." });

  it("formats by currencyFormat", () => {
    const symbolMap = { USD: "$" };

    expect(formatCurrency(1234.5, "USD", numbers, { currencyFormat: 1, decimalPlaces: 2 })).toBe("1,234.50 USD");
    expect(formatCurrency(1234.5, "USD", numbers, { currencyFormat: 2, decimalPlaces: 2, symbolMap })).toBe("$1,234.50");
    expect(formatCurrency(1234.5, "USD", numbers, { currencyFormat: 3, decimalPlaces: 2, symbolMap })).toBe("1,234.50 $");
  });

  it("keeps up to 3 decimals when decimalPlaces is not set", () => {
    expect(formatCurrency(10.12345, "EUR", numbers)).toBe("10.123 EUR");
    expect(formatCurrency(10, "EUR", numbers, { decimalPlaces: 0 })).toBe("10 EUR");
  });

  it("returns empty for non-numbers", () => {
    expect(formatCurrency(null, "USD", numbers)).toBe("");
  });
});

describe("formatPersonName", () => {
  const values = { salutationName: "Mr.", firstName: "John", lastName: "Doe", middleName: "Q", name: "John Doe" };

  it("uses the configured order and salutation", () => {
    expect(formatPersonName("name", values)).toBe("Mr. John Doe");
    expect(formatPersonName("name", values, "lastFirst")).toBe("Mr. Doe John");
    expect(formatPersonName("name", values, "firstMiddleLast", () => "Ông")).toBe("Ông John Q Doe");
  });

  it("falls back to the name attribute", () => {
    expect(formatPersonName("name", { name: "Alice Anderson" })).toBe("Alice Anderson");
  });
});

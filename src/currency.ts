export interface Denomination {
  readonly value: number;
  readonly singular: string;
  readonly plural: string;
}

export type CurrencyCode = "USD" | "EUR";

function denomination(
  value: number,
  singular: string,
  plural: string,
): Denomination {
  return Object.freeze({ value, singular, plural });
}

// These are the denominations stocked by the example tills, in descending order.
// Both tables are canonical for greedy change and include a one-cent denomination.
const USD = Object.freeze([
  ...[100, 50, 20, 10, 5].map((value) =>
    denomination(value * 100, `${value}-dollar bill`, `${value}-dollar bills`),
  ),
  denomination(100, "dollar", "dollars"),
  denomination(25, "quarter", "quarters"),
  denomination(10, "dime", "dimes"),
  denomination(5, "nickel", "nickels"),
  denomination(1, "penny", "pennies"),
]);

const EUR = Object.freeze([
  ...[200, 100, 50, 20, 10, 5].map((value) =>
    denomination(value * 100, `${value}-euro note`, `${value}-euro notes`),
  ),
  denomination(200, "2-euro coin", "2-euro coins"),
  denomination(100, "1-euro coin", "1-euro coins"),
  ...[50, 20, 10, 5, 2, 1].map((value) =>
    denomination(value, `${value}-cent coin`, `${value}-cent coins`),
  ),
]);

export function denominationsFor(
  currency: CurrencyCode,
): readonly Denomination[] {
  switch (currency) {
    case "USD":
      return USD;
    case "EUR":
      return EUR;
    default:
      throw new Error("Currency must be USD or EUR.");
  }
}

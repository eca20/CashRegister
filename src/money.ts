// Both supported currencies use two decimal places. No floating-point parsing.
export const MAX_CENTS = 1_000_000_000;

export function assertCents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new Error("Amount must be an integer from 0 to 1,000,000,000 cents.");
  }
}

export function parseMoney(text: string): number {
  const value = text.trim();
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(value)) {
    throw new Error(
      "Expected a nonnegative amount with at most two decimal places.",
    );
  }
  const [whole = "", fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(MAX_CENTS)) {
    throw new Error("Amount exceeds the supported maximum of 10000000.00.");
  }
  return Number(cents);
}

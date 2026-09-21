import { assertCents, MAX_CENTS, parseMoney } from "../src/money.js";

export type AmountField = "owed" | "paid";
export type Amounts = Readonly<Record<AmountField, number>>;
export type EntryKey = "clear" | "backspace" | "00" | `${number}`;

export function amountText(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function enterCents(current: number, key: EntryKey): number {
  if (key === "clear") return 0;
  if (key === "backspace") return Math.floor(current / 10);
  if (!/^\d{1,2}$/.test(key)) throw new Error("Use digit keys to enter cents.");
  const next = current * 10 ** key.length + Number(key);
  if (next > MAX_CENTS)
    throw new Error(
      "Maximum amount is 10000000.00. The last entry was not applied.",
    );
  assertCents(next);
  return next;
}

export function pastedCents(text: string): number {
  const value = text.trim();
  if (value.includes(".")) return parseMoney(value);
  if (!/^\d+$/.test(value))
    throw new Error("Paste digits for cents, or an amount such as 2.13.");
  const cents = BigInt(value);
  if (cents > BigInt(MAX_CENTS))
    throw new Error(
      "Maximum amount is 10000000.00. The paste was not applied.",
    );
  return Number(cents);
}

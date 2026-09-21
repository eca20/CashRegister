import {
  formatChange,
  minimumChange,
  randomChange,
  validateChange,
} from "./change.js";
import type { ChangeStrategy, RandomSource } from "./change.js";
import { denominationsFor } from "./currency.js";
import type { CurrencyCode } from "./currency.js";
import { assertCents, parseMoney } from "./money.js";

export interface Transaction {
  readonly owed: number;
  readonly paid: number;
}

export interface Rule {
  readonly matches: (transaction: Transaction) => boolean;
  readonly strategy: ChangeStrategy;
}

export function divisibleBy(divisor: number): Rule {
  if (!Number.isSafeInteger(divisor) || divisor < 1) {
    throw new Error("Divisor must be a positive safe integer.");
  }
  return {
    matches: ({ owed }) => owed % divisor === 0,
    strategy: randomChange,
  };
}

export interface RegisterOptions {
  readonly currency?: CurrencyCode;
  readonly rules?: readonly Rule[];
  readonly random?: RandomSource;
}

export function createRegister(options: RegisterOptions = {}) {
  const currency = options.currency ?? "USD";
  denominationsFor(currency);
  const rules = [...(options.rules ?? [divisibleBy(3)])];
  const random = options.random ?? Math.random;

  return (transaction: Transaction): string => {
    assertCents(transaction.owed);
    assertCents(transaction.paid);
    if (transaction.paid < transaction.owed) {
      throw new Error("Amount paid is less than amount owed.");
    }
    const cents = transaction.paid - transaction.owed;
    // First matching rule wins; no match uses the minimum-piece strategy.
    const strategy =
      rules.find((rule) => rule.matches(transaction))?.strategy ??
      minimumChange;
    const items = strategy(cents, currency, random);
    validateChange(items, cents, currency);
    return formatChange(items);
  };
}

export function parseTransaction(line: string): Transaction {
  const fields = line.split(",");
  if (fields.length !== 2)
    throw new Error("Expected exactly two fields: owed,paid.");
  return Object.freeze({
    owed: parseMoney(fields[0]!),
    paid: parseMoney(fields[1]!),
  });
}

export function processFile(
  text: string,
  options: RegisterOptions = {},
): string {
  const register = createRegister(options);
  // Permit a UTF-8 BOM and a single final newline. Blank data rows are errors.
  const contents = text.replace(/^\uFEFF/, "");
  if (contents === "") return "";
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const output = lines.map((line, index) => {
    try {
      return register(parseTransaction(line));
    } catch (error) {
      throw new Error(
        `Line ${index + 1}: ${error instanceof Error ? error.message : "Processing failed."}`,
      );
    }
  });
  return `${output.join("\n")}\n`;
}

import { denominationsFor } from "./currency.js";
import type { CurrencyCode, Denomination } from "./currency.js";
import { assertCents } from "./money.js";

export interface ChangeItem {
  readonly denomination: Denomination;
  readonly count: number;
}

export type RandomSource = () => number;
export type ChangeStrategy = (
  cents: number,
  currency: CurrencyCode,
  random: RandomSource,
) => readonly ChangeItem[];

export const minimumChange: ChangeStrategy = (cents, currency) => {
  assertCents(cents);
  let remaining = cents;
  const result: ChangeItem[] = [];
  for (const denomination of denominationsFor(currency)) {
    const count = Math.floor(remaining / denomination.value);
    if (count > 0) result.push({ denomination, count });
    remaining -= count * denomination.value;
  }
  return result;
};

// Randomize each non-penny count; the one-cent denomination closes the balance.
// O(number of denominations), including for large amounts. This is not a uniform
// sample of every possible partition, which the exercise does not require.
export const randomChange: ChangeStrategy = (cents, currency, random) => {
  assertCents(cents);
  let remaining = cents;
  const result: ChangeItem[] = [];
  for (const denomination of denominationsFor(currency)) {
    const maximum = Math.floor(remaining / denomination.value);
    if (maximum === 0) continue;
    let count = maximum;
    if (denomination.value !== 1) {
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
        throw new Error("Random source must return a number in [0, 1).");
      }
      count = Math.floor(draw * (maximum + 1));
    }
    if (count > 0) result.push({ denomination, count });
    remaining -= count * denomination.value;
  }
  return result;
};

// Check extension strategies at the boundary before their results reach a cashier.
export function validateChange(
  items: readonly ChangeItem[],
  cents: number,
  currency: CurrencyCode,
): void {
  const allowed = denominationsFor(currency);
  const seen = new Set<number>();
  let total = 0;
  for (const { denomination, count } of items) {
    if (
      !allowed.includes(denomination) ||
      seen.has(denomination.value) ||
      !Number.isSafeInteger(count) ||
      count <= 0
    ) {
      throw new Error("Strategy returned an invalid denomination or count.");
    }
    seen.add(denomination.value);
    total += denomination.value * count;
    if (!Number.isSafeInteger(total) || total > cents) {
      throw new Error("Strategy returned an incorrect change total.");
    }
  }
  if (total !== cents)
    throw new Error("Strategy returned an incorrect change total.");
}

export function formatChange(items: readonly ChangeItem[]): string {
  if (items.length === 0) return "No change due";
  return [...items]
    .sort((a, b) => b.denomination.value - a.denomination.value)
    .map(
      ({ denomination, count }) =>
        `${count} ${count === 1 ? denomination.singular : denomination.plural}`,
    )
    .join(",");
}

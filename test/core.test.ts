import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CENTS, parseMoney } from "../src/money.js";
import { denominationsFor } from "../src/currency.js";
import type { CurrencyCode } from "../src/currency.js";
import {
  formatChange,
  minimumChange,
  randomChange,
  validateChange,
} from "../src/change.js";
import type { ChangeItem } from "../src/change.js";
import {
  createRegister,
  divisibleBy,
  parseTransaction,
  processFile,
} from "../src/register.js";

const total = (items: readonly ChangeItem[]) =>
  items.reduce((sum, item) => sum + item.count * item.denomination.value, 0);

test("decimal text is converted exactly, without rounding", () => {
  for (const [text, cents] of [
    ["0", 0],
    [" 2.13 ", 213],
    ["0.29", 29],
    ["1.1", 110],
    ["0001.01", 101],
    ["10000000.00", MAX_CENTS],
  ] as const) {
    assert.equal(parseMoney(text), cents);
  }
});

test("ambiguous, negative, non-finite, over-precision and out-of-range money is rejected", () => {
  for (const text of [
    "",
    " ",
    "-1",
    "+1",
    ".5",
    "1.",
    "1.001",
    "NaN",
    "Infinity",
    "1e2",
    "0x10",
    "$2.00",
    "1,00",
    "1 00",
    "10000000.01",
    "99999999999999999999",
  ]) {
    assert.throws(() => parseMoney(text), Error, text);
  }
});

test("transaction parser accepts surrounding whitespace and exactly two fields", () => {
  assert.deepEqual(parseTransaction(" 2.12 , 3.00 "), { owed: 212, paid: 300 });
  for (const text of [
    "",
    "2.12",
    "2.12,3.00,4.00",
    ",3.00",
    "2.12,",
    "owed,paid",
  ])
    assert.throws(() => parseTransaction(text));
});

test("official sample: exact deterministic rows and a valid controlled random row", () => {
  assert.equal(
    processFile("2.12,3.00\n1.97,2.00\n3.33,5.00\n", { random: () => 0 }),
    "3 quarters,1 dime,3 pennies\n3 pennies\n167 pennies\n",
  );
});

test("random rule uses owed cents, independently of paid or change", () => {
  const register = createRegister({ random: () => 0 });
  assert.equal(register({ owed: 333, paid: 500 }), "167 pennies");
  // Paid and change are each divisible by three in separate cases below.
  assert.equal(
    register({ owed: 212, paid: 300 }),
    "3 quarters,1 dime,3 pennies",
  );
  assert.equal(
    register({ owed: 101, paid: 200 }),
    "3 quarters,2 dimes,4 pennies",
  );
});

test("new divisor changes rule selection", () => {
  const register = createRegister({ rules: [divisibleBy(5)], random: () => 0 });
  assert.equal(register({ owed: 100, paid: 200 }), "100 pennies");
  assert.equal(
    register({ owed: 333, paid: 500 }),
    "1 dollar,2 quarters,1 dime,1 nickel,2 pennies",
  );
});

test("divisor rejects zero, negatives, fractions and unsafe integers", () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => divisibleBy(value));
  assert.equal(divisibleBy(1).matches({ owed: 37, paid: 100 }), true);
});

test("no change and underpayment are explicit", () => {
  const register = createRegister();
  assert.equal(register({ owed: 0, paid: 0 }), "No change due");
  assert.equal(register({ owed: 333, paid: 333 }), "No change due");
  assert.throws(() => register({ owed: 200, paid: 199 }), /less than/);
});

test("programmatic callers must supply bounded integer cents", () => {
  for (const value of [-1, 0.1, NaN, Infinity, MAX_CENTS + 1]) {
    assert.throws(() => createRegister()({ owed: value, paid: 200 }));
    assert.throws(() => createRegister()({ owed: 0, paid: value }));
    assert.throws(() => minimumChange(value, "USD", Math.random));
    assert.throws(() => randomChange(value, "USD", Math.random));
  }
});

test("EUR uses its own denominations and labels", () => {
  assert.equal(
    createRegister({ currency: "EUR", rules: [] })({ owed: 212, paid: 500 }),
    "1 2-euro coin,1 50-cent coin,1 20-cent coin,1 10-cent coin,1 5-cent coin,1 2-cent coin,1 1-cent coin",
  );
  assert.throws(() => denominationsFor("GBP" as CurrencyCode), /USD or EUR/);
});

test("formatting uses stable descending order, singular/plural, and omits zero counts", () => {
  const denominations = denominationsFor("USD");
  assert.equal(
    formatChange(minimumChange(101, "USD", Math.random)),
    "1 dollar,1 penny",
  );
  assert.equal(
    formatChange(minimumChange(202, "USD", Math.random)),
    "2 dollars,2 pennies",
  );
  assert.equal(
    formatChange([
      { denomination: denominations.at(-1)!, count: 2 },
      { denomination: denominations.find((d) => d.value === 100)!, count: 1 },
    ]),
    "1 dollar,2 pennies",
  );
});

test("new business rule composes without edits to processing or formatting", () => {
  const first = { matches: () => true, strategy: minimumChange };
  const register = createRegister({
    rules: [first, divisibleBy(3)],
    random: () => 0,
  });
  assert.equal(
    register({ owed: 333, paid: 500 }),
    "1 dollar,2 quarters,1 dime,1 nickel,2 pennies",
  );
  assert.equal(
    createRegister({ rules: [] })({ owed: 333, paid: 500 }),
    "1 dollar,2 quarters,1 dime,1 nickel,2 pennies",
  );
});

test("invalid extension strategies fail before formatting", () => {
  const penny = denominationsFor("USD").at(-1)!;
  const invalid: (readonly ChangeItem[])[] = [
    [],
    [{ denomination: penny, count: 99 }],
    [{ denomination: penny, count: 0 }],
    [{ denomination: penny, count: -1 }],
    [{ denomination: penny, count: 100.5 }],
    [{ denomination: penny, count: Infinity }],
    [
      {
        denomination: { value: 100, singular: "fake", plural: "fakes" },
        count: 1,
      },
    ],
    [
      { denomination: penny, count: 50 },
      { denomination: penny, count: 50 },
    ],
    [{ denomination: penny, count: Number.MAX_SAFE_INTEGER }],
  ];
  for (const items of invalid) {
    const register = createRegister({
      rules: [{ matches: () => true, strategy: () => items }],
    });
    assert.throws(() => register({ owed: 100, paid: 200 }), /Strategy/);
  }
});

test("random boundaries choose distinct valid outputs without flaky probability checks", () => {
  assert.equal(formatChange(randomChange(167, "USD", () => 0)), "167 pennies");
  assert.equal(
    formatChange(randomChange(167, "USD", () => 1 - Number.EPSILON)),
    "1 dollar,2 quarters,1 dime,1 nickel,2 pennies",
  );
  for (const draw of [-0.1, 1, NaN, Infinity])
    assert.throws(() => randomChange(100, "USD", () => draw), /Random source/);
});

test("randomness is unnecessary for zero change and a penny-only remainder", () => {
  const fail = () => {
    throw new Error("unexpected draw");
  };
  assert.deepEqual(randomChange(0, "USD", fail), []);
  assert.equal(formatChange(randomChange(3, "USD", fail)), "3 pennies");
});

test("random algorithm has bounded work at maximum amount", () => {
  for (const currency of ["USD", "EUR"] as const) {
    let calls = 0;
    const items = randomChange(MAX_CENTS, currency, () => {
      calls++;
      return 0;
    });
    assert.equal(total(items), MAX_CENTS);
    assert.equal(calls, denominationsFor(currency).length - 1);
    assert.equal(items.length, 1);
  }
});

for (const currency of ["USD", "EUR"] as const) {
  test(`${currency}: minimum-piece counts match independent DP oracle for every amount 0..50000`, () => {
    const coins = denominationsFor(currency).map((d) => d.value);
    // Independent recurrence: optimal[a] = 1 + min(optimal[a - coin]).
    const optimal = new Uint32Array(50_001);
    for (let amount = 1; amount < optimal.length; amount++) {
      let best = amount;
      for (const coin of coins)
        if (coin <= amount) best = Math.min(best, optimal[amount - coin]! + 1);
      optimal[amount] = best;
    }
    for (let amount = 0; amount < optimal.length; amount++) {
      const items = minimumChange(amount, currency, Math.random);
      assert.equal(total(items), amount);
      assert.equal(
        items.reduce((sum, item) => sum + item.count, 0),
        optimal[amount],
      );
    }
  });

  test(`${currency}: 5000 reproducible random cases preserve exact value and integer counts`, () => {
    let state = 123456789;
    // A deterministic test-data source, not the production random implementation.
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    for (let i = 0; i < 5000; i++) {
      const amount = Math.floor(random() * (MAX_CENTS + 1));
      const items = randomChange(amount, currency, random);
      assert.equal(total(items), amount);
      for (const item of items)
        assert.ok(Number.isSafeInteger(item.count) && item.count > 0);
      validateChange(items, amount, currency);
    }
  });
}

test("file parser handles BOM, CRLF, no final newline, and an empty file", () => {
  assert.equal(
    processFile("\uFEFF2.12,3.00\r\n1.97,2.00\r\n"),
    "3 quarters,1 dime,3 pennies\n3 pennies\n",
  );
  assert.equal(processFile("1.00,1.00"), "No change due\n");
  assert.equal(processFile(""), "");
  assert.equal(processFile("\uFEFF"), "");
});

test("invalid rows retain original line numbers; blank rows are not silently skipped", () => {
  assert.throws(() => processFile("2.12,3.00\n\n1.97,2.00"), /Line 2:/);
  assert.throws(
    () => processFile("2.12,3.00\n1.00,0.99"),
    /Line 2:.*less than/,
  );
  assert.throws(() => processFile("\n"), /Line 1:/);
  assert.throws(() => processFile("1.00,1.00\n\n"), /Line 2:/);
});

# Cash Register

A TypeScript solution to [TrueFit's exercise](docs/ORIGINAL_BRIEF.md). One calculation
core serves a file-to-file CLI and a React/Node web app. Money uses integer cents.
Normal transactions minimize physical pieces; owed amounts divisible by the
configured divisor receive randomized, exact change.

## Run

Requires Node.js 22.12+ and npm. No database, API keys or runtime services.

```sh
npm ci
npm run build
npm start -- examples/input.txt change.txt
cat change.txt
```

The first two lines are `3 quarters,1 dime,3 pennies` and `3 pennies`.
The third varies and sums to 167 cents; `167 pennies` is one valid result.

```sh
npm start -- examples/input.txt euro-change.txt --currency EUR --divisor 5
npm start -- --help
```

Output files must not already exist. Errors identify the offending line and return
a nonzero exit code. The original input and previous outputs cannot be overwritten.

## Web demo

```sh
npm run serve
```

Open [localhost:3000](http://127.0.0.1:3000). The page is the register: ivory raised
keys, recessed green displays, brushed-metal controls and a paper receipt, built
with CSS and ordinary HTML. It adapts from a two-column desktop workspace to a
single column on mobile.

- **Register** starts with both amounts at zero and owed selected. Click either
  display or the owed/paid key to select it. Digits enter cents: `213` becomes
  `2.13`. `00`, Backspace and Clear edit the selected amount. With a display
  focused, keyboard digits work the same way; Delete/Escape clear it. Select-all
  replaces the amount. Enter advances from owed to paid, then calculates.
- Paste digits as cents, or paste a decimal amount such as `2.13`. Pasting replaces
  the selected amount. Invalid or oversized entries show an error and preserve
  the previously accepted amount; they are never silently clamped.
- **Batch** keeps the editor, upload and sample workflow. Large batches preview
  the first 100 rows; downloads retain every row in the original output format.
- **Settings** expands to currency and random divisor. Its summary shows the
  active values. Inputs persist between modes, but editing inputs, changing
  modes or changing settings clears previous results. Recalculating can change
  random denominations.
- **Sound** is off on each page load. Opt in for quiet key clicks and a brief
  chime; audio failure does not affect calculations. Reduced-motion preferences
  disable key movement and receipt animation.

For frontend development, keep the server running and run `npm run dev` in another
terminal. Vite proxies `/api` to port 3000. Node serves the production assets.

## Verify

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs formatting, strict type checks, production build and core/CLI/HTTP
tests. Browser tests cover desktop/mobile viewports. `npm run test:coverage`
reports coverage. [Verification results](docs/VERIFICATION.md) map tests to requirements.

## Contract and assumptions

- Input: UTF-8, optional BOM, one `owed,paid` row per line, LF/CRLF, optional final
  newline. No header, quoting, currency symbols or decimal commas.
- Amounts: nonnegative, up to `10000000.00`, zero to two decimal places. Surrounding
  whitespace and leading zeros are accepted; excess precision is rejected rather
  than rounded. Both currencies use two decimal places.
- Random trigger: **owed cents modulo divisor equals zero**. The brief's 3.33/5.00
  example selects random because 333 is divisible by 3, though change is 167 cents.
  Divisor defaults to 3 and must be a positive safe integer. Zero owed also matches.
- No change: `No change due`. Underpayment or an invalid/blank data row fails the
  whole batch. An empty file produces an empty file. A final newline is a delimiter,
  not an extra row.
- Output: one line per transaction, descending denominations, explicit plurals,
  no spaces after commas, final LF for nonempty output. Complete batch validation
  precedes output file creation.
- Limits: 1 MiB input; 2 MiB HTTP body. CLI exit codes: 0 success, 1 processing/I/O
  failure, 2 invalid arguments.
- Tables describe stocked till denominations with unlimited counts. USD: $100,
  $50, $20, $10, $5, $1 and 25/10/5/1-cent pieces. EUR: €200, €100, €50, €20, €10,
  €5 and €2/€1/50/20/10/5/2/1-cent pieces.
- Greedy minimum is supported for these fixed tables. Arbitrary denomination
  systems, limited inventory, cash rounding and exchange conversion are outside
  the contract. EUR support does not imply French-language input/output.
- Random counts are drawn per denomination; pennies settle the remainder. This
  is **not uniform sampling of all combinations**. Repeated results, including the
  minimum-change result, are allowed.

## Design and container

The core is in `src/money.ts`, `currency.ts`, `change.ts` and `register.ts`.
CLI and HTTP use the same `processFile`; React does not calculate change.
See [architecture](docs/ARCHITECTURE.md) for extension examples and tradeoffs.

```sh
docker build -t truefit-cash-register .
docker run --rm -p 127.0.0.1:3000:3000 truefit-cash-register
```

The container runs as non-root with compiled code/static assets. The local server
binds to loopback by default; the container binds to its own network interface.

## AI use and submission

Codex (GPT-6 Astra) generated implementation, tests and initial documentation. Ed
supplied the brief and role context, approved the approach, and directed the
skeuomorphic revision: the page itself functions as the register. Human design
feedback and pending code review are recorded separately.

| Requested item             | Artifact                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Full raw prompt transcript | [Export/delivery notes](docs/ai/TRANSCRIPT.md); native snapshots prepared separately from public source |
| Decision log               | [Decisions and attribution](docs/DECISIONS.md)                                                          |
| Verification               | [Test evidence](docs/VERIFICATION.md)                                                                   |
| Tools/task mapping         | [Tools](docs/TOOLS.md)                                                                                  |
| Self-critique              | [Draft for Ed's review](docs/SELF_CRITIQUE.md)                                                          |

[References](docs/REFERENCES.md) disclose prior-PR influence. The original brief is
preserved unchanged. [Handoff](docs/HANDOFF.md) records remaining personal-review items.

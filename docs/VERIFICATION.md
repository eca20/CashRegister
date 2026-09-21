# Verification

Recorded September 21, 2026. Commands were executed by Codex; this is not a claim
of independent human review. The AI also authored the tests. The frontend revision
and subsequent service scaffold were verified in the working checkout and rebuilt
in Docker. The earlier clean-checkout baseline remains documented below; it
predates both revisions.

Frontend source revision: `d513ecb0819f7440526947eb5d80c88749190951`.
The follow-up documentation commit records this revision without changing code.

## Service scaffold checks

Verified source revision: `eccbec00215aa971898f47dc3a3464d6781aeabf`.
The following documentation commit only records this identifier.

The service scaffold retains the core, CLI, frontend and dependency lockfile.
HTTP now delegates through an async application interface. Verification uses fake
repositories/services; no database or external API is configured or contacted.

| Check                                  | Result                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                        | Passed: formatting, strict type checks, production build and all 44 Node tests                                                                                |
| `npx playwright test` after that build | All 28 existing Register/Batch desktop/mobile checks passed                                                                                                   |
| Container build                        | Node 22 production image rebuilt successfully                                                                                                                 |
| Headless container smoke test          | `SERVE_WEB=false`, `PORT=3001`: health checks and exact calculation succeeded; root returned 404; correlation ID preserved; UID 1000 and read-only filesystem |

The headless smoke container shut down on SIGTERM with exit code 0 and was
removed. The local demo was refreshed on port 3180; Docker reports healthy, the
read-only setting remains enabled and the sample still returns exact change.

The 14 new Node checks exercise the actual extension points:

- Default application service returns the existing core's result.
- Optional repository receives a frozen input/settings/output record and the same
  request context; success waits for completion and later caller mutations do not
  alter the record.
- A malformed later row and invalid divisor prevent all persistence; repository
  errors retain an internal cause but expose a generic 503 at HTTP.
- Cancellation is observed before work, after asynchronous storage, at the HTTP
  deadline and when a client disconnects. Even an uncooperative async fake cannot
  leave the HTTP request waiting beyond the deadline.
- Validated defaults/headless configuration reject malformed environment values.
- API and health checks work without web assets; unavailable readiness gates new
  calculations while liveness stays independent.
- Injected asynchronous services receive normalized requests, bounded correlation
  IDs and abort signals; unexpected failures return generic 500 responses.
- Shutdown drains an active request before adapter disposal, runs disposal only
  once, bounds stalled cleanup and accepts an injected dependency-readiness hook.

No real database atomicity, remote response contract, retry/idempotency guarantee,
cross-service transaction or production load behavior is claimed. Core coverage
percentages below are the original baseline, not refreshed service-layer coverage.

## Original clean-checkout baseline

Source: `abb03256d5725dd35780f2d1cae415a0f90249b0`. Exported that commit using `git archive` into an empty temporary directory and
selected Node v22.18.0 explicitly. `npm ci --offline --ignore-scripts` from the
populated package cache, `npm run check`, and `npm run test:e2e` all exited 0.
The clean copy had no existing dependencies or build output. Online `npm ci`
also succeeded in the Linux Node 22 Docker build. Earlier development checks used
Node v23.4.0. No claim is made that remote GitHub CI has run.

## Original baseline checks

| Check                                     | Result                                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                           | Passed: formatting, strict backend/frontend TypeScript, production build, 30 Node tests                                                                                    |
| `npm run test:e2e`                        | Passed: 8 Chromium browser tests across desktop and Pixel 7 viewports                                                                                                      |
| `npm run test:coverage`                   | Passed: core money/currency/change/register modules each had 100% line and branch coverage; CLI 98.06% lines / 95.35% branches; HTTP server 98.44% lines / 93.10% branches |
| `docker build -t truefit-cash-register .` | Passed on local Docker 29.4.2, Linux ARM64 image                                                                                                                           |
| Container smoke check                     | Expected sample output via HTTP, status 200, process UID 1000, read-only runtime filesystem                                                                                |
| Visual inspection                         | Container UI inspected in Codex browser; sample calculation returned exact totals and layout rendered correctly                                                            |
| Native transcript integrity               | Export SHA-256 and byte-for-byte match against source through the snapshot cutoff verified                                                                                 |

Coverage numbers refer to Node-instrumented compiled modules, not frontend coverage.
The browser checks are separate; coverage percentages do not prove correctness.
Global coverage includes test code and is intentionally not used as a quality claim.

## Frontend revision checks

The implementation and tests for “the page is the register” were verified locally
with Node v23.4.0; the production container build uses Node 22. The dependency
lockfile, core, CLI and API source/tests are unchanged. No new dependency was added.

| Check                                         | Result                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting and TypeScript                     | `npm run format:check` and `npm run typecheck` passed                                                                                            |
| Production build                              | `npm run build` passed; React components and shared money parser bundled successfully                                                            |
| Core/CLI/API regression                       | `node --test dist/test/*.test.js`: all 30 passed with loopback access                                                                            |
| Browser regression and new Register scenarios | `npm run test:e2e`: 28 passed; final `npx playwright test` rerun after narrow-screen CSS correction: 28 passed                                   |
| Docker                                        | `docker build -t truefit-cash-register .` passed; replaced the local demo container on port 3180                                                 |
| Container smoke check                         | HTTP sample returned `3 quarters,1 dime,3 pennies`; process UID 1000, read-only filesystem retained                                              |
| Visual inspection                             | Desktop Register/Batch, 320px Register, expanded settings, underpayment errors and long denomination receipt inspected in the Codex browser      |
| Native interaction                            | Keyboard entry and Enter-to-advance/submit worked; native clipboard paste accepted a maximum decimal amount and invalidated the previous receipt |

The sandbox initially prevented the four HTTP tests from binding loopback; the
unchanged suite passed with local-network permission. A successful browser suite
alone did not catch a maximum amount clipping inside its input at 320px. Visual
inspection caught it, CSS was corrected, and an input-specific overflow assertion
was added before the final passing browser run.

### Frontend requirement mapping

All 14 scenarios run in both desktop Chromium and Pixel 7 emulation (28 checks).
`e2e/batch.spec.ts` preserves the four original Batch scenarios; the ten new
`e2e/register.spec.ts` scenarios cover:

- Register defaults, collapsed settings, muted audio, explicit selection, automatic
  cents, `00`, backspace and Clear.
- Keyboard parity, select-all replacement, modifier shortcuts, Tab navigation,
  Enter-to-advance/submit, exact API request and expected server breakdown.
- Digit and decimal paste, whitespace, leading zeros, invalid text, negatives,
  scientific notation, excess precision and amounts beyond the existing limit.
- Keyboard/keypad maximum rejection without clamping, accepted value preservation
  and recovery by editing.
- Preserved inputs across modes, with receipts/downloads invalidated by input,
  currency, divisor and mode changes; keyboard tab selection.
- Delayed requests disable all mutable controls; receipts retain submitted amounts
  and display an intentionally alternative valid server breakdown (`88 pennies`),
  proving the UI does not recalculate denominations.
- Underpayment, invalid divisor and recovery; the original network-failure test
  remains in Batch coverage.
- Audio opt-in/mute/reset, deliberately unavailable AudioContext, and successful
  calculation despite audio failure. Subjective sound quality was not measured.
- Reduced-motion receipt animation suppression and visible keyboard focus.
- 320px maximum amount display, error rendering, long receipts, 44px control
  targets and no horizontal overflow; a 125-row batch renders 100 preview rows.

Batch checks still verify exact downloaded bytes including all 125 rows, uploads,
sample/manual input, currency/divisor, line-specific errors and stale results.
Browser paste scenarios dispatch ClipboardEvents; native desktop paste was checked
separately. Mobile emulation is not a real-device clipboard or audio audit.

## Requirement-to-test mapping

| Behavior                             | Evidence                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact decimal amounts                | `test/core.test.ts`: 0.29, leading zeros, maximum, huge values, negative/nonfinite/scientific forms, excess precision                                                         |
| Minimum physical pieces              | Independent DP recurrence compared with greedy for every amount 0..50,000 cents for each currency: 100,002 amounts total                                                      |
| Random selection based on owed cents | Contrasting cases where paid or change is divisible but owed is not; 3.33/5.00 selects random                                                                                 |
| Random correctness                   | 5,000 reproducible generated cases per currency: exact sum, positive integer counts, valid denominations; controlled RNG boundaries and invalid RNG values                    |
| Bounded random work                  | Maximum supported change with a zero-valued RNG uses at most D−1 draws and terminates                                                                                         |
| New divisor, rule priority, EUR      | Configuration and first-match tests; additional rule without changing the processing code; explicit EUR output                                                                |
| Invalid strategy output              | Wrong totals, unknown/duplicate denominations, zero/negative/fractional/unsafe counts rejected                                                                                |
| File contract                        | LF/CRLF/BOM, final/no-final newline, empty file, blank rows, correct line numbers, exact singular/plural formatting                                                           |
| CLI I/O                              | Real executable and temp files; malformed later row creates no output; existing output and input protected; invalid UTF-8, size limit, help and argument failures             |
| HTTP boundary                        | Real local server and fetch: defaults, EUR/divisor, bad JSON/contracts, invalid values, content type, methods, request/input byte limits, security headers/static containment |
| Browser workflow                     | Real API: sample/manual input, file upload, settings, exact file download, stale-result clearing, line error, network failure and recovery                                    |
| Large-file UI behavior               | 125 transactions render only 100 preview rows; downloaded output still contains all 125 rows; desktop and mobile                                                              |

The DP oracle and seeded generator are verification code, not production
dependencies. Seeded checks are repeatable examples across a wide range, not a
mathematical proof or statistical demonstration of uniform randomness.

## Failures and fixes

1. Strict typing caught an invalid `assert.throws` overload in an initial test.
   Corrected the assertion and reran type checking.
2. Sandbox restrictions initially blocked local HTTP listeners (`EPERM`), while
   26 core/CLI tests passed. Reran the HTTP tests with loopback permission; all 30 passed.
3. The first browser run failed all six scenarios because JSX compiled with the
   wrong runtime (`React is not defined`). Added the discoverable frontend
   tsconfig, rebuilt and passed all six. Added the large-preview regression later,
   bringing the passing total to eight. This defect illustrates why a successful
   build and API suite alone were insufficient.

## Limits of this verification

- Minimum-piece oracle is bounded; arbitrary denominations are unsupported.
- Browser coverage is Chromium with desktop/mobile emulation, not real iOS/Safari
  or a screen-reader audit. No formal accessibility certification is claimed.
- No concurrent production load, crash/disk-exhaustion fault injection, or
  penetration test was performed. Container runtime was exercised locally.
- GitHub Actions configuration is included but has not run remotely before push.
- Ed's code walkthrough, personal critique and final submission review are pending.

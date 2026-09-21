# Verification

Recorded September 21, 2026. Commands were executed by Codex; this is not a claim
of independent human review. The AI also authored the tests. The source revision tested from a clean checkout was
`abb03256d5725dd35780f2d1cae415a0f90249b0`. Subsequent changes only update
verification/handoff documentation.

## Clean-checkout verification

Exported that commit using `git archive` into an empty temporary directory and
selected Node v22.18.0 explicitly. `npm ci --offline --ignore-scripts` from the
populated package cache, `npm run check`, and `npm run test:e2e` all exited 0.
The clean copy had no existing dependencies or build output. Online `npm ci`
also succeeded in the Linux Node 22 Docker build. Earlier development checks used
Node v23.4.0. No claim is made that remote GitHub CI has run.

## Executed checks

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

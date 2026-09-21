# Architecture and tradeoffs

The required behavior is a small batch transformation. The senior full-stack role
motivates a React interface and HTTP adapter; the CLI directly implements the brief.

```text
File → CLI ───────────────────────────────┐
                                         ├→ pure calculation core
React / service → HTTP → ChangeService ──┘
                              └→ optional repository (none configured)
```

## Boundaries

- `money.ts`: strict decimal parsing into bounded integer cents. BigInt is used
  at the boundary so an oversized number cannot round into a valid amount.
- `currency.ts`: immutable, descending till tables with explicit labels.
- `change.ts`: minimum/random strategies, result validation and formatting.
- `register.ts`: file/transaction parsing and ordered rule selection.
- `cli.ts`: bounded reads, UTF-8, exclusive output creation, diagnostics/exit codes.
- `server.ts`: validated HTTP requests, limits, responses and static assets.
- `application/change-service.ts`: asynchronous use case, optional persistence
  interface and typed failures; default calculation remains stateless.
- `config.ts`, `runtime.ts`, `serve.ts`: environment configuration, composition,
  health/readiness and bounded shutdown with adapter cleanup.
- `adapters/`: integration guidance for future database and outbound API adapters.
- `web/App.tsx`: mode/input state, the shared HTTP request handler, validation,
  errors and downloads; `main.tsx` only mounts React.
- `web/entry.ts`: bounded cents entry and integer display formatting; decimal
  paste reuses the core money parser rather than introducing a second grammar.
- `web/components/`: Register entry, Batch editor and receipt presentation.
- `web/useRegisterSound.ts`: optional, isolated Web Audio feedback.

The core imports no file, server or React APIs. Injected randomness makes it
deterministic in tests. No DI container is needed. Server runtime uses Node built-ins.

## New rules

The first matching rule wins, otherwise minimum change applies. For example:

```ts
const register = createRegister({
  rules: [
    { matches: ({ owed }) => owed >= 100_000, strategy: minimumChange },
    divisibleBy(5),
  ],
});
```

A strategy returns counts of canonical denomination objects. The register checks
membership, uniqueness, positive integer counts and exact sum before formatting.
Rules are trusted application code, not remotely supplied scripts.

## Algorithms

For D denominations, minimum and random change take O(D) time/space. Random change
draws an affordable count for each non-penny denomination, then settles the remainder
in pennies. A one-cent denomination guarantees completion. The distribution is
biased and can return all pennies; the brief does not require uniformity or a cap
on physical pieces.

Greedy is appropriate for the fixed USD/EUR tables. Tests compare it to a separate
dynamic-programming oracle for every amount 0..50,000 cents per table. This is
bounded empirical verification, not proof for arbitrary systems. Adding arbitrary
denominations would require a canonicality check or exact algorithm with resource
limits. Including pennies alone does not guarantee greedy optimality.

Whole-batch validation produces a line-numbered error without an output file for
invalid data. Exclusive creation protects existing files. A write failure after
creation, such as disk exhaustion, can leave a partial new file; atomic publication
through a temporary file is a possible extension. Output size grows with rows × D.

## HTTP contract

`POST /api/change`, `Content-Type: application/json`:

```json
{ "input": "2.12,3.00\n", "currency": "USD", "divisor": 3 }
```

Success: `200 {"output":"3 quarters,1 dime,3 pennies\n"}`. Errors return
`{"error":"..."}`: 400 malformed JSON/contract, 413 size limit, 415 content type,
422 invalid transaction or numeric divisor. Omitted settings default; invalid
and unknown fields are rejected. Other API methods return 405. Results are not cached.

The handler now calls an injected `ChangeService`; business validation remains 422,
expected dependency failures return 503, unexpected errors return a generic 500,
and the calculation deadline returns 504. Correlation uses `X-Request-ID`.
Readiness/liveness routes are available with or without the frontend. See the
[OpenAPI contract](openapi.json) and [service integration guide](SERVICE_INTEGRATION.md).

## Production scope

By default one stateless process serves the UI and calculation requests. Protections include
bounded buffering, strict runtime/UTF-8 validation, timeouts, same-origin requests,
browser content policy and static-path containment. Input is not logged or stored
unless a future repository is explicitly supplied.
The container is non-root. These are concrete protections, not a claim of production
readiness.

Public production would require agreed authentication/authorization, TLS at ingress,
rate/concurrency limits, observability and operational ownership. Larger batches
could need worker isolation: timeouts do not interrupt synchronous CPU work.

No current requirement calls for a database, broker, GraphQL or Kubernetes.
The service scaffold isolates integration adapters and provides lifecycle hooks;
it does not select or implement that infrastructure.
Actual drawer inventory would change this: selection must consider available
counts; dispensing needs an atomic, auditable transaction and idempotency. A retry
must not dispense twice. Such requirements would justify persistence.

## Frontend state and materials

Register sends one canonical `owed,paid` row to the same endpoint as Batch. The
server's denomination string is authoritative. A receipt holds the submitted
amounts, mode, currency, divisor and returned output together; its displayed total
is integer subtraction of that snapshot, not a second denomination algorithm.
The complete output is retained for download while only 100 rows are rendered.

Amount entry is append-style cents entry, with full-selection replacement and
backspace. Read-only, focusable amount inputs keep native mobile keyboards from
competing with the dedicated keypad; scoped keyboard/paste handlers provide
desktop entry without intercepting browser shortcuts or normal navigation.
Inputs are retained separately for each mode. Editing, switching modes or changing
settings invalidates the receipt. Mutable controls are disabled during requests
and file reads, with a revision guard against outdated async results.

CSS gradients, borders and shadows provide plastic, metal, display and paper
materials without image assets or a fixed-size appliance composition. Native
buttons, labels, expandable settings and live status/error messages remain HTML.
The layout supports 320px screens and reduced motion. Audio is created only after
the user enables it; errors disable sound without escaping into calculation flow.

State lasts only for the current page load. Random output intentionally changes
across requests; a physical dispensing workflow would need persisted accepted
breakdowns or transaction identifiers, beyond this calculation demo.

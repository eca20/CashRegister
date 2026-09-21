# Architecture and tradeoffs

The required behavior is a small batch transformation. The senior full-stack role
motivates a React interface and HTTP adapter; the CLI directly implements the brief.

```text
File → CLI ───────────────────┐
                             ├→ parse → select rule → make change → validate → format
React → POST /api/change ─────┘
```

## Boundaries

- `money.ts`: strict decimal parsing into bounded integer cents. BigInt is used
  at the boundary so an oversized number cannot round into a valid amount.
- `currency.ts`: immutable, descending till tables with explicit labels.
- `change.ts`: minimum/random strategies, result validation and formatting.
- `register.ts`: file/transaction parsing and ordered rule selection.
- `cli.ts`: bounded reads, UTF-8, exclusive output creation, diagnostics/exit codes.
- `server.ts`: validated HTTP requests, limits, responses and static assets.
- `web/main.tsx`: user interaction, request state, errors and downloads.

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

## Production scope

One stateless process serves the UI and calculation requests. Protections include
bounded buffering, strict runtime/UTF-8 validation, timeouts, same-origin requests,
browser content policy and static-path containment. Input is not logged or stored.
The container is non-root. These are concrete protections, not a claim of production
readiness.

Public production would require agreed authentication/authorization, TLS at ingress,
rate/concurrency limits, observability and operational ownership. Larger batches
could need worker isolation: timeouts do not interrupt synchronous CPU work.

No current requirement calls for a database, broker, GraphQL or Kubernetes.
Actual drawer inventory would change this: selection must consider available
counts; dispensing needs an atomic, auditable transaction and idempotency. A retry
must not dispense twice. Such requirements would justify persistence.

Random output intentionally changes across requests. A physical receipt workflow
should persist the accepted breakdown or use a transaction identifier.

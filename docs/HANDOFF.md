# Local handoff

Target role: senior full-stack engineer; architect is a secondary possibility.

The implementation includes a shared TypeScript core, file CLI, Node API, React
UI, tests, container, CI configuration and AI-use documentation. The current demo
is available at `http://127.0.0.1:3180` through a local read-only Docker container.
It is not publicly deployed. The implementation is committed locally on
`assessment/ed-anderson`; the clean-checkout source revision is recorded in
`docs/VERIFICATION.md`.

## Review in five minutes

1. In Register, enter `212` owed and `300` paid and calculate. Try keypad, keyboard,
   paste and Clear. In Batch, run the sample and download it. Expand Settings to
   change currency/divisor; try underpayment, sound and the mobile layout.
2. Read `src/money.ts`, `change.ts` and `register.ts`; explain the divisibility
   assumption, random distribution, greedy-table constraint and extension point.
3. Read `test/core.test.ts` for the independent oracle and random invariants.
4. Review the decision log and architecture tradeoffs.
   The service integration guide also explains future database/API wiring and
   current stateless defaults; `docs/openapi.json` describes the HTTP contract.
5. Replace or explicitly adopt the attributed self-critique draft in your own voice.

## Remaining submission steps

- Ed's personal critique and code review. The current draft is explicitly AI-authored.
- Decide how to deliver the complete native transcript. It includes the original
  email/contact details and environment metadata; exact snapshots are kept in
  `.submission-private/transcripts/`, outside Git, for private delivery.
- Re-export after the final conversation to capture the final review/shipping
  messages. Each immutable snapshot states its precise cutoff.
- Fork/push and open the TrueFit PR after the personal-review items are complete.
  No fork, remote branch, PR, recruiter message or public deployment has been created.

To stop the local demo:

```sh
docker stop truefit-assessment-01a0c46c
```

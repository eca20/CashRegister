# Submission and review guide

Target role: senior full-stack engineer; architect is a secondary possibility.

The implementation includes a shared TypeScript core, file CLI, Node API, React UI,
service integration scaffold, tests, container, CI and AI-use documentation.
Ed has finalized his self-critique. His recorded involvement includes requirements,
role alignment, design correction and personal critique; automated checks are not
represented as independent human code review.

## Assessment artifacts

- [Ed's self-critique](SELF_CRITIQUE.md)
- [AI decisions and attribution](DECISIONS.md)
- [Verification](VERIFICATION.md)
- [Tools and task mapping](TOOLS.md)
- [Complete transcript, redacted through its stated cutoff](ai/TRANSCRIPT.md)

The unmodified native transcript and private redaction configuration are excluded
from Git. The public transcript contains explicit markers, event counts and hashes.
The app itself is not publicly hosted; reviewers can run it locally or in Docker.

## Review in five minutes

1. Run the CLI against `examples/input.txt` and inspect the output.
2. In Register, enter `212` owed and `300` paid. Try keypad, keyboard, paste and Clear.
   In Batch, run the sample and download it. Expand Settings to change currency
   or divisor; try underpayment, optional sound and the mobile layout.
3. Read `src/money.ts`, `change.ts` and `register.ts` for the divisibility rule,
   random distribution, fixed greedy tables and extension point.
4. Read `test/core.test.ts` for the independent oracle and randomized invariants.
5. Read the [service integration guide](SERVICE_INTEGRATION.md) for future API/DB
   wiring and its current stateless defaults; `openapi.json` describes HTTP.

No live database, remote integration or production deployment is implied.

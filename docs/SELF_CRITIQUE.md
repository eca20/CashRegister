# Self-critique — draft for Ed's review

**Attribution:** Codex drafted these observations. They are not Ed's personal
self-critique; he must review, rewrite or explicitly adopt them before submission.

## What would I change first, and why?

AI draft: I would clarify the business definition of random change. The current
algorithm is bounded and exact, but can return many pennies and is not uniform
over combinations. With client agreement, I would define an acceptable distribution
or piece limit and test that contract. Physical tills would also require inventory
and idempotent transactions; unlimited denomination supply would not suffice.

## What seems strongest, and why?

AI draft: The shared core and exact money handling. CLI and HTTP use the same
parsing, policy and calculation functions. Tests check totals, rule selection and
minimum counts against an independent algorithm, beyond sample UI results.

## What seems weakest, and why?

AI draft: Random behavior and error handling rely on documented assumptions rather
than stakeholder confirmation. This is a local demo, lacking inventory, persisted
transaction identity and multi-user operational controls. Human review of the
AI-generated code remains an essential outstanding step.

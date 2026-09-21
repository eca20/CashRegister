# Self-critique

## What would I change first, and why?

I would clarify the business definition of random change. The current
algorithm is bounded and exact, but can return many pennies and is not uniform
over combinations. With client agreement, I would define an acceptable distribution
or piece limit and test that contract. Physical tills would also require inventory
and idempotent transactions; unlimited denomination supply would not suffice.

## What seems strongest, and why?

The frontend aesthetic: I chose skeuomorphism to replace the standard AI-generated
look and feel with something a user would find more welcoming.

The shared core and exact money handling are also strengths. CLI and HTTP use the same
parsing, policy and calculation functions. Tests check totals, rule selection and
minimum counts against an independent algorithm, beyond sample UI results. The
project is scaffolded to operate as its own service in a wider system.

## What seems weakest, and why?

Random behavior and error handling rely on documented assumptions rather
than stakeholder confirmation. This is a local demo, lacking inventory, persisted
transaction identity and multi-user operational controls. Moving to a larger
production system would need more detailed requirements, so we implemented the
agreed scope while ensuring the app can later be assembled into a larger system.

_Originally drafted with AI assistance, then reviewed and revised by Ed Anderson.
Final copy editing preserved his points._

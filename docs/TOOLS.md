# Tools and task mapping

| Stage                   | Tool and actual contribution                                                                        | Human contribution                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Research                | Codex Desktop, GPT-6 Astra, web, GitHub CLI: read brief/selected PRs and proposed design            | Ed supplied recruiter request, suggested PR review and approved approach     |
| Role alignment          | Same conversation: added React UI/Node adapter                                                      | Ed supplied job descriptions; senior full-stack primary, architect secondary |
| Implementation          | Codex and local editing/shell tools generated core, adapters, UI, configuration and docs            | No line-level human edits/review recorded yet                                |
| Core verification       | Node test runner/TypeScript: examples, boundaries, DP oracle, deterministic randomized cases        | Personal inspection pending                                                  |
| Adapter/UI verification | Node HTTP tests and Playwright Chromium: real files, requests and desktop/mobile scenarios          | Personal walkthrough pending                                                 |
| Delivery                | npm lockfile, Prettier, Vite, Git, Docker and CI configuration                                      | Final submission decision pending                                            |
| Transcript              | OpenAI Docs skill and local export script: native bytes, SHA-256 manifest and readable derived view | Full raw log requested through the recruiter requirements                    |
| Critique                | Codex drafted attributed technical observations                                                     | Ed's personal assessment still required                                      |

One AI session and one model were used. No second model, subagent or independent
human reviewer is claimed. The AI wrote both implementation and tests; passing
tests are evidence, not human review. A different algorithm powers the DP oracle,
and actual file/HTTP/browser tests reduce shared-assumption risk.

The app itself does not call AI. Arithmetic and file processing do not benefit
from an uncertain, paid model call at runtime.

## Frontend revision

Ed supplied the visual critique, corrected the literal-register direction and
approved the detailed interaction plan. Codex generated the revised React/CSS,
adapted Batch tests, and added Register tests. TypeScript checked the shared
boundaries; Playwright exercised desktop/Pixel 7 behavior and a 320px viewport.
The Codex browser provided visual inspection and native keyboard/clipboard checks.
Docker rebuilt the same local demo. CSS produces all materials; Web Audio produces
optional clicks/chimes. No image generator, external assets, animation library or
additional AI agent was used. These are human product decisions and AI-authored
implementation/verification, not a claim that Ed has finished a code review.

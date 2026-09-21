# References and influence

- [TrueFit brief](https://github.com/TrueFit/CashRegister), starting commit
  `9b945d39fe338c731b921fc943d6354097d41252`.
- [PR #107](https://github.com/TrueFit/CashRegister/pull/107): inspected selected
  Python calculation/policy code and AI documentation. Influenced the shared-core,
  injectable-randomness and native-transcript approach. Our bounded count-per-coin
  algorithm differs from its one-piece-at-a-time loop.
- [PR #109](https://github.com/TrueFit/CashRegister/pull/109): inspected selected
  TypeScript strategy and decision/tool documentation. Reinforced explicit
  attribution and personal self-critique. We chose a much smaller module structure.
- [PR #110](https://github.com/TrueFit/CashRegister/pull/110): inspected selected
  TypeScript rules/strategies, Go CLI and AI logs. Its separate CLI omits the random
  rule. This reinforced using one implementation for every entry point. Its
  randomized-count/remainder approach is conceptually related to our algorithm;
  we use fixed denomination order with injected randomness rather than shuffling.

These are public submissions, not evaluator-approved exemplars. The sampled
reviewer comments only acknowledge receipt. No candidate code was copied into
this implementation; common ideas and the consulted material are disclosed here.
Their applications were not executed during research.

- [Official OpenAI troubleshooting documentation](https://learn.chatgpt.com/docs/reference/troubleshooting):
  identifies native session transcripts under `~/.codex/sessions`. We verified the
  current session locally before implementation.

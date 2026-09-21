# Integration adapter location

The default service has no external adapters. This directory marks where concrete
integrations belong when there is a real requirement; no placeholder database
connection or remote call runs today.

- A persistence adapter implements `CalculationRepository` from
  `application/change-service.ts`. Keep driver/ORM imports, SQL, schema mappings
  and transaction behavior in that adapter.
- An outbound HTTP adapter owns a specific remote service's URLs, credentials,
  response validation and error translation. Define its business interface in
  `application/` once that remote workflow is known, then inject it into an
  application service implementing `ChangeService`.
- Construct clients and application services in `serve.ts`, and supply them to
  `createServiceRuntime`. Supply `dispose` for resource cleanup and optionally
  `isReady` for cached dependency health. Core money and rule functions never
  import these adapters.
- Use `CallContext.signal` for cancellable I/O and propagate `requestId` to
  downstream HTTP calls. Map expected integration failures to
  `DependencyUnavailableError`; do not expose remote bodies or credentials.

Use test doubles in tests until a real adapter exists. Add adapter contract tests
against the chosen service/database when it does. See
[`docs/SERVICE_INTEGRATION.md`](../../docs/SERVICE_INTEGRATION.md) for lifecycle,
configuration, persistence semantics and future integration decisions.

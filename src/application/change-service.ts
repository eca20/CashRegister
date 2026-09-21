import { divisibleBy, processFile } from "../register.js";
import type { CurrencyCode } from "../currency.js";

export interface ChangeRequest {
  readonly input: string;
  readonly currency: CurrencyCode;
  readonly divisor: number;
}

export interface ChangeResponse {
  readonly output: string;
}

export interface CallContext {
  readonly requestId: string;
  readonly signal: AbortSignal;
}

// HTTP depends on this asynchronous boundary, not on a database or API client.
export interface ChangeService {
  calculate(
    request: ChangeRequest,
    context: CallContext,
  ): Promise<ChangeResponse>;
}

export interface CalculationRecord extends ChangeRequest, ChangeResponse {
  readonly requestId: string;
  readonly calculatedAt: string;
}

// A future adapter owns its database schema, driver and transaction semantics.
// The default service has no repository and stores nothing.
export interface CalculationRepository {
  save(record: CalculationRecord, context: CallContext): Promise<void>;
}

export class InvalidCalculationError extends Error {}
export class DependencyUnavailableError extends Error {}

export function createChangeService(
  dependencies: { readonly repository?: CalculationRepository } = {},
): ChangeService {
  return {
    async calculate(request, context) {
      context.signal.throwIfAborted();
      // Snapshot primitives before any asynchronous adapter can run.
      const command = Object.freeze({ ...request });
      let output: string;
      try {
        output = processFile(command.input, {
          currency: command.currency,
          rules: [divisibleBy(command.divisor)],
        });
      } catch (cause) {
        throw new InvalidCalculationError(
          cause instanceof Error ? cause.message : "Unable to process input.",
          { cause },
        );
      }
      context.signal.throwIfAborted();
      if (dependencies.repository) {
        const record = Object.freeze({
          ...command,
          output,
          requestId: context.requestId,
          calculatedAt: new Date().toISOString(),
        });
        try {
          // An enabled repository is required for success: no silent data loss.
          await dependencies.repository.save(record, context);
        } catch (cause) {
          context.signal.throwIfAborted();
          throw new DependencyUnavailableError(
            "Calculation storage is unavailable.",
            { cause },
          );
        }
        context.signal.throwIfAborted();
      }
      return { output };
    },
  };
}

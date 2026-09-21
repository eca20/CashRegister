import { open, writeFile } from "node:fs/promises";
import { processFile, divisibleBy } from "./register.js";
import type { CurrencyCode } from "./currency.js";

import { MAX_INPUT_BYTES } from "./limits.js";
const HELP = `Usage: cash-register <input-file> <output-file> [--currency USD|EUR] [--divisor N]

Reads owed,paid rows and writes one change breakdown per row.
Defaults: USD, divisor 3 applied to owed cents.
The output file must not already exist. Input limit: 1 MiB.
Exit codes: 0 success, 1 input/output/processing failure, 2 invalid arguments.
`;

interface Arguments {
  input: string;
  output: string;
  currency: CurrencyCode;
  divisor: number;
}

function parseArguments(args: readonly string[]): Arguments {
  const paths: string[] = [];
  const seen = new Set<string>();
  let currency: CurrencyCode = "USD";
  let divisor = 3;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg.startsWith("--")) {
      if (arg !== "--currency" && arg !== "--divisor")
        throw new Error(`Unknown option: ${arg}`);
      if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
      seen.add(arg);
      const value = args[++index];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      if (arg === "--currency") {
        if (value !== "USD" && value !== "EUR")
          throw new Error("Currency must be USD or EUR.");
        currency = value;
      } else {
        if (!/^[0-9]+$/.test(value))
          throw new Error("Divisor must be a positive safe integer.");
        divisor = Number(value);
        divisibleBy(divisor);
      }
    } else {
      paths.push(arg);
    }
  }
  if (paths.length !== 2)
    throw new Error("Provide an input file and an output file.");
  return { input: paths[0]!, output: paths[1]!, currency, divisor };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function runCli(
  args: readonly string[],
  stdout: (text: string) => void = (text) => {
    process.stdout.write(text);
  },
  stderr: (text: string) => void = (text) => {
    process.stderr.write(text);
  },
): Promise<number> {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    stdout(HELP);
    return 0;
  }
  let options: Arguments;
  try {
    options = parseArguments(args);
  } catch (error) {
    stderr(`${message(error)}\n${HELP}`);
    return 2;
  }
  try {
    const file = await open(options.input, "r");
    let input: Buffer;
    try {
      if (!(await file.stat()).isFile())
        throw new Error("Input must be a regular file.");
      // Read at most one byte beyond the limit, even if the file grows after opening.
      const buffer = Buffer.alloc(MAX_INPUT_BYTES + 1);
      let size = 0;
      while (size < buffer.length) {
        const { bytesRead } = await file.read(
          buffer,
          size,
          buffer.length - size,
          null,
        );
        if (bytesRead === 0) break;
        size += bytesRead;
      }
      if (size > MAX_INPUT_BYTES)
        throw new Error("Input exceeds the 1 MiB limit.");
      input = buffer.subarray(0, size);
    } finally {
      await file.close();
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    const output = processFile(text, {
      currency: options.currency,
      rules: [divisibleBy(options.divisor)],
    });
    // Complete validation precedes writing. Exclusive creation protects existing
    // files, including when the input and output names point to the same file.
    await writeFile(options.output, output, { encoding: "utf8", flag: "wx" });
    return 0;
  } catch (error) {
    stderr(`Error: ${message(error)}\n`);
    return 1;
  }
}

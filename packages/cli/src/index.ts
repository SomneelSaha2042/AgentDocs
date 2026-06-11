#!/usr/bin/env node

import { createProgram } from "./cli.js";
import { exitCodeForError } from "./exit-code.js";

export { buildContextBundle, formatContextBundle } from "./context.js";
export { formatTryResult, runTry } from "./try.js";

try {
  await createProgram().parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = exitCodeForError(error);
}

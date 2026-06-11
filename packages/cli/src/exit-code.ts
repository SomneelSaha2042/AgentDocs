import { CrawlError } from "@agentdocs/crawler";
import { ConfigValidationError } from "@agentdocs/shared";

import { BuildError } from "./build.js";
import {
  DoctorError,
  DoctorInputError,
  ReadinessThresholdError,
} from "./doctor.js";
import { IngestError } from "./ingest.js";
import { InitConfigError } from "./init.js";
import { InspectError } from "./inspect.js";

export function exitCodeForError(error: unknown): number {
  const explicit = explicitExitCode(error);
  if (explicit !== undefined) return explicit;
  if (matchesError(error, ReadinessThresholdError, "ReadinessThresholdError")) return 5;
  if (hasErrorName(error, "McpArtifactError")) return 6;
  if (matchesError(error, IngestError, "IngestError")
    || matchesError(error, CrawlError, "CrawlError")) return 3;
  if (matchesError(error, BuildError, "BuildError")
    || matchesError(error, InspectError, "InspectError")
    || matchesError(error, DoctorError, "DoctorError")) return 4;
  if (matchesError(error, InitConfigError, "InitConfigError")
    || matchesError(error, ConfigValidationError, "ConfigValidationError")
    || matchesError(error, DoctorInputError, "DoctorInputError")) return 2;
  return 1;
}

function explicitExitCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("exitCode" in error)) return undefined;
  const value = error.exitCode;
  return typeof value === "number" && Number.isInteger(value) && value >= 2 && value <= 6
    ? value
    : undefined;
}

function matchesError<T extends Error>(
  error: unknown,
  constructor: new (...args: never[]) => T,
  name: string,
): error is T {
  return error instanceof constructor || hasErrorName(error, name);
}

function hasErrorName(error: unknown, name: string): error is Error {
  return error instanceof Error && error.name === name;
}

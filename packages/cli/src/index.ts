#!/usr/bin/env node

import { createProgram } from "./cli.js";
import { InitConfigError } from "./init.js";
import { IngestError } from "./ingest.js";
import { ConfigValidationError } from "@agentdocs/shared";
import { CrawlError } from "@agentdocs/crawler";
import { BuildError } from "./build.js";
import { InspectError } from "./inspect.js";
import {
  DoctorError,
  DoctorInputError,
  ReadinessThresholdError,
} from "./doctor.js";

try {
  await createProgram().parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = error instanceof ReadinessThresholdError
    ? 5
    : error instanceof IngestError || error instanceof CrawlError
    ? 3
    : error instanceof BuildError || error instanceof InspectError || error instanceof DoctorError
      ? 4
    : error instanceof InitConfigError || error instanceof ConfigValidationError || error instanceof DoctorInputError
      ? 2
      : 1;
}

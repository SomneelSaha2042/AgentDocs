import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ReadinessReportSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { buildFromSources } from "./build.js";
import { createProgram } from "./cli.js";
import { ReadinessThresholdError, runDoctor } from "./doctor.js";
import { ingestLocalMarkdown } from "./ingest.js";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("runDoctor", () => {
  it("writes schema-valid JSON and actionable Markdown reports", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-doctor-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });
    await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });

    const result = await runDoctor({
      config: "agentdocs.config.yaml",
      cwd: REPOSITORY_ROOT,
      out: output,
    });
    const report = ReadinessReportSchema.parse(
      JSON.parse(await readFile(result.jsonPath, "utf8")),
    );
    const markdown = await readFile(result.markdownPath, "utf8");

    expect(report.score).toBeGreaterThan(0);
    expect(report.checks.some((check) => check.status === "warn")).toBe(true);
    expect(markdown).toContain("# Agent-readiness report");
    expect(markdown).toContain("## Critical issues");
    expect(markdown).not.toContain(REPOSITORY_ROOT);
  });

  it("fails only when the requested readiness threshold is missed", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-doctor-threshold-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });
    await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });

    await expect(
      createProgram().exitOverride().parseAsync([
        "node",
        "agentdocs",
        "--cwd",
        REPOSITORY_ROOT,
        "--out",
        output,
        "--quiet",
        "doctor",
        "--min-score",
        "100",
      ]),
    ).rejects.toBeInstanceOf(ReadinessThresholdError);
  });

  it("rejects unknown categories as invalid user input", async () => {
    const output = await import("node:fs/promises").then(({ mkdtemp }) =>
      mkdtemp(path.join(os.tmpdir(), "agentdocs-doctor-category-")),
    );

    await expect(
      createProgram().exitOverride().parseAsync([
        "node",
        "agentdocs",
        "--cwd",
        REPOSITORY_ROOT,
        "--out",
        output,
        "--quiet",
        "doctor",
        "--category",
        "unknown",
      ]),
    ).rejects.toMatchObject({ name: "DoctorInputError" });
  });
});

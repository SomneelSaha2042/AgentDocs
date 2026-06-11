import os from "node:os";
import path from "node:path";

import { ContextBundleSchema } from "@agentdocs/shared";
import { describe, expect, it, vi } from "vitest";

import { buildFromSources } from "./build.js";
import { createProgram } from "./cli.js";
import { ingestLocalMarkdown } from "./ingest.js";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("context CLI", () => {
  it("emits a schema-valid task-pack context bundle", async () => {
    const output = await prepareOutput();
    const writes: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
      writes.push(String(value));
      return true;
    });
    try {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", REPOSITORY_ROOT, "--out", output,
        "--json", "context", "install package",
      ]);
    } finally {
      write.mockRestore();
    }

    const result = ContextBundleSchema.parse(JSON.parse(writes.join("")));
    expect(result.selectedTaskPack?.id).toBe("installation");
    expect(result.search.results.length).toBeGreaterThan(0);
    expect(result.goalBundle.steps.length).toBeGreaterThan(0);
  });

  it("falls back to source search when no task pack matches", async () => {
    const output = await prepareOutput();
    const writes: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
      writes.push(String(value));
      return true;
    });
    try {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", REPOSITORY_ROOT, "--out", output,
        "--json", "context", "EXAMPLE_API_KEY",
      ]);
    } finally {
      write.mockRestore();
    }

    const result = ContextBundleSchema.parse(JSON.parse(writes.join("")));
    expect(result.selectedTaskPack).toBeUndefined();
    expect(result.search.results.length).toBeGreaterThan(0);
    expect(result.goalBundle.steps.length).toBeGreaterThan(0);
  });
});

async function prepareOutput(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-context-cli-"));
  await ingestLocalMarkdown({
    cwd: REPOSITORY_ROOT,
    out: output,
    source: "fixtures/basic-docs",
  });
  await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
  return output;
}

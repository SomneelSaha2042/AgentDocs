import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { buildFromSources } from "./build.js";
import { createProgram } from "./cli.js";
import { ingestLocalMarkdown } from "./ingest.js";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("search CLI", () => {
  it("searches a built index and emits validated JSON", async () => {
    const output = await prepareOutput();
    const writes: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
      writes.push(String(value));
      return true;
    });
    try {
      await createProgram().exitOverride().parseAsync([
        "node",
        "agentdocs",
        "--cwd",
        REPOSITORY_ROOT,
        "--out",
        output,
        "--json",
        "search",
        "EXAMPLE_API_KEY",
      ]);
    } finally {
      write.mockRestore();
    }

    const response = JSON.parse(writes.join(""));
    expect(response.query).toBe("EXAMPLE_API_KEY");
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]).toMatchObject({
      pageId: expect.any(String),
      chunkId: expect.any(String),
      score: expect.any(Number),
    });
    await expect(readFile(path.join(output, "index.sqlite"))).resolves.not.toHaveLength(0);
  });

  it("prints a stable no-result message", async () => {
    const output = await prepareOutput();
    const writes: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
      writes.push(String(value));
      return true;
    });
    try {
      await createProgram().exitOverride().parseAsync([
        "node",
        "agentdocs",
        "--cwd",
        REPOSITORY_ROOT,
        "--out",
        output,
        "search",
        "no-such-term",
      ]);
    } finally {
      write.mockRestore();
    }
    expect(writes.join("")).toBe('No results found for "no-such-term".\n');
  });
});

async function prepareOutput(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-search-cli-"));
  await ingestLocalMarkdown({
    cwd: REPOSITORY_ROOT,
    out: output,
    source: "fixtures/basic-docs",
  });
  await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
  return output;
}

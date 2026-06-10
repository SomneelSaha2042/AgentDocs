import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ChunkSchema, DocPageSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { buildFromSources } from "./build.js";
import { ingestLocalMarkdown } from "./ingest.js";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("buildFromSources", () => {
  it("writes deterministic schema-valid chunks and enriches pages", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-build-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });

    const first = await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
    const firstContents = await readFile(first.chunksPath, "utf8");
    const second = await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
    expect(await readFile(second.chunksPath, "utf8")).toBe(firstContents);

    const chunks = firstContents
      .trim()
      .split("\n")
      .map((line) => ChunkSchema.parse(JSON.parse(line)));
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((chunk) => chunk.headingPath.includes("Create a client"))).toBe(true);

    const pageFiles = await import("node:fs/promises").then(({ readdir }) =>
      readdir(path.join(output, "sources", "pages")),
    );
    const pages = await Promise.all(
      pageFiles
        .filter((file) => file.endsWith(".json"))
        .map(async (file) =>
          DocPageSchema.parse(
            JSON.parse(await readFile(path.join(output, "sources", "pages", file), "utf8")),
          ),
        ),
    );
    expect(
      pages.flatMap((page) => page.codeBlocks).some((block) =>
        block.extracted?.envVars?.includes("EXAMPLE_API_KEY"),
      ),
    ).toBe(true);
    expect(
      pages.flatMap((page) => page.codeBlocks).some((block) =>
        block.extracted?.packages?.includes("@example/sdk"),
      ),
    ).toBe(true);
  });
});

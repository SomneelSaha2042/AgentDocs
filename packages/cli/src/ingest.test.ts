import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DocPageSchema, IngestManifestSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { ingestLocalMarkdown } from "./ingest.js";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("ingestLocalMarkdown", () => {
  it("writes deterministic schema-valid pages and a manifest", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-"));
    const first = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });
    const second = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });

    expect(first.pages).toEqual(second.pages);
    expect(first.pages.map((page) => page.repoPath)).toEqual([
      "README.md",
      "guides/setup.md",
      "reference/options.mdx",
    ]);
    for (const page of first.pages) {
      expect(DocPageSchema.parse(page)).toEqual(page);
    }

    const manifest = IngestManifestSchema.parse(
      JSON.parse(await readFile(first.manifestPath, "utf8")),
    );
    expect(manifest.pageCount).toBe(3);
    expect(manifest.pages.map((page) => page.repoPath)).toEqual(
      first.pages.map((page) => page.repoPath),
    );
  });
});

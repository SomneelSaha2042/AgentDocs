import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
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

  it("removes stale pages and does not ingest its own output", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-state-"));
    await mkdir(path.join(cwd, "docs"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "guide.md"), "# First\n", "utf8");
    const first = await ingestLocalMarkdown({ cwd, out: "docs/.agentdocs", source: "docs" });
    await writeFile(path.join(cwd, "docs", "guide.md"), "# Second\n", "utf8");
    await mkdir(path.join(cwd, "docs", ".agentdocs", "task-packs"), { recursive: true });
    await writeFile(
      path.join(cwd, "docs", ".agentdocs", "task-packs", "generated.md"),
      "# Generated\n",
      "utf8",
    );
    const second = await ingestLocalMarkdown({ cwd, out: "docs/.agentdocs", source: "./docs" });
    const files = await readdir(path.join(cwd, "docs", ".agentdocs", "sources", "pages"));

    expect(second.pages).toHaveLength(1);
    expect(second.pages[0]?.title).toBe("Second");
    expect(files.filter((file) => file.endsWith(".json"))).toHaveLength(1);
    expect(files).not.toContain(`${first.pages[0]!.id}.json`);
  });

  it("does not remove pages owned by another ingested source", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-multi-"));
    await mkdir(path.join(cwd, "one"), { recursive: true });
    await mkdir(path.join(cwd, "two"), { recursive: true });
    await writeFile(path.join(cwd, "one", "one.md"), "# One\n", "utf8");
    await writeFile(path.join(cwd, "two", "two.md"), "# Two\n", "utf8");

    const first = await ingestLocalMarkdown({ cwd, out: ".agentdocs", source: "one" });
    const second = await ingestLocalMarkdown({ cwd, out: ".agentdocs", source: "two" });
    const files = await readdir(path.join(cwd, ".agentdocs", "sources", "pages"));

    expect(files).toContain(`${first.pages[0]!.id}.json`);
    expect(files).toContain(`${second.pages[0]!.id}.json`);
  });

  it("honors configured include and exclude filters", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-filter-"));
    await mkdir(path.join(cwd, "docs", "drafts"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "keep.md"), "# Keep\n", "utf8");
    await writeFile(path.join(cwd, "docs", "drafts", "skip.md"), "# Skip\n", "utf8");

    const result = await ingestLocalMarkdown({
      cwd,
      out: ".agentdocs",
      source: "./docs",
      include: ["**/*.md"],
      exclude: ["**/drafts/**"],
    });

    expect(result.pages.map((page) => page.repoPath)).toEqual(["keep.md"]);
  });
});

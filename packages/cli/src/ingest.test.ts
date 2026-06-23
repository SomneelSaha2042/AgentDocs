import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DocPageSchema, IngestManifestSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { IngestError, ingestLocalMarkdown } from "./ingest.js";

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
    expect(manifest.sourceCoverage).toMatchObject({
      supportedFiles: 3,
      unsupportedFiles: 0,
      intendedFiles: 3,
      compiledFiles: 3,
      coverageRatio: 1,
      gapSeverity: "none",
    });
    expect(manifest.pages.map((page) => page.repoPath)).toEqual(
      first.pages.map((page) => page.repoPath),
    );
  });

  it("compiles Markdown and reST files together with full source coverage", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-coverage-rest-"));
    const result = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/source-coverage/mostly-rest",
    });

    expect(result.pages.map((page) => page.repoPath)).toEqual([
      "README.md",
      "guide.rst",
      "tutorial.rst",
    ]);
    expect(result.manifest.sourceCoverage).toMatchObject({
      supportedFiles: 3,
      unsupportedFiles: 0,
      intendedFiles: 3,
      compiledFiles: 3,
      coverageRatio: 1,
      gapSeverity: "none",
      supportedByFormat: { markdown: 1, mdx: 0, rst: 2, restText: 0, adoc: 0, asciidoc: 0 },
    });
    const restPage = result.pages.find((page) => page.repoPath === "guide.rst");
    expect(restPage?.normalization.mode).toBe("rest");
    expect(restPage?.facets.map((facet) => `${facet.key}=${facet.value}`)).toContain("source_format=rst");
    expect(restPage?.codeBlocks[0]?.language).toBe("python");
    expect(restPage?.markdown).toContain("> [!NOTE]");
  });

  it("ingests Django-style .txt reST files as supported pages", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-coverage-txt-"));
    const result = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/source-coverage/django-txt",
    });

    expect(result.pages.map((page) => page.repoPath)).toEqual([
      "docs/intro.txt",
      "docs/tutorial.txt",
    ]);
    expect(result.manifest.sourceCoverage).toMatchObject({
      supportedFiles: 2,
      unsupportedFiles: 0,
      intendedFiles: 2,
      compiledFiles: 2,
      coverageRatio: 1,
      gapSeverity: "none",
      supportedByFormat: { markdown: 0, mdx: 0, rst: 0, restText: 2, adoc: 0, asciidoc: 0 },
    });
    expect(result.pages.every((page) => page.normalization.mode === "rest")).toBe(true);
  });

  it("ingests AsciiDoc files beside a supported README with full coverage", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-coverage-adoc-"));
    const result = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/source-coverage/asciidoc-with-readme",
    });

    expect(result.pages.map((page) => page.repoPath)).toEqual([
      "README.md",
      "modules/ROOT/pages/index.adoc",
      "modules/ROOT/pages/setup.asciidoc",
    ]);
    expect(result.manifest.sourceCoverage).toMatchObject({
      supportedFiles: 3,
      unsupportedFiles: 0,
      intendedFiles: 3,
      compiledFiles: 3,
      coverageRatio: 1,
      gapSeverity: "none",
      supportedByFormat: { markdown: 1, mdx: 0, rst: 0, restText: 0, adoc: 1, asciidoc: 1 },
    });
    const adocPage = result.pages.find((page) => page.repoPath === "modules/ROOT/pages/index.adoc");
    expect(adocPage?.normalization.mode).toBe("asciidoc");
    expect(adocPage?.facets.map((facet) => `${facet.key}=${facet.value}`)).toContain("source_format=adoc");
    expect(adocPage?.markdown).toContain("> [!WARNING]");
  });

  it("reports full coverage for supported Markdown and MDX sources", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-coverage-md-"));
    const result = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/source-coverage/supported-markdown",
    });

    expect(result.manifest.sourceCoverage).toMatchObject({
      supportedFiles: 2,
      unsupportedFiles: 0,
      compiledFiles: 2,
      coverageRatio: 1,
      supportedByFormat: { markdown: 1, mdx: 1 },
      gapSeverity: "none",
    });
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

  it("records deterministic partial diagnostics when file and page limits are reached", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-limits-"));
    await mkdir(path.join(cwd, "docs"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "a.md"), "# A\n\nFirst useful page.\n", "utf8");
    await writeFile(path.join(cwd, "docs", "b.md"), "# B\n\nSecond useful page.\n", "utf8");
    await writeFile(path.join(cwd, "docs", "c.md"), "# C\n\nThird useful page.\n", "utf8");

    const result = await ingestLocalMarkdown({
      cwd,
      out: ".agentdocs",
      source: "docs",
      limits: { maxFiles: 2, maxPages: 2 },
    });

    expect(result.pages.map((page) => page.repoPath)).toEqual(["a.md", "b.md"]);
    expect(result.manifest.counts).toMatchObject({ usable: 2, skipped: 1 });
    expect(result.manifest.sourceCoverage).toMatchObject({
      supportedFiles: 3,
      compiledFiles: 2,
      coverageRatio: 0.6667,
      gapSeverity: "warn",
      gapReason: "scale_limited",
    });
    expect(result.manifest.limits).toMatchObject({
      configured: { maxFiles: 2, maxPages: 2 },
      reached: ["maxFiles"],
      totalSupportedFiles: 3,
      selectedSupportedFiles: 2,
      skippedByLimit: 1,
    });
  });

  it("stops before reading a file that would exceed the byte budget", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-byte-limit-"));
    await mkdir(path.join(cwd, "docs"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "a.md"), "# A\n\nSmall page.\n", "utf8");
    await writeFile(path.join(cwd, "docs", "b.md"), "# B\n\nThis page is intentionally too large for the configured byte budget.\n", "utf8");

    const result = await ingestLocalMarkdown({
      cwd,
      out: ".agentdocs",
      source: "docs",
      limits: { maxBytes: 20 },
    });

    expect(result.pages.map((page) => page.repoPath)).toEqual(["a.md"]);
    expect(result.manifest.limits).toMatchObject({
      configured: { maxBytes: 20 },
      reached: ["maxBytes"],
      skippedByLimit: 1,
    });
    expect(result.manifest.sourceCoverage.gapReason).toBe("scale_limited");
  });

  it("applies fixed source facets and matching context rules", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-context-"));
    await mkdir(path.join(cwd, "docs", "react"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "react", "start.md"), "# Start v5\n", "utf8");

    const result = await ingestLocalMarkdown({
      cwd,
      out: ".agentdocs",
      source: "./docs",
      facets: { runtime: "node" },
      contextRules: [{ match: "**/react/**", facets: { framework: "react" } }],
    });

    expect(result.pages[0]?.facets.map(({ key, value }) => `${key}=${value}`)).toEqual([
      "framework=react",
      "runtime=node",
      "source_format=markdown",
      "version=v5",
    ]);
  });

  it("continues through malformed MDX with explicit degraded diagnostics", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-mdx-"));
    const sourcePath = path.join(REPOSITORY_ROOT, "fixtures", "hardening", "supabase", "malformed.mdx");
    const before = await readFile(sourcePath, "utf8");

    const first = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/hardening/supabase",
    });
    const second = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/hardening/supabase",
    });

    expect(first.manifest.counts).toEqual({ usable: 1, degraded: 1, skipped: 0, failed: 0 });
    expect(first.manifest.diagnostics.find((item) => item.status === "degraded"))
      .toMatchObject({ repoPath: "malformed.mdx", mode: "mdx-fallback" });
    expect(first.pages.find((page) => page.repoPath === "malformed.mdx")?.markdown)
      .toContain("Useful prose remains");
    expect(second.pages).toEqual(first.pages);
    expect(await readFile(sourcePath, "utf8")).toBe(before);
  });

  it("fails strict MDX ingestion with an actionable file-level error", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-mdx-strict-"));

    await expect(ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/hardening/supabase",
      mdxMode: "strict",
    })).rejects.toThrowError(/malformed\.mdx in strict MDX mode/);
  });

  it("writes diagnostics and fails when all files are unusable", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-unusable-"));
    await writeFile(path.join(cwd, "only.mdx"), "{unfinished(\n", "utf8");

    await expect(ingestLocalMarkdown({ cwd, out: ".agentdocs", source: "." }))
      .rejects.toThrowError(IngestError);
    const manifest = IngestManifestSchema.parse(JSON.parse(
      await readFile(path.join(cwd, ".agentdocs", "sources", "ingest-manifest.json"), "utf8"),
    ));
    expect(manifest.counts).toEqual({ usable: 0, degraded: 0, skipped: 1, failed: 0 });
    expect(manifest.diagnostics[0]).toMatchObject({ repoPath: "only.mdx", status: "skipped" });
  });

  it("reuses local ingestion for repo sources with repository-relative paths", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-repo-"));
    const result = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: ".",
      sourceType: "repo",
      include: ["fixtures/basic-docs/**/*.md"],
      exclude: ["**/drafts/**"],
    });

    expect(result.manifest.sourceType).toBe("repo");
    expect(result.pages.every((page) => page.sourceType === "repo")).toBe(true);
    expect(result.pages.map((page) => page.repoPath)).toContain("fixtures/basic-docs/README.md");
  });

  it("skips pages that have only empty content and records empty skipReason", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-empty-"));
    const result = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/parser-formats/empty-only",
    });

    expect(result.pages.map((p) => p.repoPath)).toEqual(["usable.md"]);
    expect(result.manifest.counts).toEqual({ usable: 1, degraded: 0, skipped: 1, failed: 0 });
    const skippedDiag = result.manifest.diagnostics.find((d) => d.status === "skipped");
    expect(skippedDiag).toMatchObject({
      repoPath: "blank.md",
      skipReason: "empty",
    });
  });

  it("skips pages with out-of-scope transclusion and records skipReason include-out-of-scope", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-ingest-out-of-scope-"));
    const result = await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/parser-formats/include-out-of-scope",
    });

    expect(result.pages.map((p) => p.repoPath)).toEqual(["usable.rst"]);
    expect(result.manifest.counts).toEqual({ usable: 1, degraded: 0, skipped: 1, failed: 0 });
    const skippedDiag = result.manifest.diagnostics.find((d) => d.repoPath === "shell.rst");
    expect(skippedDiag).toMatchObject({
      status: "skipped",
      skipReason: "include-out-of-scope",
      includeTargets: ["/../outside.rst"],
    });
  });
});

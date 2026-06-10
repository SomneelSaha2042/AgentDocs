import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AgentMapSchema, type AgentMap } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import {
  SearchIndexError,
  buildSearchIndex,
  formatSearchResponse,
  searchIndex,
} from "./search.js";

describe("search index", () => {
  it("builds a deterministic offline index and ranks title and heading matches first", async () => {
    const out = await temporaryDirectory();
    const first = await buildSearchIndex({ agentMap: fixtureMap(), cwd: out, out: "." });
    const firstContents = await readFile(first.indexPath);
    const second = await buildSearchIndex({ agentMap: fixtureMap(), cwd: out, out: "." });

    expect(second.backend).toBe(first.backend);
    expect(await readFile(second.indexPath)).toEqual(firstContents);

    const response = await searchIndex({
      cwd: out,
      out: ".",
      query: "authentication",
    });
    expect(response.results).toHaveLength(2);
    expect(response.results[0]).toMatchObject({
      pageId: "page_auth",
      chunkId: "chunk_auth",
      title: "Authentication",
      repoPath: "docs/auth.md",
    });
    expect(response.results[0]!.score).toBeGreaterThan(response.results[1]!.score);
    expect(response.results[0]!.snippet.toLowerCase()).toContain("authentication");
  });

  it("returns no results for empty and unmatched queries", async () => {
    const out = await temporaryDirectory();
    await buildSearchIndex({ agentMap: fixtureMap(), cwd: out, out: "." });

    await expect(searchIndex({ cwd: out, out: ".", query: "   " }))
      .resolves.toEqual({ query: "   ", results: [] });
    await expect(searchIndex({ cwd: out, out: ".", query: "webhook" }))
      .resolves.toEqual({ query: "webhook", results: [] });
  });

  it("searches a schema-valid lexical fallback index", async () => {
    const out = await temporaryDirectory();
    await writeFile(path.join(out, "index.sqlite"), `${JSON.stringify({
      schemaVersion: 1,
      backend: "lexical",
      documents: [{
        pageId: "page_fallback",
        chunkId: "chunk_fallback",
        title: "Webhook verification",
        repoPath: "docs/webhooks.md",
        headingPath: ["Verify signatures"],
        text: "Verify each webhook signature before processing the event.",
        contentHash: "a".repeat(64),
      }, {
        pageId: "page_unrelated",
        chunkId: "chunk_unrelated",
        title: "Capitalization",
        repoPath: "docs/style.md",
        headingPath: ["Style"],
        text: "Use sentence case.",
        contentHash: "b".repeat(64),
      }, {
        pageId: "page_unicode",
        chunkId: "chunk_unicode",
        title: "認証",
        repoPath: "docs/auth-ja.md",
        headingPath: ["認証"],
        text: "認証トークンを設定します。",
        contentHash: "c".repeat(64),
      }],
    })}\n`, "utf8");

    const response = await searchIndex({ cwd: out, out: ".", query: "webhook" });
    expect(response.results[0]).toMatchObject({
      pageId: "page_fallback",
      chunkId: "chunk_fallback",
      repoPath: "docs/webhooks.md",
    });
    await expect(searchIndex({ cwd: out, out: ".", query: "api" }))
      .resolves.toEqual({ query: "api", results: [] });
    expect((await searchIndex({ cwd: out, out: ".", query: "認証" })).results[0])
      .toMatchObject({ pageId: "page_unicode" });
  });

  it("rejects missing and malformed indexes with actionable errors", async () => {
    const out = await temporaryDirectory();
    await expect(searchIndex({ cwd: out, out: ".", query: "auth" }))
      .rejects.toThrowError(/Run "agentdocs build --skip-crawl" first/);

    await writeFile(path.join(out, "index.sqlite"), "not an index\n", "utf8");
    await expect(searchIndex({ cwd: out, out: ".", query: "auth" }))
      .rejects.toThrowError(SearchIndexError);
  });

  it("keeps the last good index when replacement generation fails", async () => {
    const out = await temporaryDirectory();
    const first = await buildSearchIndex({ agentMap: fixtureMap(), cwd: out, out: "." });
    const firstContents = await readFile(first.indexPath);
    const broken = {
      ...fixtureMap(),
      chunks: fixtureMap().chunks.map((chunk) => ({ ...chunk, pageId: "missing_page" })),
    };

    await expect(buildSearchIndex({ agentMap: broken, cwd: out, out: "." }))
      .rejects.toThrowError(/references missing page/);
    expect(await readFile(first.indexPath)).toEqual(firstContents);
  });

  it("validates SQLite metadata before searching", async () => {
    const out = await temporaryDirectory();
    const result = await buildSearchIndex({ agentMap: fixtureMap(), cwd: out, out: "." });
    if (result.backend !== "sqlite-fts5") {
      return;
    }
    const { DatabaseSync } = await import("node:sqlite");
    const database = new DatabaseSync(result.indexPath);
    database.exec("DELETE FROM metadata WHERE key = 'schema_version'");
    database.close();

    await expect(searchIndex({ cwd: out, out: ".", query: "auth" }))
      .rejects.toThrowError(/Unsupported search index metadata/);
  });

  it("formats identifiers, source, score, and snippet for humans", async () => {
    const out = await temporaryDirectory();
    await buildSearchIndex({ agentMap: fixtureMap(), cwd: out, out: "." });
    const response = await searchIndex({ cwd: out, out: ".", query: "authentication" });

    expect(formatSearchResponse(response)).toContain(
      "score=",
    );
    expect(formatSearchResponse(response)).toContain("page=page_auth chunk=chunk_auth");
    expect(formatSearchResponse({ query: "missing", results: [] }))
      .toBe('No results found for "missing".\n');
  });
});

function fixtureMap(): AgentMap {
  const hash = "a".repeat(64);
  return AgentMapSchema.parse({
    schemaVersion: "0.1.0",
    pages: [
      {
        id: "page_auth",
        sourceType: "local_markdown",
        repoPath: "docs/auth.md",
        title: "Authentication",
        markdown: "# Authentication\nUse an API key.",
        headings: [],
        links: [],
        codeBlocks: [],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
      },
      {
        id: "page_setup",
        sourceType: "website",
        sourceUrl: "https://example.com/setup",
        title: "Setup",
        markdown: "# Setup\nAuthentication is mentioned briefly.",
        headings: [],
        links: [],
        codeBlocks: [],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
      },
    ],
    chunks: [
      {
        id: "chunk_auth",
        pageId: "page_auth",
        headingPath: ["Authentication"],
        text: "# Authentication\nUse an API key for authentication.",
        tokenEstimate: 8,
        links: [],
        entityIds: [],
        contentHash: hash,
      },
      {
        id: "chunk_setup",
        pageId: "page_setup",
        headingPath: ["Setup"],
        text: "# Setup\nAuthentication is mentioned briefly.",
        tokenEstimate: 7,
        links: [],
        entityIds: [],
        contentHash: hash,
      },
    ],
    entities: [],
    edges: [],
    taskPacks: [],
  });
}

async function temporaryDirectory(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "agentdocs-indexer-"));
}

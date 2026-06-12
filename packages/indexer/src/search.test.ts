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
      .resolves.toEqual({ query: "   ", results: [], warnings: [] });
    await expect(searchIndex({ cwd: out, out: ".", query: "webhook" }))
      .resolves.toEqual({ query: "webhook", results: [], warnings: [] });
  });

  it("does not let repeated body terms outrank a stronger title match", async () => {
    const out = await temporaryDirectory();
    const map = fixtureMap();
    map.pages.push({
      ...map.pages[0]!,
      id: "page_retries",
      repoPath: "docs/retries.md",
      title: "Automatic retries",
    });
    map.chunks.push({
      ...map.chunks[0]!,
      id: "chunk_retries",
      pageId: "page_retries",
      headingPath: ["Automatic retries"],
      text: "Retry failed requests automatically.",
    }, {
      ...map.chunks[0]!,
      id: "chunk_requests",
      pageId: "page_setup",
      headingPath: ["Requests"],
      text: "request request request request request request retry",
    });
    await buildSearchIndex({ agentMap: AgentMapSchema.parse(map), cwd: out, out: "." });

    const response = await searchIndex({ cwd: out, out: ".", query: "request retries" });

    expect(response.results[0]?.pageId).toBe("page_retries");
  });

  it("diversifies leading results across pages", async () => {
    const out = await temporaryDirectory();
    const map = fixtureMap();
    map.chunks.push({
      ...map.chunks[0]!,
      id: "chunk_auth_second",
      text: "Authentication token authentication credentials.",
    });
    await buildSearchIndex({ agentMap: AgentMapSchema.parse(map), cwd: out, out: "." });

    const response = await searchIndex({ cwd: out, out: ".", query: "authentication", limit: 2 });

    expect(new Set(response.results.map((result) => result.pageId)).size).toBe(2);
  });

  it("gives distinctive task terms more weight than corpus-wide product terms", async () => {
    const out = await temporaryDirectory();
    const map = fixtureMap();
    map.pages = [
      {
        ...map.pages[0]!,
        id: "page_compliance",
        repoPath: "docs/compliance.md",
        title: "Acme SDK compliance",
      },
      {
        ...map.pages[0]!,
        id: "page_configure",
        repoPath: "docs/configure.md",
        title: "Configure credentials",
      },
    ];
    map.chunks = [
      {
        ...map.chunks[0]!,
        id: "chunk_compliance",
        pageId: "page_compliance",
        headingPath: ["Acme SDK compliance"],
        text: "Acme SDK JavaScript compliance validation.",
      },
      {
        ...map.chunks[0]!,
        id: "chunk_configure",
        pageId: "page_configure",
        headingPath: ["Configure credentials"],
        text: "Configure the Acme SDK JavaScript client with credentials.",
      },
    ];
    await buildSearchIndex({ agentMap: AgentMapSchema.parse(map), cwd: out, out: "." });

    const response = await searchIndex({
      cwd: out,
      out: ".",
      query: "configure Acme SDK JavaScript",
    });

    expect(response.results[0]?.pageId).toBe("page_configure");
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
      .resolves.toEqual({ query: "api", results: [], warnings: [] });
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
    expect(formatSearchResponse({ query: "missing", results: [], warnings: [] }))
      .toBe('No results found for "missing".\n');
  });

  it("carries deterministic evidence-linked facets into search results", async () => {
    const out = await temporaryDirectory();
    const map = fixtureMap();
    const evidence = [{ source: "config" as const, quote: "framework=react" }];
    map.pages[0]!.facets = [{ key: "framework", value: "react", evidence }];
    map.chunks[0]!.facets = [{ key: "framework", value: "react", evidence }];
    await buildSearchIndex({ agentMap: AgentMapSchema.parse(map), cwd: out, out: "." });

    const response = await searchIndex({ cwd: out, out: ".", query: "authentication" });

    expect(response.results[0]?.facets).toEqual([
      { key: "framework", value: "react", evidence },
    ]);
    expect(formatSearchResponse(response)).toContain("facets=framework=react");
  });

  it("hard-filters facets, prefers configured context, warns on mixing, and routes task queries", async () => {
    const out = await temporaryDirectory();
    const map = fixtureMap();
    const evidence = [{ source: "config" as const, quote: "fixture facet" }];
    map.pages[0]!.facets = [{ key: "framework", value: "react", evidence }];
    map.chunks[0]!.facets = [{ key: "framework", value: "react", evidence }];
    map.pages[1]!.facets = [{ key: "framework", value: "vue", evidence }];
    map.chunks[1]!.facets = [{ key: "framework", value: "vue", evidence }];
    map.taskPacks = [{
      id: "quickstart",
      title: "Quickstart",
      description: "Start here.",
      confidence: "high",
      requiredPages: ["page_auth"],
      relatedEntities: [],
      steps: [{ title: "Start", description: "Use the source.", evidence }],
      gotchas: [],
      codeExamples: [],
      evidence,
      context: { facets: {}, conflicts: [] },
    }];
    await buildSearchIndex({
      agentMap: AgentMapSchema.parse(map),
      cwd: out,
      out: ".",
      preferredFacets: { framework: "react" },
      exclusiveKeys: ["framework"],
    });

    const filtered = await searchIndex({
      cwd: out, out: ".", query: "authentication", facets: { framework: "react" },
    });
    expect(filtered.results.every((result) =>
      result.facets.some((facet) => facet.value === "react"))).toBe(true);
    const mixed = await searchIndex({ cwd: out, out: ".", query: "authentication" });
    expect(mixed.results[0]?.pageId).toBe("page_auth");
    expect(mixed.warnings).toEqual([
      { code: "context_conflict", key: "framework", values: ["react", "vue"] },
    ]);
    const task = await searchIndex({ cwd: out, out: ".", query: "quickstart" });
    expect(task.results[0]?.pageId).toBe("page_auth");
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

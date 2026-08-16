import { describe, expect, it } from "vitest";

import { AgentMapSchema, DocumentationMapSchema, type AgentMap } from "@agentdocs/shared";

import {
  compileDocumentationMap,
  DocumentationMapNavigationError,
  DocumentationMapNavigator,
} from "./navigator.js";

const digest = "a".repeat(64);

function fixtureAgentMap(): AgentMap {
  return AgentMapSchema.parse({
    schemaVersion: "0.2.0",
    pages: [{
      id: "page_auth",
      sourceType: "website",
      sourceUrl: "https://docs.example.com/guides/auth",
      canonicalUrl: "https://docs.example.com/guides/auth",
      title: "Authentication",
      markdown: "# Authentication\n\nIntro.\n\n## Install\n\nInstall first.\n\n## Configure\n\nSet the token.\n",
      headings: [
        { id: "heading_auth", depth: 1, text: "Authentication", slug: "authentication", position: { startLine: 1, endLine: 1 } },
        { id: "heading_install", depth: 2, text: "Install", slug: "install", position: { startLine: 5, endLine: 5 } },
        { id: "heading_configure", depth: 2, text: "Configure", slug: "configure", position: { startLine: 9, endLine: 9 } },
      ],
      links: [],
      codeBlocks: [{ id: "code_install", sourceOrder: 0, language: "sh", value: "npm install sdk", sourceHeadingId: "heading_install" }],
      contentHash: digest,
      discoveredAt: "2026-08-08T00:00:00.000Z",
      versionHints: [],
    }],
    // Deliberately reverse storage order: traversal must use sourceOrder.
    chunks: [
      {
        id: "chunk_configure",
        pageId: "page_auth",
        sourceOrder: 1,
        headingId: "heading_configure",
        headingPath: ["Authentication", "Configure"],
        text: "## Configure\n\nSet the token.",
        tokenEstimate: 8,
        links: [],
        entityIds: ["entity_token"],
        contentHash: digest,
      },
      {
        id: "chunk_install",
        pageId: "page_auth",
        sourceOrder: 0,
        headingId: "heading_install",
        headingPath: ["Authentication", "Install"],
        text: "## Install\n\nInstall first.",
        tokenEstimate: 8,
        links: [],
        entityIds: [],
        contentHash: digest,
      },
    ],
    entities: [{
      id: "entity_token",
      type: "env_var",
      name: "API_TOKEN",
      aliases: [],
      sourcePageIds: ["page_auth"],
      evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_configure", chunkId: "chunk_configure" }],
    }],
    edges: [],
    taskPacks: [],
  });
}

function navigator(): DocumentationMapNavigator {
  return new DocumentationMapNavigator({ agentMap: fixtureAgentMap() });
}

function relatedRefs(result: ReturnType<DocumentationMapNavigator["browse"]>, type: string): string[] {
  return result.relations
    .filter((relation) => relation.type === type && relation.direction === "outgoing")
    .flatMap((relation) => relation.nodes.map((node) => node.ref));
}

describe("DocumentationMapNavigator", () => {
  it("compiles a deterministic standalone map that can be hydrated without changing traversal", () => {
    const agentMap = fixtureAgentMap();
    const first = compileDocumentationMap({ agentMap });
    const second = compileDocumentationMap({ agentMap });
    const hydrated = new DocumentationMapNavigator({ agentMap, documentationMap: first });

    expect(DocumentationMapSchema.parse(first)).toEqual(first);
    expect(first).toEqual(second);
    expect(hydrated.browse()).toEqual(new DocumentationMapNavigator({ agentMap }).browse());
    expect(first.nodes.some((node) => node.ref.endsWith("#chunk_install") && node.order === 0)).toBe(true);
  });

  it("rejects a compiled map from a different evidence graph", () => {
    const agentMap = fixtureAgentMap();
    const documentationMap = compileDocumentationMap({ agentMap });

    expect(() => new DocumentationMapNavigator({
      agentMap: AgentMapSchema.parse({ ...agentMap, chunks: [...agentMap.chunks].reverse() }),
      documentationMap,
    })).toThrow(/does not match agent-map\.json/);
  });

  it("starts from a compact map and exposes structural entry points", () => {
    const result = navigator().browse();

    expect(result.node.ref).toBe("agentdocs://map");
    expect(relatedRefs(result, "contains")).toEqual([
      "agentdocs://map/pages",
      "agentdocs://map/entities",
    ]);
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it("preserves document locality and exposes semantic occurrences", () => {
    const map = navigator();
    const install = map.browse({ ref: "agentdocs://pages/page_auth.md#chunk_install" });
    const configure = map.browse({ ref: "agentdocs://pages/page_auth.md#chunk_configure" });
    const entity = map.browse({ ref: "agentdocs://entities/entity_token" });

    expect(relatedRefs(install, "precedes")).toEqual(["agentdocs://pages/page_auth.md#chunk_configure"]);
    expect(relatedRefs(configure, "follows")).toEqual(["agentdocs://pages/page_auth.md#chunk_install"]);
    expect(relatedRefs(configure, "mentions")).toEqual(["agentdocs://entities/entity_token"]);
    expect(relatedRefs(entity, "occurs_in")).toContain("agentdocs://pages/page_auth.md#chunk_configure");
  });

  it("reads the exact source section selected during traversal", () => {
    const result = navigator().read("agentdocs://pages/page_auth.md#heading_install");

    expect(result.section.headingPath).toEqual(["Authentication", "Install"]);
    expect(result.section.text).toBe("## Install\n\nInstall first.");
    expect(result.section.text).not.toContain("Configure");
  });

  it("uses stable bounded cursors", () => {
    const map = navigator();
    const first = map.browse({ ref: "agentdocs://map", limit: 1 });
    const second = map.browse({ ref: "agentdocs://map", limit: 1, cursor: first.nextCursor });

    expect(first.complete).toBe(false);
    expect(first.nextCursor).toBeDefined();
    expect(relatedRefs(first, "contains")).toEqual(["agentdocs://map/pages"]);
    expect(relatedRefs(second, "contains")).toEqual(["agentdocs://map/entities"]);
    expect(() => map.browse({ ref: "agentdocs://map/pages", cursor: first.nextCursor }))
      .toThrow(DocumentationMapNavigationError);
    expect(() => map.browse({ ref: "agentdocs://map", cursor: first.nextCursor, relations: ["contains"] }))
      .toThrow(DocumentationMapNavigationError);
  });
});

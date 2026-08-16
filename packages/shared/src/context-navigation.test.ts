import { describe, expect, it } from "vitest";

import { ContextNavigationCatalog } from "./context-navigation.js";
import { AgentMapSchema } from "./models.js";

describe("ContextNavigationCatalog", () => {
  it("preserves heading hierarchy and surfaces an un-ingested external reference", () => {
    const map = fixtureMap();
    const result = new ContextNavigationCatalog(map).build({
      relevantChunkIds: ["chunk_signature"],
      requirementValues: ["verify signatures"],
    });

    expect(result.complete).toBe(true);
    expect(result.branches).toHaveLength(1);
    expect(result.branches[0]?.headings.map((heading) => heading.headingPath)).toEqual([
      ["Webhooks"],
      ["Webhooks", "Verify signatures"],
    ]);
    expect(result.branches[0]?.headings[1]).toMatchObject({
      depth: 2,
      matchedFor: ["verify signatures"],
      evidenceKinds: ["code", "links", "prose"],
      childHeadingCount: 1,
    });
    expect(result.externalReferences).toEqual([
      expect.objectContaining({
        status: "external_uningested",
        url: "https://vendor.example.com/nextjs/webhook",
        sourcePageId: "page_webhooks",
        headingPath: ["Webhooks", "Verify signatures"],
      }),
    ]);
  });

  it("does not report a cross-origin link as unresolved when its target was ingested", () => {
    const map = fixtureMap();
    map.pages.push({
      id: "page_vendor",
      sourceType: "website",
      sourceUrl: "https://vendor.example.com/nextjs/webhook",
      canonicalUrl: "https://vendor.example.com/nextjs/webhook",
      title: "Vendor webhook example",
      markdown: "# Vendor webhook example\n",
      headings: [{ id: "heading_vendor", depth: 1, text: "Vendor webhook example", slug: "vendor-webhook-example", position: {} }],
      links: [],
      codeBlocks: [],
      contentHash: "b".repeat(64),
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
      facets: [],
      normalization: { mode: "strict", warnings: [] },
    });

    expect(new ContextNavigationCatalog(map).build({ relevantChunkIds: ["chunk_signature"] }).externalReferences)
      .toEqual([]);
  });

  it("orders branches and references deterministically", () => {
    const map = fixtureMap();
    const first = new ContextNavigationCatalog(map).build({ relevantChunkIds: ["chunk_signature"] });
    const second = new ContextNavigationCatalog(map).build({ relevantChunkIds: ["chunk_signature"] });
    expect(second).toEqual(first);
  });

  it("supports heading scopes and deterministic continuation cursors", () => {
    const map = fixtureMap();
    for (let index = 0; index < 5; index += 1) {
      const pageId = `page_extra_${index}`;
      map.pages.push({
        id: pageId,
        sourceType: "local_markdown",
        sourceUrl: `file:///docs/extra-${index}.md`,
        title: `Extra ${index}`,
        markdown: `# Extra ${index}\n\nDetails\n`,
        headings: [{ id: `${pageId}_heading`, depth: 1, text: `Extra ${index}`, slug: `extra-${index}`, position: {} }],
        links: [],
        codeBlocks: [],
        contentHash: `${index}`.repeat(64),
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
        facets: [],
        normalization: { mode: "strict", warnings: [] },
      });
      map.chunks.push({
        id: `${pageId}_chunk`,
        kind: "section",
        pageId,
        headingPath: [`Extra ${index}`],
        text: `Details ${index}`,
        tokenEstimate: 2,
        links: [],
        entityIds: [],
        contentHash: `${index}a`.repeat(32),
        facets: [],
      });
    }
    const catalog = new ContextNavigationCatalog(map);
    const all = catalog.build({ relevantChunkIds: map.chunks.map((chunk) => chunk.id) });
    expect(all.branches).toHaveLength(4);
    expect(all.complete).toBe(false);
    expect(all.nextCursor).toBeDefined();

    const rest = catalog.build({
      relevantChunkIds: map.chunks.map((chunk) => chunk.id),
      navigationCursor: all.nextCursor,
    });
    expect(rest.complete).toBe(true);
    expect(rest.branches.map((branch) => branch.pageId)).toEqual(["page_extra_3", "page_extra_4"]);

    const scoped = catalog.build({
      relevantChunkIds: map.chunks.map((chunk) => chunk.id),
      scopeRefs: ["agentdocs://pages/page_webhooks.md#heading_signature"],
    });
    expect(scoped.scopeRefs).toEqual(["agentdocs://pages/page_webhooks.md#heading_signature"]);
    expect(scoped.branches).toHaveLength(1);
    expect(scoped.branches[0]?.headings.map((heading) => heading.headingPath)).toEqual([
      ["Webhooks"],
      ["Webhooks", "Verify signatures"],
    ]);
  });

  it("rejects invalid scope and continuation references", () => {
    const catalog = new ContextNavigationCatalog(fixtureMap());
    expect(() => catalog.build({ scopeRefs: ["agentdocs://pages/missing.md"] }))
      .toThrow(/was not found/);
    expect(() => catalog.build({ relevantChunkIds: ["chunk_signature"], navigationCursor: "bad" }))
      .toThrow(/Invalid navigation cursor/);
  });
});

function fixtureMap() {
  return AgentMapSchema.parse({
    schemaVersion: "0.2.0",
    pages: [{
      id: "page_webhooks",
      sourceType: "website",
      sourceUrl: "https://docs.example.com/webhooks",
      canonicalUrl: "https://docs.example.com/webhooks",
      title: "Webhooks",
      markdown: "# Webhooks\n\n## Verify signatures\nSee the [Next.js example](https://vendor.example.com/nextjs/webhook).\n\n### Framework details\n",
      headings: [
        { id: "heading_webhooks", depth: 1, text: "Webhooks", slug: "webhooks", position: {} },
        { id: "heading_signature", depth: 2, text: "Verify signatures", slug: "verify-signatures", position: {} },
        { id: "heading_framework", depth: 3, text: "Framework details", slug: "framework-details", position: {} },
      ],
      links: [{
        text: "Next.js example",
        href: "https://vendor.example.com/nextjs/webhook",
        resolvedHref: "https://vendor.example.com/nextjs/webhook",
        kind: "external",
        sourceHeadingId: "heading_signature",
      }],
      codeBlocks: [{
        id: "code_signature",
        language: "ts",
        value: "verifySignature(payload)",
        sourceHeadingId: "heading_signature",
      }],
      contentHash: "a".repeat(64),
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
      facets: [],
      normalization: { mode: "strict", warnings: [] },
    }],
    chunks: [{
      id: "chunk_signature",
      kind: "section",
      pageId: "page_webhooks",
      headingPath: ["Webhooks", "Verify signatures"],
      text: "Verify signature before processing the event.",
      tokenEstimate: 8,
      links: ["https://vendor.example.com/nextjs/webhook"],
      entityIds: [],
      contentHash: "c".repeat(64),
      facets: [],
    }],
    entities: [],
    edges: [],
    taskPacks: [],
  });
}

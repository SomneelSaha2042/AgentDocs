import { createHash } from "node:crypto";

import { AgentMapSchema, ManifestSchema, TaskPackSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { generateStaticArtifacts } from "./generator.js";

describe("generateStaticArtifacts", () => {
  it("generates deterministic compact evidence-linked artifacts", () => {
    const pageId = "page_fixture";
    const markdown = `# Setup

Install and configure the client.

\`\`\`bash
pnpm add @example/sdk
\`\`\`
`;
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "setup.md",
          title: "Setup",
          description: "Example SDK documentation.",
          markdown,
          headings: [
            {
              id: "heading_setup",
              depth: 1,
              text: "Setup",
              slug: "setup",
              position: { startLine: 1, endLine: 1 },
            },
          ],
          links: [],
          codeBlocks: [
            {
              id: "code_install",
              language: "bash",
              value: "pnpm add @example/sdk",
              sourceHeadingId: "heading_setup",
              extracted: {
                packages: ["@example/sdk"],
                imports: [],
                envVars: [],
                cliCommands: ["pnpm add @example/sdk"],
                httpRoutes: [],
              },
            },
          ],
          contentHash: hash(markdown),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
      ],
      chunks: [
        {
          id: "chunk_setup",
          pageId,
          headingPath: ["Setup"],
          text: markdown.trim(),
          tokenEstimate: 20,
          links: [],
          entityIds: ["package_fixture"],
          contentHash: hash(markdown.trim()),
        },
      ],
      entities: [
        {
          id: "package_fixture",
          type: "package",
          name: "@example/sdk",
          aliases: [],
          sourcePageIds: [pageId],
          evidence: [
            {
              source: "code_block",
              pageId,
              codeBlockId: "code_install",
              repoPath: "setup.md",
              quote: "pnpm add @example/sdk",
            },
          ],
        },
      ],
      edges: [],
      taskPacks: [],
    });

    const first = generateStaticArtifacts({
      agentMap,
      project: { name: "Example SDK", slug: "example-sdk", version: "v2" },
      rules: ["Prefer current SDK examples."],
    });
    const second = generateStaticArtifacts({
      agentMap,
      project: { name: "Example SDK", slug: "example-sdk", version: "v2" },
      rules: ["Prefer current SDK examples."],
    });

    expect(first).toEqual(second);
    expect(ManifestSchema.parse(first.manifest)).toEqual(first.manifest);
    for (const pack of first.taskPacks) {
      expect(TaskPackSchema.parse(pack)).toEqual(pack);
      expect(pack.evidence.length).toBeGreaterThan(0);
    }
    expect({
      agentsMd: first.agentsMd,
      llmsTxt: first.llmsTxt,
      taskPackMarkdown: first.taskPackMarkdown,
    }).toMatchSnapshot();
  });

  it("does not generate task packs from weak keyword-list mentions", () => {
    const markdown = "# Product plan\nTask families include authentication, webhooks, and pagination.";
    const weak = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [{
        id: "page_plan",
        sourceType: "local_markdown",
        repoPath: "plan.md",
        title: "Product plan",
        markdown,
        headings: [{ id: "heading_plan", depth: 1, text: "Product plan", slug: "product-plan", position: {} }],
        links: [],
        codeBlocks: [],
        contentHash: hash(markdown),
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
      }],
      chunks: [{
        id: "chunk_plan",
        pageId: "page_plan",
        headingPath: ["Product plan"],
        text: markdown,
        tokenEstimate: 10,
        links: [],
        entityIds: [],
        contentHash: hash(markdown),
      }],
      entities: [],
      edges: [],
      taskPacks: [],
    });

    const generated = generateStaticArtifacts({
      agentMap: weak,
      project: { name: "Weak Fixture", slug: "weak-fixture" },
    });

    expect(generated.taskPacks).toEqual([]);
  });

  it("does not select task families from keyword substrings", () => {
    const markdown = "# Prevention\n\nPrevent failures before production.\n";
    const pageId = "page_prevention";
    const generated = generateStaticArtifacts({
      project: { name: "Example", slug: "example" },
      agentMap: AgentMapSchema.parse({
        schemaVersion: "0.1.0",
        pages: [{
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "prevention.md",
          title: "Prevention",
          markdown,
          headings: [{
            id: "heading_prevention",
            depth: 1,
            text: "Prevention",
            slug: "prevention",
            position: { startLine: 1, endLine: 1 },
          }],
          links: [],
          codeBlocks: [],
          contentHash: hash(markdown),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        }],
        chunks: [{
          id: "chunk_prevention",
          pageId,
          headingPath: ["Prevention"],
          text: markdown.trim(),
          tokenEstimate: 10,
          links: [],
          entityIds: [],
          contentHash: hash(markdown.trim()),
        }],
        entities: [],
        edges: [],
        taskPacks: [],
      }),
    });

    expect(generated.taskPacks.some((pack) => pack.id === "webhooks")).toBe(false);
  });

  it("does not generate a webhook pack from generic event headings", () => {
    const markdown = "# Event handlers\n\nRegister a scheduled event handler.\n";
    const generated = generateStaticArtifacts({
      project: { name: "Events", slug: "events" },
      agentMap: singlePageMap("Event handlers", markdown),
    });

    expect(generated.taskPacks.some((pack) => pack.id === "webhooks")).toBe(false);
  });

  it("uses page titles to generate packs for frontmatter-titled pages", () => {
    const markdown = "Use the paginate method to retrieve all pages.";
    const generated = generateStaticArtifacts({
      project: { name: "SDK", slug: "sdk" },
      agentMap: singlePageMap("Pagination", markdown),
    });

    expect(generated.taskPacks.some((pack) => pack.id === "pagination")).toBe(true);
  });

  it("does not advertise task-pack files when links are disabled", () => {
    const markdown = "# Setup\n\nInstall the SDK.\n";
    const pageId = "page_setup";
    const generated = generateStaticArtifacts({
      linkTaskPacks: false,
      project: { name: "Example", slug: "example" },
      agentMap: AgentMapSchema.parse({
        schemaVersion: "0.1.0",
        pages: [{
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "setup.md",
          title: "Setup",
          markdown,
          headings: [{
            id: "heading_setup",
            depth: 1,
            text: "Setup",
            slug: "setup",
            position: { startLine: 1, endLine: 1 },
          }],
          links: [],
          codeBlocks: [],
          contentHash: hash(markdown),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        }],
        chunks: [{
          id: "chunk_setup",
          pageId,
          headingPath: ["Setup"],
          text: markdown.trim(),
          tokenEstimate: 8,
          links: [],
          entityIds: [],
          contentHash: hash(markdown.trim()),
        }],
        entities: [],
        edges: [],
        taskPacks: [],
      }),
    });

    expect(generated.taskPacks.length).toBeGreaterThan(0);
    expect(generated.llmsTxt).not.toContain("task-packs/");
    expect(generated.agentsMd).not.toContain("task-packs/");
  });
});

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function singlePageMap(title: string, markdown: string) {
  const pageId = `page_${title.toLowerCase().replace(/\W+/g, "_")}`;
  return AgentMapSchema.parse({
    schemaVersion: "0.1.0",
    pages: [{
      id: pageId,
      sourceType: "local_markdown",
      repoPath: `${title.toLowerCase().replace(/\W+/g, "-")}.md`,
      title,
      markdown,
      headings: [],
      links: [],
      codeBlocks: [],
      contentHash: hash(markdown),
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
    }],
    chunks: [{
      id: `chunk_${pageId}`,
      pageId,
      headingPath: [title],
      text: markdown,
      tokenEstimate: 10,
      links: [],
      entityIds: [],
      contentHash: hash(markdown),
    }],
    entities: [],
    edges: [],
    taskPacks: [],
  });
}

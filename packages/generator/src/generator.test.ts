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
});

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

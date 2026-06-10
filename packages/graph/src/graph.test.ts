import { chunkMarkdownByHeading, normalizeMarkdown } from "@agentdocs/normalizer";
import { AgentMapSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { buildAgentMap } from "./graph.js";

describe("buildAgentMap", () => {
  it("builds a deterministic evidence-linked graph", () => {
    const index = normalizeMarkdown({
      markdown: `# Index

[Setup](setup.md)

\`\`\`bash
pnpm add @acme/sdk
\`\`\`
`,
      repoPath: "index.md",
    });
    const setup = normalizeMarkdown({
      markdown: `# Setup

Use GET /v1/widgets with v2.

\`\`\`ts
import { Client } from "@acme/sdk";
const client = new Client({ apiKey: process.env.ACME_API_KEY });
\`\`\`
`,
      repoPath: "setup.md",
    });
    const pages = [index, setup];
    const chunks = pages.flatMap((page) => chunkMarkdownByHeading(page));

    const first = buildAgentMap({ chunks, pages });
    const second = buildAgentMap({ chunks, pages });

    expect(first).toEqual(second);
    expect(AgentMapSchema.parse(first)).toEqual(first);
    expect(first.chunks.flatMap((chunk) => chunk.entityIds).every((id) =>
      first.entities.some((entity) => entity.id === id),
    )).toBe(true);
    expect(first.entities.every((entity) => entity.evidence.length > 0)).toBe(true);
    expect(first.edges.every((edge) => edge.evidence.length > 0)).toBe(true);
    expect({
      entities: first.entities.map(({ type, name }) => ({ type, name })),
      edges: first.edges.map(({ from, type, to }) => ({ from, type, to })),
    }).toMatchSnapshot();
  });

  it("rejects chunks that reference missing pages", () => {
    const page = normalizeMarkdown({ markdown: "# Page\n", repoPath: "page.md" });
    const [chunk] = chunkMarkdownByHeading(page);

    expect(() =>
      buildAgentMap({
        chunks: [{ ...chunk!, pageId: "page_missing" }],
        pages: [page],
      }),
    ).toThrowError(/references missing page/);
  });
});

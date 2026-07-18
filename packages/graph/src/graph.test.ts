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

Use v2.

GET /v1/widgets

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

  it("does not represent relative imports as packages", () => {
    const page = normalizeMarkdown({
      markdown: `# Example

\`\`\`ts
import helper from "./helper.js";
import fs from "node:fs";
import internal from "#internal";
import { Client } from "@acme/sdk";
\`\`\`
`,
      repoPath: "example.md",
    });
    const graph = buildAgentMap({
      pages: [page],
      chunks: chunkMarkdownByHeading(page),
    });

    expect(graph.entities.filter((entity) => entity.type === "package").map((entity) => entity.name))
      .toEqual(["@acme/sdk"]);
  });

  it("resolves extensionless site routes to Markdown pages", () => {
    const index = normalizeMarkdown({
      markdown: "# Index\n\n[Setup](/docs/setup)\n",
      repoPath: "docs/index.md",
    });
    const setup = normalizeMarkdown({
      markdown: "# Setup\n",
      repoPath: "docs/setup.md",
    });
    const graph = buildAgentMap({
      pages: [index, setup],
      chunks: [index, setup].flatMap((page) => chunkMarkdownByHeading(page)),
    });

    expect(graph.edges.some((edge) =>
      edge.type === "links_to" && edge.from === index.id && edge.to === setup.id
    )).toBe(true);
  });

  it("does not create API entities from conversational route-like prose", () => {
    const page = normalizeMarkdown({
      markdown: `# Routes

You can GET / fetch the data in a broad conceptual sense.

\`\`\`http
POST /v1/users
\`\`\`
`,
      repoPath: "routes.md",
    });

    const graph = buildAgentMap({
      pages: [page],
      chunks: chunkMarkdownByHeading(page),
    });

    expect(graph.entities.filter((entity) => entity.type === "api").map((entity) => entity.name))
      .toEqual(["POST /v1/users"]);
  });
});

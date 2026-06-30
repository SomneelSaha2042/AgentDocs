import { ChunkSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { normalizeMarkdown } from "./markdown.js";
import { chunkMarkdownByHeading } from "./chunk.js";

describe("chunkMarkdownByHeading", () => {
  it("preserves heading paths, links, code blocks, and stable hashes", () => {
    const page = normalizeMarkdown({
      repoPath: "guide.md",
      markdown: `# Guide

Intro.

## Setup

[Options](./options.md)

\`\`\`bash
pnpm add @acme/sdk
\`\`\`
`,
    });
    const first = chunkMarkdownByHeading(page, { maxTokens: 40 });
    const second = chunkMarkdownByHeading(page, { maxTokens: 40 });

    expect(first).toEqual(second);
    expect(first.some((chunk) => chunk.headingPath.join(" > ") === "Guide > Setup"))
      .toBe(true);
    expect(first.some((chunk) => chunk.text.includes("pnpm add @acme/sdk"))).toBe(true);
    expect(first.flatMap((chunk) => chunk.links)).toContain("options.md");
    for (const chunk of first) {
      expect(ChunkSchema.parse(chunk)).toEqual(chunk);
    }
  });

  it("splits oversized prose below the configured approximate token size", () => {
    const page = normalizeMarkdown({
      repoPath: "long.md",
      markdown: `# Long\n\n${"word ".repeat(100)}`,
    });
    const chunks = chunkMarkdownByHeading(page, { maxTokens: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.tokenEstimate <= 20)).toBe(true);
  });

  it("preserves oversized fenced code blocks as complete chunks", () => {
    const code = Array.from({ length: 80 }, (_, index) =>
      `const value${index} = client.request("/v1/items/${index}");`,
    ).join("\n");
    const page = normalizeMarkdown({
      repoPath: "long-code.md",
      markdown: `# Long code

Introductory prose that should not force the code block to split.

\`\`\`ts
${code}
\`\`\`

Follow-up prose after the example.
`,
    });

    const chunks = chunkMarkdownByHeading(page, { maxTokens: 30 });
    const codeChunks = chunks.filter((chunk) => chunk.text.includes("const value0"));

    expect(codeChunks).toHaveLength(1);
    expect(codeChunks[0]?.text).toContain("```ts");
    expect(codeChunks[0]?.text).toContain("const value79");
    expect(codeChunks[0]?.text).toContain("```");
    expect(codeChunks[0]?.tokenEstimate).toBeGreaterThan(30);
    expect(chunks.some((chunk) => chunk.text.includes("Follow-up prose"))).toBe(true);
  });

  it("keeps short setup prose attached to an oversized code example", () => {
    const code = Array.from({ length: 60 }, (_, index) =>
      `const item${index} = await client.items.get("${index}");`,
    ).join("\n");
    const page = normalizeMarkdown({
      repoPath: "intro-code.md",
      markdown: `# Setup

Create the client before calling the API.

\`\`\`ts
${code}
\`\`\`

After the example, handle errors separately.
`,
    });

    const chunks = chunkMarkdownByHeading(page, { maxTokens: 25 });
    const codeChunk = chunks.find((chunk) => chunk.text.includes("const item0"));

    expect(codeChunk?.text).toContain("Create the client before calling the API.");
    expect(codeChunk?.text).toContain("const item59");
    expect(codeChunk?.tokenEstimate).toBeGreaterThan(25);
    expect(chunks.find((chunk) => chunk.text.includes("handle errors separately"))?.text)
      .not.toContain("const item0");
  });

  it("does not split unterminated fenced code blocks mid-example", () => {
    const code = Array.from({ length: 40 }, (_, index) =>
      `export const route${index} = "/v1/routes/${index}";`,
    ).join("\n");
    const page = normalizeMarkdown({
      repoPath: "unterminated.md",
      markdown: `# Unterminated

\`\`\`ts
${code}
`,
    });

    const chunks = chunkMarkdownByHeading(page, { maxTokens: 20 });
    const codeChunks = chunks.filter((chunk) => chunk.text.includes("route0"));

    expect(codeChunks).toHaveLength(1);
    expect(codeChunks[0]?.text).toContain("```ts");
    expect(codeChunks[0]?.text).toContain("route39");
    expect(codeChunks[0]?.tokenEstimate).toBeGreaterThan(20);
  });

  it("does not close long fences with shorter nested fences", () => {
    const page = normalizeMarkdown({
      repoPath: "nested-fences.md",
      markdown: `# Nested fences

\`\`\`\`md
Example with a nested fence:

\`\`\`ts
const ok = true;
\`\`\`

Still inside the outer example.
\`\`\`\`
`,
    });

    const chunks = chunkMarkdownByHeading(page, { maxTokens: 20 });
    const codeChunks = chunks.filter((chunk) => chunk.text.includes("nested fence"));

    expect(codeChunks).toHaveLength(1);
    expect(codeChunks[0]?.text).toContain("const ok = true;");
    expect(codeChunks[0]?.text).toContain("Still inside the outer example.");
  });

  it("does not close fences with info-string-looking nested fence lines", () => {
    const page = normalizeMarkdown({
      repoPath: "nested-info-fence.md",
      markdown: `# Nested info fence

\`\`\`
Outer example starts here.
\`\`\`ts
const stillInside = true;
\`\`\`
`,
    });

    const chunks = chunkMarkdownByHeading(page, { maxTokens: 20 });
    const codeChunks = chunks.filter((chunk) => chunk.text.includes("Outer example"));

    expect(codeChunks).toHaveLength(1);
    expect(codeChunks[0]?.text).toContain("const stillInside = true;");
  });

  it("does not assign package entity IDs to local imports or runtime built-ins", () => {
    const page = normalizeMarkdown({
      repoPath: "imports.md",
      markdown: `# Imports

\`\`\`ts
import helper from "./helper.js";
import fs from "node:fs";
import { Client } from "@acme/sdk";
\`\`\`
`,
    });
    const [chunk] = chunkMarkdownByHeading(page);

    expect(chunk?.entityIds).toHaveLength(1);
  });

  it("uses frontmatter titles as heading paths without indexing frontmatter", () => {
    const page = normalizeMarkdown({
      repoPath: "pagination.md",
      markdown: `---
title: Pagination
---

Use the paginate method to retrieve all pages.
`,
    });

    const [chunk] = chunkMarkdownByHeading(page);

    expect(chunk?.headingPath).toEqual(["Pagination"]);
    expect(chunk?.text).not.toContain("title:");
  });
});

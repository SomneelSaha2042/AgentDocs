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

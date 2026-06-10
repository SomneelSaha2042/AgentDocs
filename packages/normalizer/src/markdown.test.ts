import { describe, expect, it } from "vitest";

import { normalizeMarkdown } from "./markdown.js";

describe("normalizeMarkdown", () => {
  it("extracts frontmatter, headings, links, and fenced code without executing it", () => {
    const markdown = `---
title: Frontmatter Title
description: Fixture description
---
# Heading Title

[Guide](./guide.md)

\`\`\`js
throw new Error("must not execute");
\`\`\`
`;

    const page = normalizeMarkdown({ markdown, repoPath: "docs/index.md" });

    expect(page.title).toBe("Frontmatter Title");
    expect(page.frontmatter).toMatchObject({ description: "Fixture description" });
    expect(page.headings[0]?.text).toBe("Heading Title");
    expect(page.links[0]).toMatchObject({
      href: "./guide.md",
      resolvedHref: "docs/guide.md",
      kind: "internal",
    });
    expect(page.codeBlocks[0]?.value).toContain("must not execute");
  });

  it("generates stable IDs and content hashes", () => {
    const input = { markdown: "# Stable\n", repoPath: "nested/stable.mdx" };
    expect(normalizeMarkdown(input)).toEqual(normalizeMarkdown(input));
  });
});

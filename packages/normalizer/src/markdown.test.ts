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

  it("accepts HTML comments and permissive raw HTML in Markdown", () => {
    const markdown = `<!-- markdownlint-disable -->
# Raw HTML

<tbody valign=top align=left>
</tbody>
`;

    const page = normalizeMarkdown({
      markdown,
      format: "markdown",
      repoPath: "README.md",
    });

    expect(page.title).toBe("Raw HTML");
  });

  it("accepts JSX components in MDX", () => {
    const markdown = `# MDX

<Callout kind="note">Use the documented path.</Callout>
`;

    const page = normalizeMarkdown({
      markdown,
      format: "mdx",
      repoPath: "docs/guide.mdx",
    });

    expect(page.title).toBe("MDX");
  });

  it("resolves site-root links against repo-rooted local paths", () => {
    const page = normalizeMarkdown({
      markdown: "[Validation](/docs/guides/validation)\n",
      repoPath: "docs/api/request.md",
    });

    expect(page.links[0]?.resolvedHref).toBe("docs/guides/validation");
  });
});

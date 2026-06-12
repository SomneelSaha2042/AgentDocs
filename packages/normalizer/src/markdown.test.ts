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

  it("extracts deterministic evidence-linked context facets", () => {
    const page = normalizeMarkdown({
      markdown: `---
framework: react
router: app
---
# React v5
`,
      repoPath: "docs/react/v5/start.md",
      context: {
        fixed: { runtime: "node" },
        rules: [{ match: "**/react/**", facets: { framework: "react" } }],
      },
    });

    expect(page.facets.map(({ key, value }) => `${key}=${value}`)).toEqual([
      "framework=react",
      "router=app",
      "runtime=node",
      "version=v5",
    ]);
    expect(page.facets.every((facet) => facet.evidence.length > 0)).toBe(true);
    expect(normalizeMarkdown({
      markdown: page.markdown,
      repoPath: "docs/react/v5/start.md",
      context: {
        fixed: { runtime: "node" },
        rules: [{ match: "**/react/**", facets: { framework: "react" } }],
      },
    }).facets).toEqual(page.facets);
  });

  it("does not treat arbitrary body versions as page context", () => {
    const page = normalizeMarkdown({
      markdown: "# Setup\n\nConnect to 127.0.0.1 and install package 2.4.1.\n",
      repoPath: "docs/setup.md",
    });

    expect(page.facets).toEqual([]);
  });

  it("falls back deterministically for malformed MDX without touching fenced code", () => {
    const markdown = `import Tabs from "@theme/Tabs"

# Client setup

Useful [guide](./guide.md) prose.

<Callout>Keep this text.</Callout>

{unfinished(

\`\`\`tsx
const literal = <Component value={expression} />
\`\`\`
`;
    const page = normalizeMarkdown({ markdown, format: "mdx", repoPath: "docs/client.mdx" });

    expect(page.normalization.mode).toBe("mdx-fallback");
    expect(page.normalization.warnings).toEqual([
      expect.stringContaining("Strict MDX parsing failed:"),
      "Omitted MDX JSX tags outside fenced code.",
      "Omitted MDX brace expressions outside fenced code.",
      "Omitted top-level MDX import/export declarations.",
    ]);
    expect(page.markdown).toContain("# Client setup");
    expect(page.markdown).toContain("[guide](./guide.md)");
    expect(page.markdown).toContain("Keep this text.");
    expect(page.codeBlocks[0]?.value).toContain("<Component value={expression} />");
    expect(page.normalization.omittedCharacterRatio).toBeGreaterThan(0);
    expect(normalizeMarkdown({ markdown, format: "mdx", repoPath: "docs/client.mdx" }))
      .toEqual(page);
  });

  it("fails malformed MDX when strict mode is requested", () => {
    expect(() => normalizeMarkdown({
      markdown: "# Broken\n\n{unfinished(\n",
      format: "mdx",
      repoPath: "docs/broken.mdx",
      mdxMode: "strict",
    })).toThrow();
  });
});

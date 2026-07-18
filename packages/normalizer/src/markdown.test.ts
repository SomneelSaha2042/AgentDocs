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

  it("ignores empty headings without creating invalid structural evidence", () => {
    const page = normalizeMarkdown({
      markdown: "# Attributes\n\n- ####\n  idstring\n\n- #### name\n  namestring\n",
      repoPath: "docs/reference.md",
    });

    expect(page.headings.map((heading) => heading.text)).toEqual(["Attributes", "name"]);
    expect(page.headings.every((heading) => heading.text.length > 0 && heading.slug.length > 0)).toBe(true);
    expect(page.normalization.warnings).toContain("Ignored 1 empty Markdown heading.");
  });

  it("keeps punctuation-only headings addressable", () => {
    const page = normalizeMarkdown({
      markdown: "# /\n\nUseful home-page content.\n",
      repoPath: "index.md",
    });

    expect(page.headings[0]).toMatchObject({ text: "/" });
    expect(page.headings[0]?.slug).toMatch(/^section-[a-f0-9]{12}$/);
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
      "content_type=docs",
      "framework=react",
      "router=app",
      "runtime=node",
      "source_format=markdown",
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

    expect(page.facets.map(({ key, value }) => `${key}=${value}`)).toEqual([
      "content_type=docs",
      "source_format=markdown",
    ]);
    expect(page.facets.some((facet) => facet.key === "version")).toBe(false);
  });

  it("infers content type, locale, and source format facets deterministically", () => {
    const localizedTutorial = normalizeMarkdown({
      markdown: "# Quickstart\n",
      repoPath: "docs/es/tutorials/quickstart.mdx",
    });
    const release = normalizeMarkdown({
      markdown: "---\ncontent_type: release\nlocale: en-US\n---\n# Release notes\n",
      repoPath: "blog/releases/v2.md",
    });

    expect(localizedTutorial.facets.map(({ key, value }) => `${key}=${value}`)).toContain("content_type=tutorial");
    expect(localizedTutorial.facets.map(({ key, value }) => `${key}=${value}`)).toContain("locale=es");
    expect(localizedTutorial.facets.map(({ key, value }) => `${key}=${value}`)).toContain("source_format=mdx");
    expect(release.facets.map(({ key, value }) => `${key}=${value}`)).toContain("content_type=release");
    expect(release.facets.map(({ key, value }) => `${key}=${value}`)).toContain("locale=en-us");
  });

  it("does not infer locale from common programming language path segments", () => {
    const pages = ["docs/go/install.md", "docs/js/client.md", "docs/ts/types.md", "docs/py/sdk.md"]
      .map((repoPath) => normalizeMarkdown({
        markdown: "# SDK guide\n",
        repoPath,
      }));

    expect(pages.flatMap((page) => page.facets.filter((facet) => facet.key === "locale"))).toEqual([]);
    expect(normalizeMarkdown({
      markdown: "# Guide\n",
      repoPath: "docs/en-us/guide.md",
    }).facets.map(({ key, value }) => `${key}=${value}`)).toContain("locale=en-us");
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

  it("keeps readable multiline MDX component text during fallback", () => {
    const markdown = `# Tabs

<Steps
  items={[
    "Install",
    "Configure",
  ]}
>
Install the package, then configure the client.
</Steps>

{unfinished(

\`\`\`tsx
const literal = <Widget options={{ mode: "strict" }} />
\`\`\`
`;

    const page = normalizeMarkdown({ markdown, format: "mdx", repoPath: "docs/tabs.mdx" });

    expect(page.normalization.mode).toBe("mdx-fallback");
    expect(page.markdown).toContain("Install the package, then configure the client.");
    expect(page.markdown).toContain("AgentDocs omitted MDX JSX");
    expect(page.markdown).toContain("AgentDocs omitted MDX expression");
    expect(page.codeBlocks[0]?.value).toContain("<Widget options={{ mode: \"strict\" }} />");
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

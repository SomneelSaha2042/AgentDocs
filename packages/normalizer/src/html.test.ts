import { describe, expect, it } from "vitest";

import { normalizeHtml } from "./html.js";

describe("normalizeHtml", () => {
  it("converts page content to a website DocPage", () => {
    const page = normalizeHtml({
      canonicalUrl: "https://docs.example.com/guide",
      sourceUrl: "https://docs.example.com/guide",
      html: `<html><head><title>Guide</title><meta name="description" content="A guide"></head>
        <body><nav>Noise</nav><main><h1>Guide</h1><a href="/next">Next</a><pre><code class="language-js">const ok = true;</code></pre></main></body></html>`,
    });

    expect(page.sourceType).toBe("website");
    expect(page.title).toBe("Guide");
    expect(page.description).toBe("A guide");
    expect(page.facets.map(({ key, value }) => `${key}=${value}`)).toContain("source_format=html");
    expect(page.links[0]).toMatchObject({
      kind: "internal",
      resolvedHref: "https://docs.example.com/next",
    });
    expect(page.codeBlocks[0]?.value).toContain("const ok = true;");
  });

  it("prefers modern documentation content roots and removes page chrome", () => {
    const page = normalizeHtml({
      canonicalUrl: "https://docs.example.com/guide",
      sourceUrl: "https://docs.example.com/guide",
      html: `<body><nav>Global navigation</nav><main><article role="main">
        <h1>Guide</h1><p>Useful content.</p><div class="feedback-panel">Was this helpful?</div>
      </article></main><footer>Footer noise</footer></body>`,
    });

    expect(page.markdown).toContain("Useful content.");
    expect(page.markdown).not.toContain("Global navigation");
    expect(page.markdown).not.toContain("Was this helpful?");
  });
});

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
    expect(page.links[0]).toMatchObject({
      kind: "internal",
      resolvedHref: "https://docs.example.com/next",
    });
    expect(page.codeBlocks[0]?.value).toContain("const ok = true;");
  });
});

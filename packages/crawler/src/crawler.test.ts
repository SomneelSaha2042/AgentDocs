import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { crawlWebsite } from "./crawler.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
});

describe("crawlWebsite", () => {
  it("uses sitemap discovery with filters and canonical duplicate handling", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return xml(`<urlset>
          <url><loc>${origin}/docs/a</loc></url>
          <url><loc>${origin}/docs/alias</loc></url>
          <url><loc>${origin}/blog/post</loc></url>
        </urlset>`);
      }
      if (path === "/docs/alias") {
        return html(`<head><link rel="canonical" href="${origin}/docs/a"></head><main><h1>Alias</h1></main>`);
      }
      return html(`<main><h1>${path}</h1></main>`);
    });

    const result = await crawlWebsite({
      include: ["/docs/**"],
      startUrl: `${origin}/docs/a`,
    });

    expect(result.discovery).toBe("sitemap");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.page.canonicalUrl).toBe(`${origin}/docs/a`);
  });

  it("applies max page limits", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return xml(`<urlset>
          <url><loc>${origin}/docs/a</loc></url>
          <url><loc>${origin}/docs/b</loc></url>
        </urlset>`);
      }
      return html(`<main><h1>${path}</h1></main>`);
    });

    const result = await crawlWebsite({ maxPages: 1, startUrl: origin });
    expect(result.pages).toHaveLength(1);
  });

  it("falls back to same-origin links and avoids assets and excluded pages", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return { body: "missing", contentType: "text/plain", status: 404 };
      }
      if (path === "/") {
        return html(`<main><h1>Home</h1>
          <a href="/docs/guide">Guide</a>
          <a href="/private/secret">Secret</a>
          <a href="/image.png">Image</a>
          <a href="https://example.com/external">External</a>
        </main>`);
      }
      return html(`<main><h1>${path}</h1><a href="/">Home</a></main>`);
    });

    const result = await crawlWebsite({
      exclude: ["/private/**"],
      startUrl: `${origin}/`,
    });

    expect(result.discovery).toBe("links");
    expect(result.pages.map(({ page }) => page.canonicalUrl)).toEqual([
      `${origin}/`,
      `${origin}/docs/guide`,
    ]);
  });

  it("uses an excluded start page as a fallback discovery seed", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return { body: "missing", contentType: "text/plain", status: 404 };
      }
      if (path === "/") {
        return html(`<main><h1>Home</h1><a href="/docs/guide">Guide</a></main>`);
      }
      return html(`<main><h1>${path}</h1></main>`);
    });

    const result = await crawlWebsite({
      include: ["/docs/**"],
      startUrl: origin,
    });
    expect(result.pages.map(({ page }) => page.canonicalUrl)).toEqual([
      `${origin}/docs/guide`,
    ]);
  });

  it("does not fetch robots-disallowed fallback pages", async () => {
    let fetchedPrivate = false;
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") {
        return { body: "missing", contentType: "text/plain", status: 404 };
      }
      if (path === "/robots.txt") {
        return { body: "User-agent: *\nDisallow: /private", contentType: "text/plain" };
      }
      if (path === "/private") {
        fetchedPrivate = true;
      }
      return html("<main><h1>Private</h1></main>");
    });

    await expect(crawlWebsite({
      respectRobots: true,
      startUrl: `${origin}/private`,
    })).rejects.toThrowError(/No crawlable HTML pages/);
    expect(fetchedPrivate).toBe(true);
  });

  it("reports invalid start URLs as crawl failures", async () => {
    await expect(crawlWebsite({ startUrl: "not a url" }))
      .rejects.toThrowError(/Invalid start URL/);
  });

  it("discovers pages from same-origin sitemap indexes", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return xml(`<sitemapindex><sitemap><loc>${origin}/docs-sitemap.xml</loc></sitemap></sitemapindex>`);
      }
      if (path === "/docs-sitemap.xml") {
        return xml(`<urlset><url><loc>${origin}/docs/guide</loc></url></urlset>`);
      }
      return html(`<main><h1>${path}</h1></main>`);
    });

    const result = await crawlWebsite({ startUrl: origin });

    expect(result.discovery).toBe("sitemap");
    expect(result.pages.map(({ page }) => page.canonicalUrl)).toEqual([
      `${origin}/`,
      `${origin}/docs/guide`,
    ]);
  });

  it("uses canonical page content when an alias is discovered first", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return xml(`<urlset>
          <url><loc>${origin}/docs/0-alias</loc></url>
          <url><loc>${origin}/docs/z-real</loc></url>
        </urlset>`);
      }
      if (path === "/docs/0-alias") {
        return html(`<head><link rel="canonical" href="${origin}/docs/z-real"></head><main><h1>Alias</h1></main>`);
      }
      return html("<main><h1>Real</h1></main>");
    });

    const result = await crawlWebsite({ include: ["/docs/**"], startUrl: origin });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.page).toMatchObject({
      canonicalUrl: `${origin}/docs/z-real`,
      title: "Real",
    });
  });

  it("infers a versioned guide scope and discovers a robots sitemap", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/robots.txt") {
        return text(`User-agent: *\nSitemap: ${origin}/sitemap-index.xml\n`);
      }
      if (path === "/sitemap.xml") return { body: "missing", contentType: "text/plain", status: 404 };
      if (path === "/sitemap-index.xml") {
        return xml(`<sitemapindex><sitemap><loc>${origin}/stable.xml</loc></sitemap></sitemapindex>`);
      }
      if (path === "/stable.xml") {
        return xml(`<urlset>
          <url><loc>${origin}/docs/stable/auth.html</loc></url>
          <url><loc>${origin}/docs/stable/install.html</loc></url>
          <url><loc>${origin}/docs/old/legacy.html</loc></url>
        </urlset>`);
      }
      if (path === "/docs/stable/index.html") {
        return html(`<main><h1>Stable</h1>
          <a href="/docs/stable/auth.html">Auth</a>
          <a href="/docs/stable/install.html">Install</a>
          <a href="/docs/stable/api.html">API</a>
          <a href="/docs/old/legacy.html">Legacy</a>
        </main>`);
      }
      return html(`<main><h1>${path}</h1></main>`);
    });

    const result = await crawlWebsite({ startUrl: `${origin}/docs/stable/index.html` });

    expect(result.scope.pathPrefix).toBe("/docs/stable/");
    expect(result.discovery).toBe("hybrid");
    expect(result.sitemapUrls).toContain(`${origin}/sitemap-index.xml`);
    expect(result.pages.map(({ page }) => page.canonicalUrl))
      .not.toContain(`${origin}/docs/old/legacy.html`);
  });

  it("infers scope from the final redirected start URL", async () => {
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") return { body: "missing", contentType: "text/plain", status: 404 };
      if (path === "/stable") {
        return { body: "", contentType: "text/plain", status: 302, headers: { location: "/docs/2.12/index.html" } };
      }
      return html(`<main><h1>Stable</h1>
        <a href="/docs/2.12/auth.html">Auth</a>
        <a href="/docs/2.12/install.html">Install</a>
        <a href="/docs/2.12/api.html">API</a>
      </main>`);
    });

    const result = await crawlWebsite({ maxPages: 1, startUrl: `${origin}/stable` });
    expect(result.scope.pathPrefix).toBe("/docs/2.12/");
    expect(result.pages[0]?.page.sourceUrl).toBe(`${origin}/docs/2.12/index.html`);
  });

  it("prefers a same-origin Markdown alternate", async () => {
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") return { body: "missing", contentType: "text/plain", status: 404 };
      if (path === "/guide.md") return text("# Markdown Guide\n\nOfficial Markdown content.\n");
      return html(`<main><h1>HTML Guide</h1><a href="/guide.md">View a markdown version</a></main>`);
    });

    const result = await crawlWebsite({ startUrl: `${origin}/guide` });

    expect(result.pages[0]).toMatchObject({
      normalizedFrom: "markdown",
      markdownAlternateUrl: `${origin}/guide.md`,
    });
    expect(result.pages[0]?.page.markdown).toContain("Official Markdown content.");
  });

  it("prioritizes goal-relevant links and continues after page failures", async () => {
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") return { body: "missing", contentType: "text/plain", status: 404 };
      if (path === "/docs") {
        return html(`<main><h1>Docs</h1>
          <a href="/docs/install">Installation</a>
          <a href="/docs/auth">Authentication</a>
          <a href="/docs/broken">Broken</a>
        </main>`);
      }
      if (path === "/docs/broken") return { body: "broken", contentType: "text/html", status: 500 };
      return html(`<main><h1>${path}</h1></main>`);
    });

    const ranked = await crawlWebsite({
      goal: "authentication",
      maxPages: 2,
      startUrl: `${origin}/docs`,
    });
    expect(ranked.pages.map(({ page }) => page.canonicalUrl)).toContain(`${origin}/docs/auth`);

    const resilient = await crawlWebsite({ startUrl: `${origin}/docs` });
    expect(resilient.failures).toContainEqual({
      url: `${origin}/docs/broken`,
      reason: "http_error",
      message: "HTTP 500",
    });
    expect(resilient.pages.flatMap(({ page }) => page.links)
      .find((link) => link.resolvedHref === `${origin}/docs/broken`)?.isBroken).toBe(true);
    expect(resilient.pages.length).toBeGreaterThan(1);
  });

  it("stops at the deterministic page-request budget", async () => {
    let pageRequests = 0;
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") return { body: "missing", contentType: "text/plain", status: 404 };
      if (path.startsWith("/docs")) pageRequests += 1;
      return html(`<main><h1>${path}</h1>
        <a href="/docs/a">A</a><a href="/docs/b">B</a><a href="/docs/c">C</a>
      </main>`);
    });

    const result = await crawlWebsite({ maxRequests: 2, startUrl: `${origin}/docs` });
    expect(result.counts.attempted).toBe(2);
    expect(pageRequests).toBe(2);
  });

  it("derives a bounded attempt budget from an explicit page limit", async () => {
    let pageRequests = 0;
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return { body: "missing", contentType: "text/plain", status: 404 };
      }
      if (path.startsWith("/docs")) pageRequests += 1;
      const links = Array.from(
        { length: 20 },
        (_value, index) => `<a href="${origin}/docs/${index}">Page ${index}</a>`,
      ).join("");
      return rawHtml(`<main><h1>Only a title</h1>${links}</main>`);
    });

    const result = await crawlWebsite({ maxPages: 2, startUrl: `${origin}/docs/start` });

    expect(result.counts.attempted).toBe(6);
    expect(pageRequests).toBe(6);
    expect(result.pages).toEqual([]);
  });

  it("uses markdown_url metadata and rejects heading-only extraction", async () => {
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") return { body: "missing", contentType: "text/plain", status: 404 };
      if (path === "/guide.md") return text("# Guide\n\nSubstantive official Markdown documentation.\n");
      if (path === "/empty") return rawHtml("<main><h1>Only a title</h1></main>");
      return rawHtml(`<head><meta name="markdown_url" content="/guide.md"></head><main><h1>Guide</h1></main>`);
    });

    const markdown = await crawlWebsite({ startUrl: `${origin}/guide` });
    expect(markdown.pages[0]).toMatchObject({
      normalizedFrom: "markdown",
      markdownAlternateUrl: `${origin}/guide.md`,
    });

    const empty = await crawlWebsite({ startUrl: `${origin}/empty` });
    expect(empty.pages).toEqual([]);
    expect(empty.unusablePages[0]).toMatchObject({ reason: "empty_content" });
  });

  it("adopts the final start origin and deduplicates identical content", async () => {
    const finalOrigin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        return xml(`<urlset><url><loc>${origin}/docs/a</loc></url><url><loc>${origin}/docs/b</loc></url></urlset>`);
      }
      return html("<main><h1>Same guide</h1><p>Identical documentation body for both aliases.</p></main>");
    });
    const redirectOrigin = await startFixtureServer(() => ({
      body: "",
      contentType: "text/plain",
      status: 302,
      headers: { location: `${finalOrigin}/docs/a` },
    }));

    const result = await crawlWebsite({ startUrl: `${redirectOrigin}/start` });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.page.sourceUrl).toBe(`${finalOrigin}/docs/a`);
    expect(result.counts.duplicateContent).toBe(1);
  });

  it("prioritizes relevant sitemap indexes within the discovery budget", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        const children = [
          `${origin}/sdk-javascript-en-us.xml`,
          ...Array.from({ length: 60 }, (_value, index) => `${origin}/unrelated-${String(index).padStart(2, "0")}.xml`),
        ];
        return xml(`<sitemapindex>${children.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join("")}</sitemapindex>`);
      }
      if (path === "/sdk-javascript-en-us.xml") {
        return xml(`<urlset><url><loc>${origin}/sdk/javascript/guide</loc></url></urlset>`);
      }
      if (path.endsWith(".xml")) return xml("<urlset></urlset>");
      return html(`<main><h1>${path}</h1></main>`);
    });

    const result = await crawlWebsite({
      goal: "javascript SDK",
      startUrl: `${origin}/sdk/javascript/start`,
    });

    expect(result.sitemapUrls).toContain(`${origin}/sdk-javascript-en-us.xml`);
    expect(result.warnings[0]).toMatch(/sitemap_discovery_budget_exhausted/);
    expect(result.counts.discoveryRequests).toBe(50);
  });

  it("bounds sitemap discovery relative to the page-request budget", async () => {
    const origin = await startFixtureServer((path, origin) => {
      if (path === "/sitemap.xml") {
        const children = Array.from(
          { length: 10 },
          (_value, index) => `${origin}/child-${index}.xml`,
        );
        return xml(`<sitemapindex>${children.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join("")}</sitemapindex>`);
      }
      if (path.endsWith(".xml")) return xml("<urlset></urlset>");
      return html("<main><h1>Guide</h1></main>");
    });

    const result = await crawlWebsite({ maxRequests: 12, startUrl: `${origin}/docs/guide` });

    expect(result.counts.discoveryRequests).toBe(3);
    expect(result.warnings[0]).toMatch(/sitemap_discovery_budget_exhausted/);
  });

  it("does not infer an origin-wide scope from scattered content links", async () => {
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") {
        return { body: "missing", contentType: "text/plain", status: 404 };
      }
      if (path === "/guides/build/start") {
        return html(`<main><h1>Build guide</h1>
          <a href="/reference/a">Reference A</a>
          <a href="/examples/b">Example B</a>
          <a href="/concepts/c">Concept C</a>
        </main>`);
      }
      return html(`<main><h1>${path}</h1></main>`);
    });

    const result = await crawlWebsite({ startUrl: `${origin}/guides/build/start` });

    expect(result.scope.pathPrefix).toBe("/guides/build/");
    expect(result.pages.map(({ page }) => page.canonicalUrl)).toEqual([
      `${origin}/guides/build/start`,
    ]);
  });

  it("normalizes locale query variants before crawling", async () => {
    const requestedPaths: string[] = [];
    const origin = await startFixtureServer((path, origin) => {
      requestedPaths.push(path);
      if (path === "/sitemap.xml") {
        return xml(`<urlset>
          <url><loc>${origin}/docs/guide?hl=es</loc></url>
          <url><loc>${origin}/docs/guide?locale=en-GB</loc></url>
        </urlset>`);
      }
      return html("<main><h1>Guide</h1></main>");
    });

    const result = await crawlWebsite({ startUrl: `${origin}/docs/guide` });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.page.canonicalUrl).toBe(`${origin}/docs/guide`);
    expect(requestedPaths.filter((path) => path === "/docs/guide")).toHaveLength(1);
  });

  it("respects wildcard robots groups with consecutive user agents", async () => {
    let fetchedPrivate = false;
    const origin = await startFixtureServer((path) => {
      if (path === "/sitemap.xml") {
        return { body: "missing", contentType: "text/plain", status: 404 };
      }
      if (path === "/robots.txt") {
        return {
          body: "User-agent: *\nUser-agent: OtherBot\nDisallow: /private",
          contentType: "text/plain",
        };
      }
      if (path === "/private") {
        fetchedPrivate = true;
      }
      return html("<main><h1>Private</h1></main>");
    });

    await expect(crawlWebsite({
      respectRobots: true,
      startUrl: `${origin}/private`,
    })).rejects.toThrowError(/No crawlable HTML pages/);
    expect(fetchedPrivate).toBe(true);
  });
});

type FixtureResponse = {
  body: string;
  contentType: string;
  headers?: Record<string, string>;
  status?: number;
};

async function startFixtureServer(
  route: (path: string, origin: string) => FixtureResponse,
): Promise<string> {
  const server = createServer((request, response) => {
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;
    const result = route(new URL(request.url ?? "/", origin).pathname, origin);
    response.writeHead(result.status ?? 200, {
      "content-type": result.contentType,
      ...result.headers,
    });
    response.end(result.body);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

function html(body: string): FixtureResponse {
  const useful = "<p>Useful fixture documentation content for crawler validation.</p>";
  return {
    body: body.includes("</main>") ? body.replace("</main>", `${useful}</main>`) : `${body}${useful}`,
    contentType: "text/html; charset=utf-8",
  };
}

function rawHtml(body: string): FixtureResponse {
  return { body, contentType: "text/html; charset=utf-8" };
}

function xml(body: string): FixtureResponse {
  return { body, contentType: "application/xml" };
}

function text(body: string): FixtureResponse {
  return { body, contentType: "text/plain; charset=utf-8" };
}

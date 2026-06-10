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
      return html("<main><h1>Guide</h1></main>");
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
    expect(fetchedPrivate).toBe(false);
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
      return html("<main><h1>Guide</h1></main>");
    });

    const result = await crawlWebsite({ startUrl: origin });

    expect(result.discovery).toBe("sitemap");
    expect(result.pages.map(({ page }) => page.canonicalUrl)).toEqual([
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

    const result = await crawlWebsite({ startUrl: origin });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.page).toMatchObject({
      canonicalUrl: `${origin}/docs/z-real`,
      title: "Real",
    });
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
    expect(fetchedPrivate).toBe(false);
  });
});

type FixtureResponse = {
  body: string;
  contentType: string;
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
    response.writeHead(result.status ?? 200, { "content-type": result.contentType });
    response.end(result.body);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

function html(body: string): FixtureResponse {
  return { body, contentType: "text/html; charset=utf-8" };
}

function xml(body: string): FixtureResponse {
  return { body, contentType: "application/xml" };
}

import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

import { CrawlManifestSchema, DocPageSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { crawlToDisk } from "./crawl.js";

describe("crawlToDisk", () => {
  it("writes raw HTML, markdown, page JSON, and a valid manifest", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/sitemap.xml") {
        response.writeHead(200, { "content-type": "application/xml" });
        response.end(`<urlset><url><loc>${origin}/docs</loc></url></urlset>`);
        return;
      }
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<main><h1>Docs</h1><p>Fixture page.</p></main>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-crawl-"));

    try {
      const result = await crawlToDisk({
        cwd: output,
        out: ".agentdocs",
        startUrl: `${origin}/docs`,
      });
      const manifest = CrawlManifestSchema.parse(
        JSON.parse(await readFile(result.manifestPath, "utf8")),
      );
      expect(manifest.scope?.pathPrefix).toBe("/");
      expect(manifest.counts).toMatchObject({ collected: 1, failed: 0 });
      expect(manifest.pages[0]?.normalizedFrom).toBe("html");
      const files = await readdir(path.join(output, ".agentdocs", "sources", "pages"));
      expect(files.some((file) => file.endsWith(".raw.html"))).toBe(true);
      expect(files.some((file) => file.endsWith(".md"))).toBe(true);
      const pagePath = path.join(output, ".agentdocs", ...manifest.pages[0]!.pagePath.split("/"));
      expect(DocPageSchema.parse(JSON.parse(await readFile(pagePath, "utf8"))).title).toBe("Docs");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("removes stale crawl files when page content changes", async () => {
    let title = "First";
    const server = createServer((request, response) => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      const origin = `http://127.0.0.1:${port}`;
      if (request.url === "/sitemap.xml") {
        response.writeHead(200, { "content-type": "application/xml" });
        response.end(`<urlset><url><loc>${origin}/docs</loc></url></urlset>`);
        return;
      }
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<main><h1>${title}</h1><p>Useful changed documentation content.</p></main>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-crawl-state-"));

    try {
      const first = await crawlToDisk({
        cwd: output,
        out: ".agentdocs",
        startUrl: `${origin}/docs`,
      });
      const firstManifest = CrawlManifestSchema.parse(
        JSON.parse(await readFile(first.manifestPath, "utf8")),
      );
      title = "Second";
      const second = await crawlToDisk({
        cwd: output,
        out: ".agentdocs",
        startUrl: `${origin}/docs`,
      });
      const secondManifest = CrawlManifestSchema.parse(
        JSON.parse(await readFile(second.manifestPath, "utf8")),
      );
      const files = await readdir(path.join(output, ".agentdocs", "sources", "pages"));

      expect(secondManifest.pages[0]?.id).not.toBe(firstManifest.pages[0]?.id);
      expect(files).not.toContain(`${firstManifest.pages[0]!.id}.json`);
      expect(files).toContain(`${secondManifest.pages[0]!.id}.json`);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("preserves diagnostics and fails when extraction yields no useful pages", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<main><h1>Only a title</h1></main>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-crawl-empty-"));
    const manifestPath = path.join(output, ".agentdocs", "sources", "crawl-manifest.json");

    try {
      await expect(crawlToDisk({
        cwd: output,
        out: ".agentdocs",
        startUrl: `http://127.0.0.1:${port}/docs`,
      })).rejects.toThrowError(/no useful content/i);
      const manifest = CrawlManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
      expect(manifest.pages).toEqual([]);
      expect(manifest.unusablePages?.[0]).toMatchObject({ reason: "empty_content" });
      await expect(readFile(
        path.join(output, ".agentdocs", ...manifest.unusablePages![0]!.rawHtmlPath.split("/")),
        "utf8",
      )).resolves.toContain("Only a title");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

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
});

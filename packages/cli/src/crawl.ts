import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  crawlWebsite,
  type CrawlOptions as WebsiteCrawlOptions,
} from "@agentdocs/crawler";
import {
  CrawlManifestSchema,
  DocPageSchema,
  type CrawlManifest,
} from "@agentdocs/shared";

export type CrawlOptions = WebsiteCrawlOptions & {
  cwd: string;
  out: string;
};

export type CrawlOutput = {
  manifestPath: string;
  pageCount: number;
};

export async function crawlToDisk(options: CrawlOptions): Promise<CrawlOutput> {
  const outputRoot = path.resolve(options.cwd, options.out);
  const pagesDirectory = path.join(outputRoot, "sources", "pages");
  const manifestPath = path.join(outputRoot, "sources", "crawl-manifest.json");
  const result = await crawlWebsite(options);
  const pages = result.pages.map(({ page, rawHtml }) => ({
    page: DocPageSchema.parse(page),
    rawHtml,
  }));
  const manifestPages: CrawlManifest["pages"] = pages.map(({ page }) => ({
    id: page.id,
    sourceUrl: page.sourceUrl!,
    canonicalUrl: page.canonicalUrl!,
    rawHtmlPath: path.posix.join("sources", "pages", `${page.id}.raw.html`),
    markdownPath: path.posix.join("sources", "pages", `${page.id}.md`),
    pagePath: path.posix.join("sources", "pages", `${page.id}.json`),
    contentHash: page.contentHash,
  }));
  const manifest = CrawlManifestSchema.parse({
    schemaVersion: 1,
    sourceType: "website",
    sourceUrl: options.startUrl,
    discovery: result.discovery,
    pageCount: pages.length,
    pages: manifestPages,
  });

  await mkdir(pagesDirectory, { recursive: true });
  for (const [index, entry] of pages.entries()) {
    const paths = manifestPages[index]!;
    await Promise.all([
      writeText(outputRoot, paths.rawHtmlPath, entry.rawHtml),
      writeText(outputRoot, paths.markdownPath, entry.page.markdown),
      writeJson(outputRoot, paths.pagePath, entry.page),
    ]);
  }
  await writeJson(outputRoot, path.relative(outputRoot, manifestPath), manifest);

  return { manifestPath, pageCount: pages.length };
}

async function writeJson(
  outputRoot: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  await writeText(outputRoot, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(
  outputRoot: string,
  relativePath: string,
  value: string,
): Promise<void> {
  const destination = path.resolve(outputRoot, ...relativePath.split("/"));
  if (
    destination !== outputRoot &&
    !destination.startsWith(`${outputRoot}${path.sep}`)
  ) {
    throw new Error(`Refusing to write outside output directory: ${destination}`);
  }
  await writeFile(destination, value, "utf8");
}

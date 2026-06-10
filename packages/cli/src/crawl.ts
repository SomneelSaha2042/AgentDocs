import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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
    sourceUrl: normalizeSourceUrl(options.startUrl),
    discovery: result.discovery,
    pageCount: pages.length,
    pages: manifestPages,
  });
  const stateManifestPath = path.join(
    outputRoot,
    "sources",
    "state",
    `crawl-${hash(manifest.sourceUrl)}.json`,
  );

  await mkdir(pagesDirectory, { recursive: true });
  await mkdir(path.dirname(stateManifestPath), { recursive: true });
  await removeStaleCrawlPages(stateManifestPath, outputRoot, new Set(manifestPages.flatMap((page) => [
    page.rawHtmlPath,
    page.markdownPath,
    page.pagePath,
  ])));
  for (const [index, entry] of pages.entries()) {
    const paths = manifestPages[index]!;
    await Promise.all([
      writeText(outputRoot, paths.rawHtmlPath, entry.rawHtml),
      writeText(outputRoot, paths.markdownPath, entry.page.markdown),
      writeJson(outputRoot, paths.pagePath, entry.page),
    ]);
  }
  await writeJson(outputRoot, path.relative(outputRoot, manifestPath), manifest);
  await writeJson(outputRoot, path.relative(outputRoot, stateManifestPath), manifest);

  return { manifestPath, pageCount: pages.length };
}

async function removeStaleCrawlPages(
  manifestPath: string,
  outputRoot: string,
  currentPaths: Set<string>,
): Promise<void> {
  let previous: CrawlManifest;
  try {
    previous = CrawlManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8")),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid previous crawl manifest at ${manifestPath}: ${message}`);
  }
  const stalePaths = previous.pages.flatMap((page) => [
    page.rawHtmlPath,
    page.markdownPath,
    page.pagePath,
  ]).filter((file) => !currentPaths.has(file));
  for (const stalePath of stalePaths) {
    const destination = resolveOutputPath(outputRoot, stalePath);
    try {
      await unlink(destination);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
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
  const destination = resolveOutputPath(outputRoot, relativePath);
  await writeFile(destination, value, "utf8");
}

function resolveOutputPath(outputRoot: string, relativePath: string): string {
  const destination = path.resolve(outputRoot, ...relativePath.split("/"));
  if (
    destination !== outputRoot &&
    !destination.startsWith(`${outputRoot}${path.sep}`)
  ) {
    throw new Error(`Refusing to write outside output directory: ${destination}`);
  }
  return destination;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function normalizeSourceUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.href;
}

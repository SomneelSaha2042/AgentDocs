import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CrawlError,
  crawlWebsite,
  type CrawlOptions as WebsiteCrawlOptions,
} from "@agentdocs/crawler";
import {
  CrawlManifestSchema,
  DocPageSchema,
  type CrawlManifest,
} from "@agentdocs/shared";
import { applyContextFacets } from "@agentdocs/normalizer";

export type CrawlOptions = WebsiteCrawlOptions & {
  cwd: string;
  out: string;
  facets?: Record<string, string>;
  contextRules?: Array<{ match: string; facets: Record<string, string> }>;
};

export type CrawlOutput = {
  counts: {
    attempted: number;
    collected: number;
    discoveryRequests: number;
    duplicateContent: number;
    failed: number;
    skipped: number;
    unusable: number;
    usable: number;
  };
  discovery: "sitemap" | "links" | "hybrid";
  failures: NonNullable<CrawlManifest["failures"]>;
  manifestPath: string;
  pageCount: number;
  scope: NonNullable<CrawlManifest["scope"]>;
  sitemapUrls: string[];
  warnings: string[];
  diagnostics: CrawlManifest["diagnostics"];
};

export async function crawlToDisk(options: CrawlOptions): Promise<CrawlOutput> {
  const outputRoot = path.resolve(options.cwd, options.out);
  const pagesDirectory = path.join(outputRoot, "sources", "pages");
  const manifestPath = path.join(outputRoot, "sources", "crawl-manifest.json");
  const result = await crawlWebsite(options);
  const pages = result.pages.map(({ page, rawHtml, normalizedFrom, markdownAlternateUrl }) => ({
    markdownAlternateUrl,
    normalizedFrom,
    page: applyContextFacets(DocPageSchema.parse(page), {
      fixed: options.facets,
      rules: options.contextRules,
    }),
    rawHtml,
  }));
  const manifestPages: CrawlManifest["pages"] = pages.map((entry) => ({
    id: entry.page.id,
    sourceUrl: entry.page.sourceUrl!,
    canonicalUrl: entry.page.canonicalUrl!,
    rawHtmlPath: path.posix.join("sources", "pages", `${entry.page.id}.raw.html`),
    markdownPath: path.posix.join("sources", "pages", `${entry.page.id}.md`),
    pagePath: path.posix.join("sources", "pages", `${entry.page.id}.json`),
    contentHash: entry.page.contentHash,
    normalizedFrom: entry.normalizedFrom,
    markdownAlternateUrl: entry.markdownAlternateUrl,
  }));
  const unusablePages: NonNullable<CrawlManifest["unusablePages"]> = result.unusablePages.map((entry) => ({
    sourceUrl: entry.sourceUrl,
    canonicalUrl: entry.canonicalUrl,
    rawHtmlPath: path.posix.join("sources", "pages", `unusable_${hash(entry.sourceUrl)}.raw.html`),
    reason: entry.reason,
    message: entry.message,
  }));
  const manifest = CrawlManifestSchema.parse({
    schemaVersion: 1,
    sourceType: "website",
    sourceUrl: normalizeSourceUrl(options.startUrl),
    discovery: result.discovery,
    pageCount: pages.length,
    scope: result.scope,
    sitemapUrls: result.sitemapUrls,
    counts: result.counts,
    failures: result.failures,
    pages: manifestPages,
    unusablePages,
    warnings: result.warnings,
    diagnostics: result.diagnostics,
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
  ]).concat(unusablePages.map((page) => page.rawHtmlPath))));
  for (const [index, entry] of pages.entries()) {
    const paths = manifestPages[index]!;
    await Promise.all([
      writeText(outputRoot, paths.rawHtmlPath, entry.rawHtml),
      writeText(outputRoot, paths.markdownPath, entry.page.markdown),
      writeJson(outputRoot, paths.pagePath, entry.page),
    ]);
  }
  for (const [index, entry] of result.unusablePages.entries()) {
    await writeText(outputRoot, unusablePages[index]!.rawHtmlPath, entry.rawHtml);
  }
  await writeJson(outputRoot, path.relative(outputRoot, manifestPath), manifest);
  await writeJson(outputRoot, path.relative(outputRoot, stateManifestPath), manifest);

  if (pages.length === 0) {
    throw new CrawlError(
      `Crawl fetched documentation pages but extracted no useful content. Diagnostics were written to ${manifestPath}.`,
    );
  }

  return {
    counts: result.counts,
    discovery: result.discovery,
    failures: result.failures,
    manifestPath,
    pageCount: pages.length,
    scope: result.scope,
    sitemapUrls: result.sitemapUrls,
    warnings: result.warnings,
    diagnostics: result.diagnostics,
  };
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
  ]).concat((previous.unusablePages ?? []).map((page) => page.rawHtmlPath))
    .filter((file) => !currentPaths.has(file));
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

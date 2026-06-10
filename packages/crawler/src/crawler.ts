import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { minimatch } from "minimatch";

import { normalizeHtml } from "@agentdocs/normalizer";
import { DocPageSchema, type DocPage } from "@agentdocs/shared";

export type CrawlOptions = {
  exclude?: string[];
  include?: string[];
  maxPages?: number;
  respectRobots?: boolean;
  sitemap?: string;
  startUrl: string;
  timeoutMs?: number;
  userAgent?: string;
};

export type CrawledPage = {
  page: DocPage;
  rawHtml: string;
};

export type CrawlResult = {
  discovery: "sitemap" | "links";
  pages: CrawledPage[];
};

export class CrawlError extends Error {
  override readonly name = "CrawlError";
}

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "AgentDocs/0.0";
const BLOCKED_EXTENSIONS = new Set([
  ".avif",
  ".css",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".pdf",
  ".png",
  ".svg",
  ".webp",
  ".xml",
  ".zip",
]);

export async function crawlWebsite(options: CrawlOptions): Promise<CrawlResult> {
  const startUrl = normalizeUrl(options.startUrl);
  const origin = new URL(startUrl).origin;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new CrawlError("maxPages must be a positive integer.");
  }

  const requestOptions = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
  };
  const blockedByRobots = options.respectRobots
    ? await readRobots(origin, requestOptions)
    : [];
  const sitemapUrls = await discoverSitemapUrls(
    options.sitemap ?? `${origin}/sitemap.xml`,
    origin,
    requestOptions,
  );
  const discovery = sitemapUrls.length > 0 ? "sitemap" : "links";
  const queue = discovery === "sitemap"
    ? sitemapUrls
        .map(normalizeUrl)
        .filter((url) =>
          shouldCrawl(url, origin, options.include, options.exclude, blockedByRobots),
        )
    : [startUrl];
  const queued = new Set(queue);
  const fetched = new Set<string>();
  const canonicalUrls = new Set<string>();
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const candidate = queue.shift()!;
    if (fetched.has(candidate)) {
      continue;
    }
    fetched.add(candidate);

    const response = await fetchHtml(candidate, origin, requestOptions);
    if (response === undefined) {
      continue;
    }
    const canonicalUrl = readCanonicalUrl(response.html, response.url, origin);
    if (canonicalUrls.has(canonicalUrl)) {
      continue;
    }
    canonicalUrls.add(canonicalUrl);

    if (
      shouldCrawl(
        canonicalUrl,
        origin,
        options.include,
        options.exclude,
        blockedByRobots,
      )
    ) {
      const page = DocPageSchema.parse(
        normalizeHtml({
          canonicalUrl,
          html: response.html,
          sourceUrl: response.url,
        }),
      );
      pages.push({ page, rawHtml: response.html });
    }

    if (discovery === "links") {
      for (const link of readPageLinks(response.html, response.url)) {
        if (
          !queued.has(link) &&
          !fetched.has(link) &&
          shouldCrawl(
            link,
            origin,
            options.include,
            options.exclude,
            blockedByRobots,
          )
        ) {
          queued.add(link);
          queue.push(link);
        }
      }
      queue.sort(compareStrings);
    }
  }

  pages.sort((left, right) =>
    compareStrings(left.page.canonicalUrl!, right.page.canonicalUrl!),
  );
  if (pages.length === 0) {
    throw new CrawlError(`No crawlable HTML pages found at ${startUrl}.`);
  }
  return { discovery, pages };
}

async function discoverSitemapUrls(
  sitemapUrl: string,
  origin: string,
  requestOptions: RequestOptions,
): Promise<string[]> {
  let response: Response;
  try {
    response = await request(sitemapUrl, origin, requestOptions);
  } catch {
    return [];
  }
  if (!response.ok || new URL(response.url).origin !== origin) {
    return [];
  }
  const xml = await response.text();
  try {
    const parsed = new XMLParser().parse(xml) as {
      urlset?: { url?: Array<{ loc?: string }> | { loc?: string } };
    };
    const entries = parsed.urlset?.url;
    const values = Array.isArray(entries) ? entries : entries === undefined ? [] : [entries];
    return values
      .map((entry) => entry.loc)
      .filter((value): value is string => typeof value === "string")
      .map(normalizeUrl)
      .filter((url) => new URL(url).origin === origin)
      .sort(compareStrings);
  } catch {
    return [];
  }
}

type RequestOptions = {
  timeoutMs: number;
  userAgent: string;
};

async function fetchHtml(
  url: string,
  origin: string,
  options: RequestOptions,
): Promise<{ html: string; url: string } | undefined> {
  let response: Response;
  try {
    response = await request(url, origin, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CrawlError(`Failed to fetch ${url}: ${message}`);
  }
  if (!response.ok || new URL(response.url).origin !== origin) {
    return undefined;
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return undefined;
  }
  return { html: await response.text(), url: normalizeUrl(response.url) };
}

async function request(
  url: string,
  origin: string,
  options: RequestOptions,
  redirects = 0,
): Promise<Response> {
  if (new URL(url).origin !== origin) {
    throw new CrawlError(`Refusing cross-origin request: ${url}`);
  }
  if (redirects > 5) {
    throw new CrawlError(`Too many redirects while fetching ${url}.`);
  }
  const response = await fetch(url, {
    headers: { "user-agent": options.userAgent },
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location === null) {
      return response;
    }
    return request(new URL(location, url).href, origin, options, redirects + 1);
  }
  return response;
}

function readCanonicalUrl(html: string, sourceUrl: string, origin: string): string {
  const $ = load(html);
  const value = $('link[rel="canonical"]').attr("href");
  if (value !== undefined) {
    try {
      const canonical = normalizeUrl(new URL(value, sourceUrl).href);
      if (new URL(canonical).origin === origin) {
        return canonical;
      }
    } catch {
      // Ignore malformed canonical hints.
    }
  }
  return normalizeUrl(sourceUrl);
}

function readPageLinks(html: string, sourceUrl: string): string[] {
  const $ = load(html);
  const links = new Set<string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (href === undefined) {
      return;
    }
    try {
      links.add(normalizeUrl(new URL(href, sourceUrl).href));
    } catch {
      // Ignore malformed links.
    }
  });
  return [...links].sort(compareStrings);
}

async function readRobots(
  origin: string,
  options: RequestOptions,
): Promise<string[]> {
  let response: Response;
  try {
    response = await request(`${origin}/robots.txt`, origin, options);
  } catch {
    return [];
  }
  if (!response.ok) {
    return [];
  }
  let applies = false;
  const disallowed: string[] = [];
  for (const rawLine of (await response.text()).split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      applies = value === "*";
    } else if (key === "disallow" && applies && value.length > 0) {
      disallowed.push(value);
    }
  }
  return disallowed.sort(compareStrings);
}

function shouldCrawl(
  url: string,
  origin: string,
  include: string[] | undefined,
  exclude: string[] | undefined,
  disallowed: string[],
): boolean {
  const parsed = new URL(url);
  if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
    return false;
  }
  if (BLOCKED_EXTENSIONS.has(extension(parsed.pathname))) {
    return false;
  }
  if (disallowed.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return false;
  }
  if (include !== undefined && include.length > 0 && !include.some((pattern) => minimatch(parsed.pathname, pattern))) {
    return false;
  }
  return !(exclude ?? []).some((pattern) => minimatch(parsed.pathname, pattern));
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.href;
}

function extension(pathname: string): string {
  const match = pathname.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

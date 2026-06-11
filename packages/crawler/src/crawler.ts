import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { minimatch } from "minimatch";

import { normalizeHtml, normalizeMarkdown } from "@agentdocs/normalizer";
import { DocPageSchema, type DocPage } from "@agentdocs/shared";

export type CrawlOptions = {
  exclude?: string[];
  goal?: string;
  include?: string[];
  maxPages?: number;
  maxRequests?: number;
  respectRobots?: boolean;
  sitemap?: string;
  startUrl: string;
  timeoutMs?: number;
  userAgent?: string;
};

export type CrawlFailure = {
  url: string;
  reason:
    | "request_failed"
    | "http_error"
    | "cross_origin_redirect"
    | "too_many_redirects"
    | "unsupported_content_type"
    | "invalid_content";
  message: string;
};

export type CrawledPage = {
  markdownAlternateUrl?: string;
  normalizedFrom: "html" | "markdown";
  page: DocPage;
  rawHtml: string;
};

export type UnusablePage = {
  canonicalUrl?: string;
  message: string;
  rawHtml: string;
  reason: "empty_content" | "heading_only" | "extraction_failed";
  sourceUrl: string;
};

export type CrawlResult = {
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
  failures: CrawlFailure[];
  pages: CrawledPage[];
  scope: {
    exclude: string[];
    include: string[];
    kind: "explicit" | "inferred";
    pathPrefix?: string;
  };
  sitemapUrls: string[];
  unusablePages: UnusablePage[];
  warnings: string[];
};

export class CrawlError extends Error {
  readonly exitCode = 3;
  override readonly name = "CrawlError";
}

type RequestOptions = {
  timeoutMs: number;
  userAgent: string;
};

type HtmlResponse = {
  html: string;
  url: string;
};

type PageLink = {
  text: string;
  url: string;
};

type QueueItem = PageLink;

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_MAX_REQUESTS = 300;
const MAX_SITEMAP_REQUESTS = 50;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "AgentDocs/0.0";
const BLOCKED_EXTENSIONS = new Set([
  ".avif", ".css", ".gif", ".ico", ".jpeg", ".jpg", ".js", ".json",
  ".md", ".mdx", ".pdf", ".png", ".svg", ".webp", ".xml", ".zip",
]);

export async function crawlWebsite(options: CrawlOptions): Promise<CrawlResult> {
  const requestedStart = parseStartUrl(options.startUrl);
  const maxPages = positiveInteger(options.maxPages ?? DEFAULT_MAX_PAGES, "maxPages");
  const maxRequests = positiveInteger(
    options.maxRequests ?? Math.min(DEFAULT_MAX_REQUESTS, maxPages * 3),
    "maxRequests",
  );
  const requestOptions = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
  };
  const failures: CrawlFailure[] = [];
  const warnings: string[] = [];
  let attempted = 0;
  let skipped = 0;
  let duplicateContent = 0;

  const startResult = await fetchStartHtml(normalizeUrl(requestedStart.href), requestOptions);
  attempted += 1;
  if ("failure" in startResult) {
    throw new CrawlError(`Failed to fetch start page ${options.startUrl}: ${startResult.failure.message}`);
  }
  const startUrl = startResult.response.url;
  const origin = new URL(startUrl).origin;
  const robots = await readRobots(origin, requestOptions);
  const disallowed = options.respectRobots ? robots.disallowed : [];
  if (disallowed.some((prefix) => new URL(startUrl).pathname.startsWith(prefix))) {
    throw new CrawlError(`No crawlable HTML pages found at ${normalizeUrl(requestedStart.href)}.`);
  }

  const startLinks = readContentLinks(startResult.response.html, startUrl);
  const scope = options.include !== undefined && options.include.length > 0
    ? {
        kind: "explicit" as const,
        include: stableUnique(options.include),
        exclude: stableUnique(options.exclude ?? []),
      }
    : {
        kind: "inferred" as const,
        pathPrefix: inferScope(startUrl, startLinks, origin),
        include: [] as string[],
        exclude: stableUnique(options.exclude ?? []),
      };

  const sitemapSeeds = stableUnique(
    options.sitemap !== undefined
      ? [options.sitemap]
      : [...robots.sitemaps, `${origin}/sitemap.xml`],
  );
  const sitemap = await discoverSitemaps(
    sitemapSeeds,
    origin,
    requestOptions,
    startUrl,
    sitemapDiscoveryBudget(maxRequests),
    options.goal,
  );
  if (sitemap.budgetExhausted) {
    warnings.push(`sitemap_discovery_budget_exhausted: stopped after ${sitemap.requestCount} sitemap requests`);
  }
  const sitemapPages = sitemap.pages.filter((url) =>
    shouldCrawl(url, origin, scope, disallowed));
  const sitemapSet = new Set(sitemapPages);
  const queue: QueueItem[] = [{ url: startUrl, text: "" }];
  const queued = new Set([startUrl]);
  let linkCandidatesAdded = false;
  for (const url of sitemapPages) {
    if (!queued.has(url)) {
      queue.push({ url, text: "" });
      queued.add(url);
    }
  }
  sortQueue(queue, startUrl, options.goal);

  const preloaded = new Map([[startUrl, startResult.response]]);
  const fetched = new Set<string>();
  const canonicalUrls = new Set<string>();
  const contentHashes = new Set<string>();
  const pages: CrawledPage[] = [];
  const unusablePages: UnusablePage[] = [];

  while (queue.length > 0 && pages.length < maxPages && attempted <= maxRequests) {
    const item = queue.shift()!;
    if (fetched.has(item.url)) {
      skipped += 1;
      continue;
    }
    fetched.add(item.url);
    if (item.url !== startUrl && !shouldCrawl(item.url, origin, scope, disallowed)) {
      skipped += 1;
      continue;
    }

    let response = preloaded.get(item.url);
    if (response === undefined) {
      if (attempted >= maxRequests) {
        break;
      }
      const result = await fetchHtml(item.url, origin, requestOptions);
      attempted += 1;
      if ("failure" in result) {
        failures.push(result.failure);
        continue;
      }
      response = result.response;
    }

    let canonicalUrl = readCanonicalUrl(response.html, response.url, origin);
    if (canonicalUrl !== response.url && !fetched.has(canonicalUrl) && attempted < maxRequests) {
      const canonicalResult = await fetchHtml(canonicalUrl, origin, requestOptions);
      attempted += 1;
      fetched.add(canonicalUrl);
      if (!("failure" in canonicalResult)) {
        response = canonicalResult.response;
        canonicalUrl = readCanonicalUrl(response.html, response.url, origin);
      } else {
        failures.push(canonicalResult.failure);
      }
    }

    for (const link of readPageLinks(response.html, response.url)) {
      if (!queued.has(link.url) && !fetched.has(link.url)
        && shouldCrawl(link.url, origin, scope, disallowed)) {
        queued.add(link.url);
        queue.push(link);
        if (!sitemapSet.has(link.url)) linkCandidatesAdded = true;
      }
    }
    sortQueue(queue, startUrl, options.goal);

    if (canonicalUrls.has(canonicalUrl)
      || !shouldCrawl(canonicalUrl, origin, scope, disallowed)) {
      skipped += 1;
      continue;
    }
    canonicalUrls.add(canonicalUrl);

    try {
      const alternate = findMarkdownAlternate(response.html, response.url, origin);
      const normalized = alternate !== undefined && attempted < maxRequests
        ? await fetchMarkdown(alternate, origin, requestOptions)
        : undefined;
      if (alternate !== undefined && attempted < maxRequests) {
        attempted += 1;
      }
      const page = normalized === undefined
        ? normalizeHtml({ canonicalUrl, html: response.html, sourceUrl: response.url })
        : normalizeMarkdown({
            canonicalUrl,
            markdown: normalized,
            sourceType: "website",
            sourceUrl: response.url,
          });
      const quality = assessPageQuality(page);
      if (!quality.usable) {
        unusablePages.push({
          canonicalUrl,
          message: quality.message,
          rawHtml: response.html,
          reason: quality.reason,
          sourceUrl: response.url,
        });
        continue;
      }
      if (contentHashes.has(page.contentHash)) {
        duplicateContent += 1;
        skipped += 1;
        continue;
      }
      contentHashes.add(page.contentHash);
      pages.push({
        markdownAlternateUrl: normalized === undefined ? undefined : alternate,
        normalizedFrom: normalized === undefined ? "html" : "markdown",
        page: DocPageSchema.parse(page),
        rawHtml: response.html,
      });
    } catch (error) {
      unusablePages.push({
        canonicalUrl,
        message: error instanceof Error ? error.message : String(error),
        rawHtml: response.html,
        reason: "extraction_failed",
        sourceUrl: response.url,
      });
      failures.push({
        url: response.url,
        reason: "invalid_content",
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

  }

  pages.sort((left, right) =>
    compareStrings(left.page.canonicalUrl!, right.page.canonicalUrl!));
  failures.sort((left, right) =>
    compareStrings(left.url, right.url) || compareStrings(left.reason, right.reason));
  const failedUrls = new Set(failures.map((failure) => normalizeUrl(failure.url)));
  for (const { page } of pages) {
    for (const link of page.links) {
      const target = safeNormalizeUrl(link.resolvedHref ?? link.href);
      if (link.kind === "internal" && target !== undefined && failedUrls.has(target)) {
        link.isBroken = true;
      }
    }
  }
  unusablePages.sort((left, right) => compareStrings(left.sourceUrl, right.sourceUrl));
  const hasSitemap = sitemapPages.length > 0;
  return {
    counts: {
      attempted,
      collected: pages.length,
      discoveryRequests: sitemap.requestCount,
      duplicateContent,
      failed: failures.length,
      skipped,
      unusable: unusablePages.length,
      usable: pages.length,
    },
    discovery: hasSitemap ? linkCandidatesAdded ? "hybrid" : "sitemap" : "links",
    failures,
    pages,
    scope,
    sitemapUrls: sitemap.urls,
    unusablePages,
    warnings,
  };
}

function parseStartUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }
    return url;
  } catch {
    throw new CrawlError(`Invalid start URL: ${value}`);
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new CrawlError(`${name} must be a positive integer.`);
  }
  return value;
}

async function discoverSitemaps(
  seeds: string[],
  origin: string,
  options: RequestOptions,
  startUrl: string,
  requestBudget: number,
  goal?: string,
): Promise<{ budgetExhausted: boolean; pages: string[]; requestCount: number; urls: string[] }> {
  const visited = new Set<string>();
  const pages = new Set<string>();
  let budgetExhausted = false;
  async function visit(value: string): Promise<void> {
    const url = safeNormalizeUrl(value);
    if (url === undefined || visited.has(url)
      || new URL(url).origin !== origin) {
      return;
    }
    if (visited.size >= requestBudget) {
      budgetExhausted = true;
      return;
    }
    visited.add(url);
    let response: Response;
    try {
      response = await request(url, origin, options);
    } catch {
      return;
    }
    if (!response.ok) {
      return;
    }
    try {
      const parsed = new XMLParser().parse(await response.text()) as {
        sitemapindex?: { sitemap?: Array<{ loc?: string }> | { loc?: string } };
        urlset?: { url?: Array<{ loc?: string }> | { loc?: string } };
      };
      const children = arrayValue(parsed.sitemapindex?.sitemap)
        .map((entry) => safeNormalizeUrl(entry.loc))
        .filter((entry): entry is string => entry !== undefined)
        .sort((left, right) =>
          sitemapPriority(right, startUrl, goal) - sitemapPriority(left, startUrl, goal)
          || compareStrings(left, right));
      if (children.length > 0) {
        for (const child of children) await visit(child);
        return;
      }
      for (const entry of arrayValue(parsed.urlset?.url)) {
        const page = safeNormalizeUrl(entry.loc);
        if (page !== undefined && new URL(page).origin === origin) pages.add(page);
      }
    } catch {
      // Invalid sitemap candidates are ignored.
    }
  }
  for (const seed of [...seeds].sort((left, right) =>
    sitemapPriority(right, startUrl, goal) - sitemapPriority(left, startUrl, goal)
    || compareStrings(left, right))) await visit(seed);
  return {
    budgetExhausted,
    pages: [...pages].sort(compareStrings),
    requestCount: visited.size,
    urls: [...visited].sort(compareStrings),
  };
}

function sitemapDiscoveryBudget(maxRequests: number): number {
  return Math.min(MAX_SITEMAP_REQUESTS, Math.max(2, Math.floor(maxRequests / 4)));
}

function arrayValue<T>(value: T[] | T | undefined): T[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

async function fetchHtml(
  url: string,
  origin: string,
  options: RequestOptions,
): Promise<{ response: HtmlResponse } | { failure: CrawlFailure }> {
  let response: Response;
  try {
    response = await request(url, origin, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = /cross-origin/i.test(message)
      ? "cross_origin_redirect"
      : /too many redirects/i.test(message) ? "too_many_redirects" : "request_failed";
    return { failure: { url, reason, message } };
  }
  if (!response.ok) {
    return {
      failure: { url, reason: "http_error", message: `HTTP ${response.status}` },
    };
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return {
      failure: {
        url,
        reason: "unsupported_content_type",
        message: `Unsupported content type: ${contentType || "unknown"}`,
      },
    };
  }
  return { response: { html: await response.text(), url: normalizeUrl(response.url) } };
}

async function fetchStartHtml(
  url: string,
  options: RequestOptions,
): Promise<{ response: HtmlResponse } | { failure: CrawlFailure }> {
  let response: Response;
  try {
    response = await requestStart(url, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      failure: {
        url,
        reason: /too many redirects/i.test(message) ? "too_many_redirects" : "request_failed",
        message,
      },
    };
  }
  if (!response.ok) {
    return { failure: { url, reason: "http_error", message: `HTTP ${response.status}` } };
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return {
      failure: {
        url,
        reason: "unsupported_content_type",
        message: `Unsupported content type: ${contentType || "unknown"}`,
      },
    };
  }
  return { response: { html: await response.text(), url: normalizeUrl(response.url) } };
}

async function fetchMarkdown(
  url: string,
  origin: string,
  options: RequestOptions,
): Promise<string | undefined> {
  try {
    const response = await request(url, origin, options);
    if (!response.ok) return undefined;
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!type.includes("markdown") && !type.includes("text/plain")) return undefined;
    const value = await response.text();
    return /(^|\n)#{1,6}\s+\S/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function request(
  url: string,
  origin: string,
  options: RequestOptions,
  redirects = 0,
): Promise<Response> {
  if (new URL(url).origin !== origin) throw new CrawlError(`Refusing cross-origin request: ${url}`);
  if (redirects > 5) throw new CrawlError(`Too many redirects while fetching ${url}.`);
  const response = await fetch(url, {
    headers: { "user-agent": options.userAgent },
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    return location === null
      ? response
      : request(new URL(location, url).href, origin, options, redirects + 1);
  }
  return response;
}

async function requestStart(
  url: string,
  options: RequestOptions,
  redirects = 0,
): Promise<Response> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new CrawlError(`Refusing unsupported redirect: ${url}`);
  }
  if (redirects > 5) throw new CrawlError(`Too many redirects while fetching ${url}.`);
  const response = await fetch(url, {
    headers: { "user-agent": options.userAgent },
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    return location === null
      ? response
      : requestStart(new URL(location, url).href, options, redirects + 1);
  }
  return response;
}

function readCanonicalUrl(html: string, sourceUrl: string, origin: string): string {
  const value = load(html)('link[rel="canonical"]').attr("href");
  const canonical = value === undefined ? undefined : resolveUrl(value, sourceUrl);
  return canonical !== undefined && new URL(canonical).origin === origin
    ? canonical
    : normalizeUrl(sourceUrl);
}

function readPageLinks(html: string, sourceUrl: string): PageLink[] {
  const $ = load(html);
  const links = new Map<string, string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const url = href === undefined ? undefined : resolveUrl(href, sourceUrl);
    if (url !== undefined && !links.has(url)) links.set(url, $(element).text().trim());
  });
  return [...links].map(([url, text]) => ({ text, url }))
    .sort((left, right) => compareStrings(left.url, right.url));
}

function readContentLinks(html: string, sourceUrl: string): PageLink[] {
  const $ = load(html);
  const root = firstContentRoot($);
  const links = new Map<string, string>();
  root.find("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const url = href === undefined ? undefined : resolveUrl(href, sourceUrl);
    if (url !== undefined && !links.has(url)) links.set(url, $(element).text().trim());
  });
  return [...links].map(([url, text]) => ({ text, url }))
    .sort((left, right) => compareStrings(left.url, right.url));
}

function findMarkdownAlternate(html: string, sourceUrl: string, origin: string): string | undefined {
  const $ = load(html);
  const candidates: string[] = [];
  const metadata = $('meta[name="markdown_url" i]').attr("content");
  if (metadata !== undefined) {
    const url = resolveUrl(metadata, sourceUrl);
    if (url !== undefined && new URL(url).origin === origin) candidates.push(url);
  }
  $("a[href], link[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (href === undefined) return;
    const text = $(element).text().trim();
    const rel = $(element).attr("rel") ?? "";
    const type = $(element).attr("type") ?? "";
    if (!/\.mdx?(?:$|[?#])/i.test(href) && !/markdown/i.test(`${text} ${rel} ${type}`)) return;
    const url = resolveUrl(href, sourceUrl);
    if (url !== undefined && new URL(url).origin === origin) candidates.push(url);
  });
  return stableUnique(candidates)[0];
}

function firstContentRoot($: ReturnType<typeof load>) {
  for (const selector of [
    "main article", "article[role='main']", "main", "article", "[role='main']",
    "#main-content", ".main-content", ".document", ".body", "body",
  ]) {
    const candidate = $(selector).first();
    if (candidate.length > 0 && candidate.text().trim().length > 0) return candidate;
  }
  return $("body");
}

function assessPageQuality(page: DocPage): {
  message: string;
  reason: "empty_content" | "heading_only";
  usable: boolean;
} {
  const body = page.markdown
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const usefulCode = page.codeBlocks.some((block) => block.value.trim().length >= 20);
  if (body.length === 0 && !usefulCode) {
    return { usable: false, reason: "empty_content", message: "No meaningful body content was extracted." };
  }
  if (body.length < 12 && !usefulCode && page.headings.length <= 1) {
    return { usable: false, reason: "heading_only", message: "Only a title or heading was extracted." };
  }
  return { usable: true, reason: "heading_only", message: "Usable documentation content extracted." };
}

function sitemapPriority(url: string, startUrl: string, goal?: string): number {
  const value = new URL(url).pathname.toLowerCase();
  const start = new URL(startUrl).pathname.toLowerCase();
  const terms = stableUnique([
    ...start.split(/[/_.-]+/).filter((term) => term.length > 2),
    ...tokenize(goal ?? "").filter((term) => term.length > 2),
  ]);
  return terms.reduce((score, term) => score + (value.includes(term) ? 2 : 0), 0)
    + (value.includes("en-us") || value.includes("_en_") || value.includes("/en/") ? 1 : 0);
}

async function readRobots(
  origin: string,
  options: RequestOptions,
): Promise<{ disallowed: string[]; sitemaps: string[] }> {
  let response: Response;
  try {
    response = await request(`${origin}/robots.txt`, origin, options);
  } catch {
    return { disallowed: [], sitemaps: [] };
  }
  if (!response.ok) return { disallowed: [], sitemaps: [] };
  const groups: Array<{ agents: string[]; disallowed: string[] }> = [];
  const sitemaps: string[] = [];
  let current = { agents: [] as string[], disallowed: [] as string[] };
  let hasDirectives = false;
  for (const rawLine of (await response.text()).split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "sitemap") {
      const url = safeNormalizeUrl(value);
      if (url !== undefined && new URL(url).origin === origin) sitemaps.push(url);
    } else if (key === "user-agent") {
      if (hasDirectives && current.agents.length > 0) {
        groups.push(current);
        current = { agents: [], disallowed: [] };
        hasDirectives = false;
      }
      if (value.length > 0) current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current.agents.length > 0) {
      hasDirectives = true;
      if (value.length > 0) current.disallowed.push(value);
    }
  }
  if (current.agents.length > 0) groups.push(current);
  const userAgent = options.userAgent.toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && userAgent.includes(agent)));
  const applicable = specific.length > 0
    ? specific
    : groups.filter((group) => group.agents.includes("*"));
  return {
    disallowed: stableUnique(applicable.flatMap((group) => group.disallowed)),
    sitemaps: stableUnique(sitemaps),
  };
}

function inferScope(startUrl: string, links: PageLink[], origin: string): string {
  const relevant = links
    .map((link) => link.url)
    .filter((url) => new URL(url).origin === origin && !BLOCKED_EXTENSIONS.has(extension(new URL(url).pathname)));
  const candidates = ancestorPrefixes(new URL(startUrl).pathname);
  for (const prefix of candidates) {
    const matches = relevant.filter((url) => new URL(url).pathname.startsWith(prefix));
    if (matches.length >= 3 && matches.length >= Math.ceil(relevant.length / 2)) return prefix;
  }
  return directoryPrefix(new URL(startUrl).pathname);
}

function ancestorPrefixes(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  const directorySegments = segments.slice(0, -1);
  const values: string[] = [];
  for (let length = directorySegments.length; length >= 1; length -= 1) {
    values.push(`/${directorySegments.slice(0, length).join("/")}/`);
  }
  return values;
}

function directoryPrefix(pathname: string): string {
  if (pathname === "/") return "/";
  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

function shouldCrawl(
  url: string,
  origin: string,
  scope: CrawlResult["scope"],
  disallowed: string[],
): boolean {
  const parsed = new URL(url);
  if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)
    || BLOCKED_EXTENSIONS.has(extension(parsed.pathname))
    || disallowed.some((prefix) => parsed.pathname.startsWith(prefix))) return false;
  if (scope.include.length > 0
    && !scope.include.some((pattern) => minimatch(parsed.pathname, pattern))) return false;
  if (scope.pathPrefix !== undefined
    && parsed.pathname !== scope.pathPrefix.replace(/\/$/, "")
    && !parsed.pathname.startsWith(scope.pathPrefix)) return false;
  return !scope.exclude.some((pattern) => minimatch(parsed.pathname, pattern));
}

function sortQueue(queue: QueueItem[], startUrl: string, goal?: string): void {
  queue.sort((left, right) => {
    if (left.url === startUrl) return -1;
    if (right.url === startUrl) return 1;
    const goalDifference = scoreGoal(right, goal) - scoreGoal(left, goal);
    return goalDifference
      || pathDistance(left.url, startUrl) - pathDistance(right.url, startUrl)
      || compareStrings(left.url, right.url);
  });
}

function scoreGoal(item: QueueItem, goal?: string): number {
  if (goal === undefined) return 0;
  const value = `${item.url} ${item.text}`.toLowerCase();
  return stableUnique(tokenize(goal)).reduce(
    (score, term) => score + (value.includes(term) ? 1 : 0), 0);
}

function pathDistance(left: string, right: string): number {
  const leftParts = new URL(left).pathname.split("/").filter(Boolean);
  const rightParts = new URL(right).pathname.split("/").filter(Boolean);
  let common = 0;
  while (leftParts[common] === rightParts[common] && common < leftParts.length) common += 1;
  return leftParts.length + rightParts.length - common * 2;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function safeNormalizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return normalizeUrl(value);
  } catch {
    return undefined;
  }
}

function resolveUrl(value: string, base: string): string | undefined {
  try {
    return normalizeUrl(new URL(value, base).href);
  } catch {
    return undefined;
  }
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_|^(?:hl|locale|ref|source)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

function extension(pathname: string): string {
  return pathname.toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] ?? "";
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

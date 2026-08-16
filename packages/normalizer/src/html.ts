import { load } from "cheerio";
import TurndownService from "turndown";

import { DocPageSchema, type DocPage, type Link } from "@agentdocs/shared";

import { normalizeMarkdown } from "./markdown.js";

export type NormalizeHtmlOptions = {
  canonicalUrl: string;
  html: string;
  sourceUrl: string;
};

export function normalizeHtml(options: NormalizeHtmlOptions): DocPage {
  const $ = load(options.html);
  const navigationLinks = extractNavigationLinks($, options.sourceUrl);
  $("script, style, noscript, template, nav, footer, form").remove();
  $([
    "[aria-label*='feedback' i]",
    "[class*='feedback' i]",
    "[class*='breadcrumb' i]",
    "[class*='pagination' i]",
    "[class*='sidebar' i]",
    "[class*='toc' i]",
    "[id*='feedback' i]",
  ].join(",")).remove();
  const title = $("h1").first().text().trim() || $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim();
  const root = firstRoot($, [
    "main article",
    "article[role='main']",
    "main",
    "article",
    "[role='main']",
    "#main-content",
    ".main-content",
    ".document",
    ".body",
    "body",
  ]);
  const turndown = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    headingStyle: "atx",
  });
  let markdown = turndown.turndown(root.html() ?? "");
  if (title.length > 0 && !markdown.startsWith("# ")) {
    markdown = `# ${title}\n\n${markdown}`;
  }
  markdown = `${markdown.trim()}\n`;

  const page = normalizeMarkdown({
    markdown,
    sourceFormat: "html",
    sourceType: "website",
    sourceUrl: options.sourceUrl,
    canonicalUrl: options.canonicalUrl,
  });

  return DocPageSchema.parse({
    ...page,
    title: title || page.title,
    description,
    links: mergeLinks(page.links, navigationLinks),
    normalization: { mode: "html", warnings: [] },
  });
}

function extractNavigationLinks($: ReturnType<typeof load>, sourceUrl: string): Link[] {
  const selectors: Array<{ role: Link["role"]; selector: string }> = [
    { role: "breadcrumb", selector: "[class*='breadcrumb' i] a[href]" },
    { role: "pagination", selector: "[class*='pagination' i] a[href]" },
    { role: "toc", selector: "[class*='toc' i] a[href]" },
    { role: "navigation", selector: "nav a[href], [class*='sidebar' i] a[href]" },
  ];
  const links: Link[] = [];
  const seen = new Set<string>();
  for (const { role, selector } of selectors) {
    $(selector).each((_index, element) => {
      const href = $(element).attr("href")?.trim();
      if (href === undefined || href.length === 0) return;
      const text = $(element).text().replace(/\s+/g, " ").trim();
      const key = `${href}\u0000${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({
        text,
        href,
        resolvedHref: resolveHtmlHref(href, sourceUrl),
        kind: classifyHtmlLink(href, sourceUrl),
        role,
        sourceOrder: links.length,
      });
    });
  }
  return links;
}

function mergeLinks(contentLinks: Link[], navigationLinks: Link[]): Link[] {
  const merged = [...navigationLinks, ...contentLinks];
  return merged.map((link, sourceOrder) => ({ ...link, sourceOrder }));
}

function resolveHtmlHref(href: string, sourceUrl: string): string | undefined {
  if (classifyHtmlLink(href, sourceUrl) !== "internal") return undefined;
  try {
    return new URL(href, sourceUrl).href;
  } catch {
    return undefined;
  }
}

function classifyHtmlLink(href: string, sourceUrl: string): Link["kind"] {
  if (href.startsWith("#")) return "anchor";
  try {
    const resolved = new URL(href, sourceUrl);
    return resolved.origin === new URL(sourceUrl).origin ? "internal" : "external";
  } catch {
    return "unknown";
  }
}

function firstRoot(
  $: ReturnType<typeof load>,
  selectors: string[],
) {
  for (const selector of selectors) {
    const candidate = $(selector).first();
    if (candidate.length > 0 && candidate.text().trim().length > 0) {
      return candidate;
    }
  }
  return $("body");
}

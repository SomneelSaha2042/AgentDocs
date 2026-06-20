import { load } from "cheerio";
import TurndownService from "turndown";

import type { DocPage } from "@agentdocs/shared";

import { normalizeMarkdown } from "./markdown.js";

export type NormalizeHtmlOptions = {
  canonicalUrl: string;
  html: string;
  sourceUrl: string;
};

export function normalizeHtml(options: NormalizeHtmlOptions): DocPage {
  const $ = load(options.html);
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

  return {
    ...page,
    title: title || page.title,
    description,
    normalization: { mode: "html", warnings: [] },
  };
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

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
  $("script, style, noscript, template").remove();
  const title = $("h1").first().text().trim() || $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim();
  const root = $("main").first().length > 0 ? $("main").first() : $("body");
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
    sourceType: "website",
    sourceUrl: options.sourceUrl,
    canonicalUrl: options.canonicalUrl,
  });

  return {
    ...page,
    title: title || page.title,
    description,
  };
}

import {
  ContextFacetSchema,
  DocPageSchema,
  type ContextFacet,
  type DocPage,
  type Evidence,
} from "@agentdocs/shared";

import { extractVersionHints } from "./extract.js";

export type ContextRule = {
  match: string;
  facets: Record<string, string>;
};

export type ApplyContextFacetsOptions = {
  fixed?: Record<string, string>;
  rules?: ContextRule[];
  sourceFormat?: "markdown" | "mdx" | "html";
};

const FRONTMATTER_KEYS = [
  "content_type",
  "framework",
  "locale",
  "router",
  "runtime",
  "source_format",
  "version",
] as const;

const COMMON_LOCALE_BASES = new Set([
  "ar",
  "da",
  "de",
  "en",
  "es",
  "fi",
  "fr",
  "he",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "nb",
  "nl",
  "no",
  "pl",
  "pt",
  "ru",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
]);

export function applyContextFacets(
  page: DocPage,
  options: ApplyContextFacetsOptions = {},
): DocPage {
  const source = page.canonicalUrl === undefined && page.sourceUrl === undefined
    ? page.repoPath ?? ""
    : new URL(page.canonicalUrl ?? page.sourceUrl!).pathname;
  const facets = [...page.facets];

  for (const [key, value] of Object.entries(options.fixed ?? {})) {
    facets.push(facet(key, value, {
      source: "config",
      quote: `source facet: ${key}=${value}`,
    }));
  }
  for (const rule of options.rules ?? []) {
    if (!matchesGlob(source, rule.match)) continue;
    for (const [key, value] of Object.entries(rule.facets)) {
      facets.push(facet(key, value, {
        source: "config",
        quote: `context rule ${rule.match}: ${key}=${value}`,
      }));
    }
  }
  if (options.sourceFormat !== undefined) {
    facets.push(facet("source_format", options.sourceFormat, pageEvidence(page, `source format: ${options.sourceFormat}`)));
  }
  for (const key of FRONTMATTER_KEYS) {
    const value = page.frontmatter?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      facets.push(facet(key, value.trim(), pageEvidence(page, `frontmatter ${key}: ${value.trim()}`)));
    }
  }
  const inferredContentType = inferContentType(source, page.title, page.frontmatter);
  if (inferredContentType !== undefined) {
    facets.push(facet("content_type", inferredContentType, pageEvidence(page, `inferred content_type: ${inferredContentType}`)));
  }
  const inferredLocale = inferLocale(source, page.frontmatter);
  if (inferredLocale !== undefined) {
    facets.push(facet("locale", inferredLocale, pageEvidence(page, `inferred locale: ${inferredLocale}`)));
  }
  for (const version of extractVersionHints(`${source}\n${page.title}`)) {
    facets.push(facet("version", version, pageEvidence(page, `version evidence: ${version}`)));
  }

  return DocPageSchema.parse({ ...page, facets: stableFacets(facets) });
}

function facet(key: string, value: string, evidence: Evidence): ContextFacet {
  return ContextFacetSchema.parse({
    key,
    value: key === "version" ? value.replace(/^V(?=\d)/, "v") : value,
    evidence: [evidence],
  });
}

function pageEvidence(page: DocPage, quote: string): Evidence {
  return {
    source: "page",
    pageId: page.id,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
    quote,
  };
}

function stableFacets(facets: ContextFacet[]): ContextFacet[] {
  const grouped = new Map<string, ContextFacet>();
  for (const item of facets) {
    const key = `${item.key}\0${item.value}`;
    const current = grouped.get(key);
    grouped.set(key, current === undefined
      ? item
      : { ...current, evidence: stableEvidence([...current.evidence, ...item.evidence]) });
  }
  return [...grouped.values()]
    .map((item) => ({ ...item, evidence: stableEvidence(item.evidence) }))
    .sort((left, right) =>
      compareStrings(left.key, right.key) || compareStrings(left.value, right.value));
}

function inferContentType(
  source: string,
  title: string,
  frontmatter?: Record<string, unknown>,
): "docs" | "blog" | "news" | "release" | "reference" | "tutorial" | "example" | undefined {
  const explicit = stringFrontmatter(frontmatter, ["content_type", "contentType", "type"]);
  if (explicit !== undefined && isContentType(explicit)) {
    return explicit;
  }
  const value = `${source} ${title}`.toLowerCase();
  if (/(?:^|[/\s_-])(?:changelog|changes|release-notes?|releases?|whats-new)(?:$|[/\s_-])/.test(value)) return "release";
  if (/(?:^|[/\s_-])(?:news|announcements?)(?:$|[/\s_-])/.test(value)) return "news";
  if (/(?:^|[/\s_-])(?:blog|posts?|articles?)(?:$|[/\s_-])/.test(value)) return "blog";
  if (/(?:^|[/\s_-])(?:examples?|samples?|demo)(?:$|[/\s_-])/.test(value)) return "example";
  if (/(?:^|[/\s_-])(?:tutorials?|quickstart|getting-started|how-to|guides?)(?:$|[/\s_-])/.test(value)) return "tutorial";
  if (/(?:^|[/\s_-])(?:reference|api-reference|api|spec|schema)(?:$|[/\s_-])/.test(value)) return "reference";
  if (/(?:^|[/\s_-])(?:docs?|documentation|manual|handbook)(?:$|[/\s_-])/.test(value)) return "docs";
  return undefined;
}

function inferLocale(
  source: string,
  frontmatter?: Record<string, unknown>,
): string | undefined {
  const explicit = stringFrontmatter(frontmatter, ["locale", "lang", "language"]);
  if (explicit !== undefined && isLocale(explicit)) {
    return normalizeLocale(explicit);
  }
  const segments = (source.split(/[?#]/, 1)[0] ?? "").split("/").filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (isLocale(segment)) {
      return normalizeLocale(segment);
    }
  }
  return undefined;
}

function stringFrontmatter(
  frontmatter: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = frontmatter?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().toLowerCase();
    }
  }
  return undefined;
}

function isContentType(value: string): value is "docs" | "blog" | "news" | "release" | "reference" | "tutorial" | "example" {
  return ["docs", "blog", "news", "release", "reference", "tutorial", "example"].includes(value);
}

function isLocale(value: string): boolean {
  const normalized = normalizeLocale(value);
  const [language, region, extra] = normalized.split("-");
  if (language === undefined || extra !== undefined || !COMMON_LOCALE_BASES.has(language)) {
    return false;
  }
  return region === undefined || /^(?:[a-z]{2}|\d{3})$/.test(region);
}

function normalizeLocale(value: string): string {
  return value.toLowerCase().replace("_", "-");
}

function stableEvidence(evidence: Evidence[]): Evidence[] {
  const unique = new Map(evidence.map((item) => [JSON.stringify(item), item]));
  return [...unique.values()].sort((left, right) =>
    compareStrings(JSON.stringify(left), JSON.stringify(right)));
}

function matchesGlob(value: string, pattern: string): boolean {
  let expression = "";
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern.slice(index, index + 3) === "**/") {
      expression += "(?:.*/)?";
      index += 2;
    } else if (pattern.slice(index, index + 2) === "**") {
      expression += ".*";
      index += 1;
    } else if (pattern[index] === "*") {
      expression += "[^/]*";
    } else if (pattern[index] === "?") {
      expression += "[^/]";
    } else {
      expression += pattern[index]!.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^/?${expression}$`).test(value);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

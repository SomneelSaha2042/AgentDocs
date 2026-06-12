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
};

const FRONTMATTER_KEYS = ["framework", "router", "runtime", "version"] as const;

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
  for (const key of FRONTMATTER_KEYS) {
    const value = page.frontmatter?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      facets.push(facet(key, value.trim(), pageEvidence(page, `frontmatter ${key}: ${value.trim()}`)));
    }
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

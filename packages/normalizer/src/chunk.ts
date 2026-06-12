import { createHash } from "node:crypto";

import { ChunkSchema, type Chunk, type DocPage } from "@agentdocs/shared";

import {
  deterministicEntityId,
  extractDeterministicEntities,
} from "./extract.js";

export type ChunkMarkdownOptions = {
  maxTokens?: number;
};

type Section = {
  headingId?: string;
  headingPath: string[];
  lines: string[];
};

const DEFAULT_MAX_TOKENS = 500;

export function chunkMarkdownByHeading(
  page: DocPage,
  options: ChunkMarkdownOptions = {},
): Chunk[] {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  if (!Number.isInteger(maxTokens) || maxTokens < 1) {
    throw new Error("maxTokens must be a positive integer.");
  }

  const sections = splitIntoSections(page);
  const chunks: Chunk[] = [];
  for (const section of sections) {
    const links = page.links
      .filter((link) => link.sourceHeadingId === section.headingId)
      .map((link) => link.resolvedHref ?? link.href)
      .sort(compareStrings);
    for (const text of splitSection(section.lines, maxTokens)) {
      const contentHash = hash(text);
      const extraction = extractDeterministicEntities(text);
      chunks.push(
        ChunkSchema.parse({
          id: `chunk_${hash(`${page.id}:${section.headingPath.join("/")}:${chunks.length}:${contentHash}`).slice(0, 16)}`,
          pageId: page.id,
          headingPath: section.headingPath,
          text,
          tokenEstimate: estimateTokens(text),
          links,
          entityIds: extractionEntityIds(extraction),
          contentHash,
          facets: page.facets,
        }),
      );
    }
  }
  return chunks;
}

export function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function splitIntoSections(page: DocPage): Section[] {
  const lines = withoutLeadingFrontmatter(
    page.markdown.split(/\r?\n/),
    page.frontmatter !== undefined,
  );
  const headingByLine = new Map(
    page.headings
      .filter((heading) => heading.position.startLine !== undefined)
      .map((heading) => [heading.position.startLine!, heading]),
  );
  const pathByDepth: string[] = [];
  const sections: Section[] = [];
  let current: Section = {
    headingPath: page.headings.length === 0 ? [page.title] : [],
    lines: [],
  };

  for (let index = 0; index < lines.length; index += 1) {
    const heading = headingByLine.get(index + 1);
    if (heading !== undefined) {
      pushSection(sections, current);
      pathByDepth.length = heading.depth - 1;
      pathByDepth[heading.depth - 1] = heading.text;
      current = {
        headingId: heading.id,
        headingPath: pathByDepth.filter((value) => value !== undefined),
        lines: [lines[index]!],
      };
    } else {
      current.lines.push(lines[index]!);
    }
  }
  pushSection(sections, current);
  return sections;
}

function withoutLeadingFrontmatter(lines: string[], hasFrontmatter: boolean): string[] {
  if (!hasFrontmatter || lines[0]?.trim() !== "---") {
    return lines;
  }
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  return closing === -1 ? lines : lines.slice(closing + 1);
}

function pushSection(sections: Section[], section: Section): void {
  if (section.lines.join("\n").trim().length > 0) {
    sections.push(section);
  }
}

function splitSection(lines: string[], maxTokens: number): string[] {
  const blocks = toBlocks(lines);
  const chunks: string[] = [];
  let current: string[] = [];

  for (const block of blocks) {
    const candidate = [...current, block].join("\n\n").trim();
    if (current.length === 0 || estimateTokens(candidate) <= maxTokens) {
      current.push(block);
      continue;
    }
    chunks.push(current.join("\n\n").trim());
    current = estimateTokens(block) <= maxTokens ? [block] : [];
    if (current.length === 0) {
      chunks.push(...splitOversizedText(block, maxTokens));
    }
  }
  if (current.length > 0) {
    chunks.push(current.join("\n\n").trim());
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function toBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | undefined;

  const flush = () => {
    const value = current.join("\n").trim();
    if (value.length > 0) {
      blocks.push(value);
    }
    current = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fence === undefined && fenceMatch !== null) {
      flush();
      fence = fenceMatch[1]![0];
      current.push(line);
      continue;
    }
    if (fence !== undefined) {
      current.push(line);
      if (fenceMatch?.[1]?.[0] === fence) {
        flush();
        fence = undefined;
      }
      continue;
    }
    if (line.trim().length === 0) {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();
  return blocks;
}

function splitOversizedText(value: string, maxTokens: number): string[] {
  if (/^\s*(```+|~~~+)/.test(value)) {
    return [value];
  }
  const maxCharacters = maxTokens * 4;
  const parts: string[] = [];
  let remaining = value;
  while (remaining.length > maxCharacters) {
    const preferred = remaining.lastIndexOf(" ", maxCharacters);
    const splitAt = preferred > maxCharacters / 2 ? preferred : maxCharacters;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length > 0) {
    parts.push(remaining);
  }
  return parts;
}

function extractionEntityIds(
  extraction: ReturnType<typeof extractDeterministicEntities>,
): string[] {
  const entries: Array<[string, string[]]> = [
    ["package", [...extraction.packages, ...extraction.imports.filter(isExternalImport)]],
    ["env_var", extraction.envVars],
    ["cli_command", extraction.cliCommands],
    ["api", extraction.httpRoutes],
    ["concept", [...extraction.deprecatedMarkers, ...extraction.warnings]],
    ["version", extraction.versionHints],
  ];
  return entries
    .flatMap(([type, values]) =>
      values.map((value) => deterministicEntityId(type, value)),
    )
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .sort(compareStrings);
}

function isExternalImport(value: string): boolean {
  return !value.startsWith(".")
    && !value.startsWith("/")
    && !value.startsWith("#")
    && !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

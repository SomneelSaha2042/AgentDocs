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

type Block = {
  kind: "code" | "prose";
  text: string;
};

type TableRow = {
  headers: string[];
  cells: string[];
  index: number;
};

type TableExtraction = {
  rows: TableRow[];
  remainingLines: string[];
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
    const table = extractTableRows(section.lines);
    const links = page.links
      .filter((link) => link.sourceHeadingId === section.headingId)
      .map((link) => link.resolvedHref ?? link.href)
      .sort(compareStrings);
    for (const row of table.rows) {
      const text = serializeTableRow(row);
      const contentHash = hash(text);
      const extraction = extractDeterministicEntities(text);
      chunks.push(ChunkSchema.parse({
        id: `chunk_${hash(`${page.id}:${section.headingPath.join("/")}:table_row:${row.index}:${contentHash}`).slice(0, 16)}`,
        pageId: page.id,
        kind: "table_row",
        headingPath: section.headingPath,
        text,
        tokenEstimate: estimateTokens(text),
        links: tableRowLinks(page, row),
        entityIds: extractionEntityIds(extraction),
        contentHash,
        facets: mergeFacets(page.facets, tableRowFacets(page, section, row, text)),
      }));
    }
    for (const text of splitSection(table.remainingLines, maxTokens)) {
      const contentHash = hash(text);
      const extraction = extractDeterministicEntities(text);
      chunks.push(
        ChunkSchema.parse({
          id: `chunk_${hash(`${page.id}:${section.headingPath.join("/")}:${chunks.length}:${contentHash}`).slice(0, 16)}`,
          pageId: page.id,
          kind: "section",
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

function extractTableRows(lines: string[]): TableExtraction {
  const consumed = new Set<number>();
  const rows: TableRow[] = [];
  for (let index = 0; index < lines.length - 2; index += 1) {
    if (consumed.has(index)) continue;
    const headers = tableCells(lines[index]!);
    const separator = tableCells(lines[index + 1]!);
    if (headers === undefined || separator === undefined || !isTableSeparator(separator) || headers.length < 2) {
      continue;
    }
    const dataRows: string[][] = [];
    let cursor = index + 2;
    while (cursor < lines.length) {
      const cells = tableCells(lines[cursor]!);
      if (cells === undefined || cells.length === 0 || cells.length > headers.length) break;
      dataRows.push(cells);
      cursor += 1;
    }
    if (dataRows.length === 0) continue;
    for (let consumedIndex = index; consumedIndex < cursor; consumedIndex += 1) {
      consumed.add(consumedIndex);
    }
    const rowOffset = rows.length;
    dataRows.forEach((cells, rowIndex) => {
      rows.push({ headers, cells, index: rowOffset + rowIndex });
    });
  }
  return {
    rows,
    remainingLines: lines.filter((_line, index) => !consumed.has(index)),
  };
}

function tableCells(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("```") || trimmed.startsWith("~~~") || !trimmed.includes("|")) {
    return undefined;
  }
  const withoutEdges = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const edgeTrimmed = withoutEdges.endsWith("|")
    ? withoutEdges.slice(0, -1)
    : withoutEdges;
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  let code = false;
  for (const character of edgeTrimmed) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (character === "`") {
      code = !code;
      current += character;
      continue;
    }
    if (character === "|" && !code) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells.length < 2 ? undefined : cells;
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

function serializeTableRow(row: TableRow): string {
  return row.headers
    .map((header, index) => `${header}: ${row.cells[index] ?? ""}`)
    .filter((value) => value.trim().length > 0)
    .join("\n");
}

function tableRowLinks(page: DocPage, row: TableRow): string[] {
  const hrefs = new Set<string>();
  const markdownLink = /\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g;
  const text = row.cells.join(" ");
  for (const match of text.matchAll(markdownLink)) {
    if (match[1] !== undefined) hrefs.add(match[1]);
  }
  return page.links
    .filter((link) => hrefs.has(link.href))
    .map((link) => link.resolvedHref ?? link.href)
    .sort(compareStrings);
}

function tableRowFacets(
  page: DocPage,
  section: Section,
  row: TableRow,
  text: string,
): Chunk["facets"] {
  const facets: Chunk["facets"] = [];
  const facetKeys = new Set([
    "adapter",
    "edition",
    "framework",
    "language",
    "library",
    "locale",
    "platform",
    "provider",
    "router",
    "runtime",
    "version",
  ]);
  const evidence = {
    source: "heading" as const,
    pageId: page.id,
    headingId: section.headingId,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
    quote: text,
  };
  row.headers.forEach((header, index) => {
    const key = header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const rawValue = stripTableMarkup(row.cells[index] ?? "");
    if (!facetKeys.has(key) || rawValue.length === 0) return;
    const composite = key === "framework"
      ? rawValue.match(/^(.+?)\s+(.+?)\s+router$/i)
      : null;
    if (composite !== null && composite[1] !== undefined && composite[2] !== undefined) {
      facets.push({ key, value: composite[1].trim(), evidence: [evidence] });
      facets.push({ key: "router", value: composite[2].trim().toLowerCase(), evidence: [evidence] });
      return;
    }
    facets.push({ key, value: rawValue, evidence: [evidence] });
  });
  return facets;
}

function stripTableMarkup(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeFacets(left: Chunk["facets"], right: Chunk["facets"]): Chunk["facets"] {
  const values = new Map<string, Chunk["facets"][number]>();
  for (const facet of [...left, ...right]) {
    values.set(`${facet.key}:${facet.value}`, facet);
  }
  return [...values.values()].sort((a, b) => compareStrings(`${a.key}:${a.value}`, `${b.key}:${b.value}`));
}

function splitSection(lines: string[], maxTokens: number): string[] {
  const blocks = toBlocks(lines);
  const chunks: string[] = [];
  let current: Block[] = [];

  for (const block of blocks) {
    const candidate = serializeBlocks([...current, block]);
    if (current.length === 0 || estimateTokens(candidate) <= maxTokens) {
      current.push(block);
      continue;
    }
    if (shouldAttachShortIntroToOversizedCode(current, block, maxTokens)) {
      chunks.push(candidate);
      current = [];
      continue;
    }
    chunks.push(serializeBlocks(current));
    current = estimateTokens(block.text) <= maxTokens || block.kind === "code" ? [block] : [];
    if (current.length === 0) {
      chunks.push(...splitOversizedProse(block.text, maxTokens));
    }
  }
  if (current.length > 0) {
    chunks.push(serializeBlocks(current));
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function shouldAttachShortIntroToOversizedCode(
  current: Block[],
  block: Block,
  maxTokens: number,
): boolean {
  if (block.kind !== "code" || estimateTokens(block.text) <= maxTokens) {
    return false;
  }
  if (current.length === 0 || current.some((candidate) => candidate.kind === "code")) {
    return false;
  }
  return estimateTokens(serializeBlocks(current)) <= maxTokens;
}

function toBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let current: string[] = [];
  let fence: string | undefined;
  let currentKind: Block["kind"] = "prose";

  const flush = () => {
    const value = current.join("\n").trim();
    if (value.length > 0) {
      blocks.push({ kind: currentKind, text: value });
    }
    current = [];
    currentKind = "prose";
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence === undefined && fenceMatch !== null) {
      flush();
      fence = fenceMatch[1]!;
      currentKind = "code";
      current.push(line);
      continue;
    }
    if (fence !== undefined) {
      current.push(line);
      if (isClosingFence(fence, line)) {
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

function isClosingFence(openingFence: string, line: string): boolean {
  const closingFence = line.match(/^\s*(`{3,}|~{3,})\s*$/)?.[1];
  return closingFence !== undefined
    && closingFence[0] === openingFence[0]
    && closingFence.length >= openingFence.length;
}

function serializeBlocks(blocks: Block[]): string {
  return blocks.map((block) => block.text).join("\n\n").trim();
}

function splitOversizedProse(value: string, maxTokens: number): string[] {
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

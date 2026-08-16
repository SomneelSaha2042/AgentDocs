import { createHash } from "node:crypto";
import path from "node:path";

import {
  DocPageSchema,
  type CodeBlock,
  type DocPage,
  type Heading,
  type Link,
} from "@agentdocs/shared";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";

import { applyContextFacets, type ApplyContextFacetsOptions } from "./context.js";

type Position = {
  start?: { line?: number };
  end?: { line?: number };
};

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  value?: string;
  depth?: number;
  lang?: string | null;
  url?: string;
  position?: Position;
};

export type NormalizeMarkdownOptions = {
  markdown: string;
  format?: "markdown" | "mdx";
  repoPath?: string;
  sourceFormat?: "markdown" | "mdx" | "html" | "rst" | "restText" | "adoc" | "asciidoc";
  sourceType?: "local_markdown" | "repo" | "website";
  sourceUrl?: string;
  canonicalUrl?: string;
  context?: ApplyContextFacetsOptions;
  mdxMode?: "tolerant" | "strict";
};

const DETERMINISTIC_DISCOVERY_TIME = "1970-01-01T00:00:00.000Z";
const ASSET_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".svg",
  ".webp",
]);

export function normalizeMarkdown(options: NormalizeMarkdownOptions): DocPage {
  const sourceType = options.sourceType ?? "local_markdown";
  const repoPath =
    options.repoPath === undefined ? undefined : toPosixPath(options.repoPath);
  let normalizedMarkdown = options.markdown;
  const stableSource = options.canonicalUrl ?? options.sourceUrl ?? repoPath;
  if (stableSource === undefined) {
    throw new Error("A repoPath, sourceUrl, or canonicalUrl is required.");
  }
  const format =
    options.format ??
    (repoPath?.toLowerCase().endsWith(".mdx") ? "mdx" : "markdown");
  let normalization: DocPage["normalization"] = { mode: "strict", warnings: [] };
  let tree: MarkdownNode;
  try {
    tree = parseMarkdown(normalizedMarkdown, format);
  } catch (error) {
    if (format !== "mdx" || options.mdxMode === "strict") {
      throw error;
    }
    const fallback = sanitizeMdx(normalizedMarkdown);
    normalizedMarkdown = fallback.markdown;
    tree = parseMarkdown(normalizedMarkdown, "markdown");
    normalization = {
      mode: "mdx-fallback",
      warnings: [
        `Strict MDX parsing failed: ${errorMessage(error)}`,
        ...fallback.warnings,
      ],
      omittedCharacterRatio: fallback.omittedCharacterRatio,
    };
  }
  const contentHash = hash(normalizedMarkdown);
  const pageId = `page_${hash(`${stableSource}:${contentHash}`).slice(0, 16)}`;

  const frontmatter = parseFrontmatter(tree);
  const headings: Heading[] = [];
  const links: Link[] = [];
  const codeBlocks: CodeBlock[] = [];
  let currentHeadingId: string | undefined;
  let ignoredEmptyHeadingCount = 0;

  visit(tree, (node) => {
    if (node.type === "heading") {
      const text = nodeText(node).trim();
      if (text.length === 0) {
        // Empty headings occur in generated/reference Markdown (for example
        // `####` list entries). They are not usable structural anchors. Keep
        // the source text in the normalized Markdown, but leave the current
        // section in place so links/code remain evidence-linked to a real
        // heading.
        ignoredEmptyHeadingCount += 1;
        return;
      }
      // Punctuation-only headings (for example `/` used as a home-page
      // title) are meaningful headings even though slugification removes
      // every character. Keep them addressable with a deterministic fallback
      // instead of emitting an invalid empty slug.
      const slug = slugify(text) || `section-${hash(`${pageId}:${headings.length}:${text}`).slice(0, 12)}`;
      const id = `heading_${hash(`${pageId}:${headings.length}:${slug}`).slice(0, 16)}`;
      headings.push({
        id,
        depth: node.depth ?? 1,
        text,
        slug,
        position: {
          startLine: node.position?.start?.line,
          endLine: node.position?.end?.line,
        },
      });
      currentHeadingId = id;
      return;
    }

    if (node.type === "link" && node.url !== undefined) {
      links.push({
        text: nodeText(node),
        href: node.url,
        resolvedHref: resolveHref(repoPath, options.sourceUrl, node.url),
        kind: classifyLink(node.url, options.sourceUrl),
        role: "content",
        sourceOrder: links.length,
        sourceHeadingId: currentHeadingId,
      });
      return;
    }

    if (node.type === "code") {
      const value = node.value ?? "";
      codeBlocks.push({
        id: `code_${hash(`${pageId}:${codeBlocks.length}:${value}`).slice(0, 16)}`,
        sourceOrder: codeBlocks.length,
        language: node.lang ?? undefined,
        value,
        sourceHeadingId: currentHeadingId,
      });
    }
  });

  const recoveredFences = recoverFencedCodeBlocks(normalizedMarkdown, headings);
  if (recoveredFences.length > 0) {
    const existing = codeBlocks.filter((block) => !/```|~~~/.test(block.value));
    const usedExistingIds = new Set<string>();
    const merged: CodeBlock[] = [];
    for (const recovered of recoveredFences) {
      const normalizedRecovered = normalizeCodeBlockForComparison(recovered.value);
      const matching = existing.find((block) => !usedExistingIds.has(block.id)
        && normalizeCodeBlockForComparison(block.value) === normalizedRecovered
        && (block.language === recovered.language || block.sourceHeadingId === recovered.sourceHeadingId));
      if (matching !== undefined) {
        usedExistingIds.add(matching.id);
        merged.push(matching);
      } else {
        merged.push({
          id: `code_${hash(`${pageId}:fence:${recovered.startLine}:${recovered.value}`).slice(0, 16)}`,
          sourceOrder: merged.length,
          language: recovered.language,
          value: recovered.value,
          sourceHeadingId: recovered.sourceHeadingId,
        });
      }
    }
    for (const block of existing) if (!usedExistingIds.has(block.id)) merged.push(block);
    codeBlocks.splice(0, codeBlocks.length, ...merged);
  }

  if (ignoredEmptyHeadingCount > 0) {
    normalization = {
      ...normalization,
      warnings: [
        ...normalization.warnings,
        `Ignored ${ignoredEmptyHeadingCount} empty Markdown heading${ignoredEmptyHeadingCount === 1 ? "" : "s"}.`,
      ],
    };
  }

  const title =
    stringValue(frontmatter?.title) ??
    headings.find((heading) => heading.depth === 1)?.text ??
    fallbackTitle(repoPath, options.sourceUrl);
  const description = stringValue(frontmatter?.description);

  return applyContextFacets(DocPageSchema.parse({
    id: pageId,
    sourceType,
    sourceUrl: options.sourceUrl,
    canonicalUrl: options.canonicalUrl,
    repoPath,
    title,
    description,
    markdown: normalizedMarkdown,
    headings,
    links,
    codeBlocks: codeBlocks.map((block, sourceOrder) => ({ ...block, sourceOrder })),
    frontmatter,
    contentHash,
    discoveredAt: DETERMINISTIC_DISCOVERY_TIME,
    versionHints: [],
    facets: [],
    normalization,
  }), {
    ...options.context,
    sourceFormat: options.sourceFormat ?? (format === "mdx" ? "mdx" : "markdown"),
  });
}

function parseMarkdown(markdown: string, format: "markdown" | "mdx"): MarkdownNode {
  const processor = unified().use(remarkParse);
  if (format === "mdx") processor.use(remarkMdx);
  processor.use(remarkFrontmatter, ["yaml"]);
  return processor.parse(markdown) as MarkdownNode;
}

function recoverFencedCodeBlocks(markdown: string, headings: Heading[]): Array<{
  language?: string;
  value: string;
  sourceHeadingId?: string;
  startLine: number;
}> {
  const lines = markdown.split(/\r?\n/);
  const recovered: Array<{
    language?: string;
    value: string;
    sourceHeadingId?: string;
    startLine: number;
  }> = [];
  let opening: { marker: string; indent: number; info: string; startLine: number; body: string[] } | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (opening === undefined) {
      const match = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/.exec(line);
      if (match === null) continue;
      opening = {
        marker: match[2]!,
        indent: match[1]!.length,
        info: match[3]!.trim(),
        startLine: index + 1,
        body: [],
      };
      continue;
    }
    const closing = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(line)?.[2];
    if (closing !== undefined
      && closing[0] === opening.marker[0]
      && closing.length >= opening.marker.length) {
      const sourceHeadingId = [...headings]
        .reverse()
        .find((heading) => (heading.position.startLine ?? Number.MAX_SAFE_INTEGER) <= opening!.startLine)?.id;
      const language = opening.info.split(/\s+/, 1)[0] || undefined;
      recovered.push({
        language,
        value: opening.body.join("\n").replace(/^\n+|\n+$/g, ""),
        sourceHeadingId,
        startLine: opening.startLine,
      });
      opening = undefined;
      continue;
    }
    opening.body.push(line.startsWith(" ".repeat(opening.indent))
      ? line.slice(opening.indent)
      : line);
  }
  return recovered;
}

function normalizeCodeBlockForComparison(value: string): string {
  const lines = value.trim().split(/\r?\n/);
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^ */)?.[0].length ?? 0);
  const commonIndent = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(Math.min(commonIndent, line.length))).join("\n");
}

function sanitizeMdx(markdown: string): {
  markdown: string;
  omittedCharacterRatio: number;
  warnings: string[];
} {
  const lines = markdown.split(/\r?\n/);
  let fence: string | undefined;
  let inJsxTag = false;
  let omitted = 0;
  const warnings = new Set<string>();
  const sanitized = lines.map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence === undefined && fenceMatch !== null) {
      fence = fenceMatch[1]!;
      return line;
    }
    if (fence !== undefined) {
      if (isClosingFence(fence, line)) fence = undefined;
      return line;
    }
    if (/^\s*(?:import|export)\b/.test(line)) {
      omitted += line.length;
      warnings.add("Omitted top-level MDX import/export declarations.");
      return "<!-- AgentDocs omitted MDX import/export -->";
    }
    if (inJsxTag) {
      omitted += line.length;
      warnings.add("Omitted MDX JSX tags outside fenced code.");
      if (line.includes(">")) {
        inJsxTag = false;
      }
      return "<!-- AgentDocs omitted MDX JSX tag -->";
    }
    if (isMultilineJsxTagStart(line)) {
      omitted += line.length;
      warnings.add("Omitted MDX JSX tags outside fenced code.");
      inJsxTag = true;
      return "<!-- AgentDocs omitted MDX JSX tag -->";
    }
    let value = line.replace(/<\/?[A-Za-z][^>]*>/g, (match) => {
      omitted += match.length;
      warnings.add("Omitted MDX JSX tags outside fenced code.");
      return "<!-- AgentDocs omitted MDX JSX tag -->";
    });
    value = value.replace(/\{[^}]*\}|\{.*$/g, (match) => {
      omitted += match.length;
      warnings.add("Omitted MDX brace expressions outside fenced code.");
      return "<!-- AgentDocs omitted MDX expression -->";
    });
    return value;
  });
  return {
    markdown: sanitized.join("\n"),
    omittedCharacterRatio: markdown.length === 0 ? 0 : omitted / markdown.length,
    warnings: [...warnings].sort(compareStrings),
  };
}

function isClosingFence(openingFence: string, line: string): boolean {
  const closingFence = line.match(/^\s*(`{3,}|~{3,})\s*$/)?.[1];
  return closingFence !== undefined
    && closingFence[0] === openingFence[0]
    && closingFence.length >= openingFence.length;
}

function isMultilineJsxTagStart(line: string): boolean {
  const trimmed = line.trim();
  return /^<\/?[A-Za-z][\w.:-]*(?:\s|$)/.test(trimmed) && !trimmed.includes(">");
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").trim();
}

function visit(node: MarkdownNode, visitor: (node: MarkdownNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visit(child, visitor);
  }
}

function nodeText(node: MarkdownNode): string {
  if (node.type === "code" || node.type === "inlineCode" || node.type === "text") {
    return node.value ?? "";
  }
  return (node.children ?? []).map(nodeText).join("");
}

function parseFrontmatter(tree: MarkdownNode): Record<string, unknown> | undefined {
  const yamlNode = tree.children?.find((node) => node.type === "yaml");
  if (yamlNode?.value === undefined) {
    return undefined;
  }
  const value: unknown = parseYaml(yamlNode.value);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function resolveHref(
  repoPath: string | undefined,
  sourceUrl: string | undefined,
  href: string,
): string | undefined {
  if (classifyLink(href, sourceUrl) !== "internal") {
    return undefined;
  }
  if (sourceUrl !== undefined) {
    return new URL(href, sourceUrl).href;
  }
  if (repoPath === undefined) {
    return undefined;
  }
  const [target, fragment] = href.split("#", 2);
  const resolved = target?.startsWith("/")
    ? path.posix.normalize(target.replace(/^\/+/, ""))
    : path.posix.normalize(
      path.posix.join(path.posix.dirname(repoPath), target ?? ""),
    );
  return fragment === undefined ? resolved : `${resolved}#${fragment}`;
}

function classifyLink(href: string, sourceUrl?: string): Link["kind"] {
  if (href.startsWith("#")) {
    return "anchor";
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
    if (sourceUrl !== undefined) {
      try {
        return new URL(href, sourceUrl).origin === new URL(sourceUrl).origin
          ? "internal"
          : "external";
      } catch {
        return "unknown";
      }
    }
    return "external";
  }
  if (ASSET_EXTENSIONS.has(path.posix.extname(href.split(/[?#]/, 1)[0] ?? "").toLowerCase())) {
    return "asset";
  }
  if (href.length > 0) {
    return "internal";
  }
  return "unknown";
}

function fallbackTitle(repoPath?: string, sourceUrl?: string): string {
  if (repoPath !== undefined) {
    return path.posix.basename(repoPath, path.posix.extname(repoPath));
  }
  if (sourceUrl !== undefined) {
    const url = new URL(sourceUrl);
    return path.posix.basename(url.pathname) || url.hostname;
  }
  return "Untitled";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

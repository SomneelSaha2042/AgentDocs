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
  repoPath?: string;
  sourceType?: "local_markdown" | "website";
  sourceUrl?: string;
  canonicalUrl?: string;
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
  const contentHash = hash(options.markdown);
  const stableSource = options.canonicalUrl ?? options.sourceUrl ?? repoPath;
  if (stableSource === undefined) {
    throw new Error("A repoPath, sourceUrl, or canonicalUrl is required.");
  }
  const pageId = `page_${hash(`${stableSource}:${contentHash}`).slice(0, 16)}`;
  const tree = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkFrontmatter, ["yaml"])
    .parse(options.markdown) as MarkdownNode;

  const frontmatter = parseFrontmatter(tree);
  const headings: Heading[] = [];
  const links: Link[] = [];
  const codeBlocks: CodeBlock[] = [];
  let currentHeadingId: string | undefined;

  visit(tree, (node) => {
    if (node.type === "heading") {
      const text = nodeText(node).trim();
      const slug = slugify(text);
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
        sourceHeadingId: currentHeadingId,
      });
      return;
    }

    if (node.type === "code") {
      const value = node.value ?? "";
      codeBlocks.push({
        id: `code_${hash(`${pageId}:${codeBlocks.length}:${value}`).slice(0, 16)}`,
        language: node.lang ?? undefined,
        value,
        sourceHeadingId: currentHeadingId,
      });
    }
  });

  const title =
    stringValue(frontmatter?.title) ??
    headings.find((heading) => heading.depth === 1)?.text ??
    fallbackTitle(repoPath, options.sourceUrl);
  const description = stringValue(frontmatter?.description);

  return DocPageSchema.parse({
    id: pageId,
    sourceType,
    sourceUrl: options.sourceUrl,
    canonicalUrl: options.canonicalUrl,
    repoPath,
    title,
    description,
    markdown: options.markdown,
    headings,
    links,
    codeBlocks,
    frontmatter,
    contentHash,
    discoveredAt: DETERMINISTIC_DISCOVERY_TIME,
    versionHints: [],
  });
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
  const resolved = path.posix.normalize(
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

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

import { normalizeMarkdown, type NormalizeMarkdownOptions } from "./markdown.js";

export type NormalizeAsciiDocOptions = Omit<NormalizeMarkdownOptions, "markdown" | "format" | "sourceFormat"> & {
  asciidoc: string;
  sourceFormat?: "adoc" | "asciidoc";
};

const ADMONITION_TYPES = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);
const LISTING_DELIMITER = "----";
const LITERAL_DELIMITER = "....";
const EXAMPLE_DELIMITER = "====";
const BLOCKQUOTE_DELIMITER = "____";

type PendingBlock = {
  kind: "code" | "literal" | "example" | "blockquote";
  lang?: string;
  admonition?: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";
  lines: string[];
};

export function normalizeAsciiDoc(
  options: NormalizeAsciiDocOptions,
): ReturnType<typeof normalizeMarkdown> {
  const { asciidoc, sourceFormat, ...markdownOptions } = options;
  const markdown = convertAsciiDocToMarkdown(asciidoc);
  const page = normalizeMarkdown({
    ...markdownOptions,
    markdown,
    sourceFormat: sourceFormat ?? "adoc",
  });
  return {
    ...page,
    normalization: { mode: "asciidoc", warnings: page.normalization.warnings },
  };
}

export function convertAsciiDocToMarkdown(asciidoc: string): string {
  const lines = asciidoc.split(/\r?\n/);
  const output: string[] = [];
  let pendingAttribute: { lang?: string; admonition?: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION" } = {};
  let block: PendingBlock | undefined;
  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();
    if (block !== undefined) {
      if (trimmed === blockDelimiter(block.kind)) {
        flushBlock(output, block);
        block = undefined;
      } else {
        block.lines.push(line);
      }
      continue;
    }
    if (trimmed === "") {
      output.push("");
      continue;
    }
    if (trimmed.startsWith("//") && !trimmed.startsWith("///")) {
      continue;
    }
    if (trimmed.startsWith("[")) {
      const attribute = parseBlockAttribute(trimmed);
      if (attribute !== undefined) {
        pendingAttribute = attribute;
        continue;
      }
    }
    if (trimmed === LISTING_DELIMITER) {
      block = { kind: "code", lang: pendingAttribute.lang, admonition: pendingAttribute.admonition, lines: [] };
      pendingAttribute = {};
      continue;
    }
    if (trimmed === LITERAL_DELIMITER) {
      block = { kind: "literal", lang: pendingAttribute.lang, lines: [] };
      pendingAttribute = {};
      continue;
    }
    if (trimmed === EXAMPLE_DELIMITER) {
      block = { kind: "example", admonition: pendingAttribute.admonition, lines: [] };
      pendingAttribute = {};
      continue;
    }
    if (trimmed === BLOCKQUOTE_DELIMITER) {
      block = { kind: "blockquote", lines: [] };
      pendingAttribute = {};
      continue;
    }
    const heading = matchHeading(trimmed);
    if (heading !== undefined) {
      output.push(`${"#".repeat(heading.depth)} ${heading.text}`);
      continue;
    }
    const admonition = matchInlineAdmonition(trimmed);
    if (admonition !== undefined) {
      output.push(`> [!${admonition.type}]`);
      output.push(`> ${admonition.text}`.trimEnd());
      continue;
    }
    if (/^include::[^[]+\[\]\s*$/.test(trimmed)) continue;
    if (/^:!?[\w-]+:/.test(trimmed)) continue;
    output.push(inlineAsciiDoc(line));
  }
  if (block !== undefined) flushBlock(output, block);
  return `${output.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function parseBlockAttribute(value: string): { lang?: string; admonition?: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION" } | undefined {
  const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (inner === "") return undefined;
  const first = inner.split(/[,;]\s*/, 1)[0]!.trim().toUpperCase();
  if (ADMONITION_TYPES.has(first)) {
    return { admonition: first as "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION" };
  }
  const sourceMatch = inner.match(/^source\s*[,;]\s*([^\s,;]+)/i);
  if (sourceMatch !== null) return { lang: sourceMatch[1] };
  if (/^source$/i.test(first)) return { lang: undefined };
  return undefined;
}

function blockDelimiter(kind: PendingBlock["kind"]): string {
  switch (kind) {
    case "code": return LISTING_DELIMITER;
    case "literal": return LITERAL_DELIMITER;
    case "example": return EXAMPLE_DELIMITER;
    case "blockquote": return BLOCKQUOTE_DELIMITER;
  }
}

function flushBlock(output: string[], block: PendingBlock): void {
  const content = block.lines;
  if (block.kind === "code" || block.kind === "literal") {
    output.push(`\`\`\`${block.lang ?? ""}`);
    output.push(...content);
    output.push("```");
    return;
  }
  if (block.kind === "example" && block.admonition !== undefined) {
    output.push(`> [!${block.admonition}]`);
    for (const line of content) output.push(`> ${inlineAsciiDoc(line)}`.trimEnd());
    return;
  }
  if (block.kind === "blockquote") {
    for (const line of content) output.push(`> ${inlineAsciiDoc(line)}`.trimEnd());
    return;
  }
  for (const line of content) output.push(inlineAsciiDoc(line));
}

function matchHeading(value: string): { depth: number; text: string } | undefined {
  const match = value.match(/^(=+)\s+(.+?)\s*$/);
  if (match === null) return undefined;
  const depth = Math.min(match[1]!.length, 6);
  return { depth, text: match[2]!.trim() };
}

function matchInlineAdmonition(value: string): { type: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION"; text: string } | undefined {
  const match = value.match(/^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\s*(.*)$/i);
  if (match === null) return undefined;
  const type = match[1]!.toUpperCase() as "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";
  return { type, text: match[2] ?? "" };
}

function inlineAsciiDoc(line: string): string {
  let value = line;
  value = value.replace(/\blink:([^[]+)\[([^\]]*)\]/g, (_match, target: string, text: string) => {
    const label = text.trim().length === 0 ? target.trim() : text.trim();
    return `[${label}](${target.trim()})`;
  });
  value = value.replace(/\bxref:([^[]+)\[([^\]]*)\]/g, (_match, target: string, text: string) => {
    const cleanTarget = target.split("#", 1)[0]!.replace(/\.adoc$/, "");
    const label = text.trim().length === 0 ? cleanTarget : text.trim();
    return `[${label}](${cleanTarget})`;
  });
  value = value.replace(/\bmailto:([^[]+)\[([^\]]*)\]/g, (_match, address: string, text: string) => {
    const label = text.trim().length === 0 ? address.trim() : text.trim();
    return `[${label}](mailto:${address.trim()})`;
  });
  value = value.replace(/`([^`]+)`/g, (_match, code: string) => `\`${code}\``);
  value = value.replace(/\+([^+\s][^+]*?)\+/g, (_match, code: string) => `\`${code}\``);
  return value;
}

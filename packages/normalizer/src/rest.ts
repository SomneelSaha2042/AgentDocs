import { normalizeMarkdown, type NormalizeMarkdownOptions } from "./markdown.js";

export type NormalizeRestOptions = Omit<NormalizeMarkdownOptions, "markdown" | "format" | "sourceFormat"> & {
  rest: string;
  sourceFormat?: "rst" | "restText";
};

const SECTION_CHARS = "=-~`'\"^_*+#<>:";
const SECTION_CHAR_SET = new Set(SECTION_CHARS);
const ADMONITION_DIRECTIVES = new Set([
  "note",
  "tip",
  "hint",
  "warning",
  "caution",
  "danger",
  "error",
  "important",
]);
const CODE_DIRECTIVES = new Set([
  "code-block",
  "code",
  "sourcecode",
  "source-code",
  "highlight",
]);
const IGNORED_DIRECTIVES = new Set([
  "include",
  "toctree",
  "autoclass",
  "autofunction",
  "automethod",
  "automodule",
  "autoclass",
  "autosummary",
  "currentmodule",
  "module",
  "seealso",
  "rubric",
  "centered",
  "comment",
  "meta",
  "default-role",
  "highlightlang",
  "literalinclude",
]);

type Line = { text: string; number: number };

export function normalizeRest(options: NormalizeRestOptions): ReturnType<typeof normalizeMarkdown> {
  const { rest, sourceFormat, ...markdownOptions } = options;
  const markdown = convertRestToMarkdown(rest);
  const page = normalizeMarkdown({
    ...markdownOptions,
    markdown,
    sourceFormat: sourceFormat ?? "rst",
  });
  return {
    ...page,
    normalization: { mode: "rest", warnings: page.normalization.warnings },
  };
}

export function convertRestToMarkdown(rest: string): string {
  const lines = splitLines(rest);
  const output: string[] = [];
  const sectionDepths = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const text = line.text;
    if (text.trim() === "") {
      output.push("");
      i += 1;
      continue;
    }
    const directive = matchDirective(text);
    if (directive !== undefined) {
      const { name, arg } = directive;
      const { body, consumed } = collectIndentedBlock(lines, i + 1);
      emitDirective(output, name, arg, body);
      i += 1 + consumed;
      continue;
    }
    const overline = sectionUnderline(text);
    if (overline !== undefined && i + 2 < lines.length) {
      const title = lines[i + 1]!.text.trim();
      const underline = sectionUnderline(lines[i + 2]!.text);
      if (title.length > 0 && underline === overline && underline.length >= title.length) {
        output.push(`${headingPrefix(overline, sectionDepths)} ${title}`);
        i += 3;
        continue;
      }
    }
    const underlineNext = i + 1 < lines.length ? sectionUnderline(lines[i + 1]!.text) : undefined;
    if (underlineNext !== undefined && underlineNext.length >= text.trim().length && underlineNext.length >= 3) {
      const title = text.trim();
      output.push(`${headingPrefix(underlineNext, sectionDepths)} ${title}`);
      i += 2;
      continue;
    }
    if (text.trim() === "::") {
      const { body, consumed } = collectIndentedBlock(lines, i + 1);
      if (body.length > 0) {
        output.push("```");
        output.push(...body);
        output.push("```");
      }
      i += 1 + consumed;
      continue;
    }
    if (text.trimEnd().endsWith("::")) {
      const trigger = text.replace(/::\s*$/, ":");
      output.push(trigger);
      const { body, consumed } = collectIndentedBlock(lines, i + 1);
      if (body.length > 0) {
        output.push("```");
        output.push(...body);
        output.push("```");
      }
      i += 1 + consumed;
      continue;
    }
    output.push(inlineRest(text));
    i += 1;
  }
  return `${output.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function matchDirective(text: string): { name: string; arg: string } | undefined {
  const match = text.match(/^\.\.\s+([a-zA-Z][a-zA-Z0-9_-]*)::(.*)$/);
  if (match === null) return undefined;
  return { name: match[1]!.toLowerCase(), arg: (match[2] ?? "").trim() };
}

function collectIndentedBlock(lines: Line[], start: number): { body: string[]; consumed: number } {
  const body: string[] = [];
  let index = start;
  let indent = -1;
  while (index < lines.length) {
    const current = lines[index]!.text;
    if (current.trim() === "") {
      body.push("");
      index += 1;
      continue;
    }
    const leading = countLeadingSpaces(current);
    if (indent === -1) {
      if (leading === 0) break;
      indent = leading;
    }
    if (leading < indent) break;
    body.push(current.slice(indent));
    index += 1;
  }
  while (body.length > 0 && body[body.length - 1] === "") body.pop();
  return { body, consumed: index - start };
}

function countLeadingSpaces(value: string): number {
  return value.length - value.trimStart().length;
}

function sectionUnderline(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length < 3) return undefined;
  if (![...trimmed].every((char) => SECTION_CHAR_SET.has(char))) return undefined;
  return trimmed;
}

function headingPrefix(underline: string, depths: Map<string, number>): string {
  const char = underline[0]!;
  let depth = depths.get(char);
  if (depth === undefined) {
    depth = depths.size + 1;
    if (depth > 6) depth = 6;
    depths.set(char, depth);
  }
  return "#".repeat(depth);
}

function emitDirective(output: string[], name: string, arg: string, body: string[]): void {
  if (CODE_DIRECTIVES.has(name)) {
    const lang = arg.split(/\s+/, 1)[0] ?? "";
    const content = stripDirectiveOptions(body);
    output.push(`\`\`\`${lang}`);
    output.push(...content);
    output.push("```");
    return;
  }
  if (ADMONITION_DIRECTIVES.has(name)) {
    const label = admonitionLabel(name);
    const content = stripDirectiveOptions(body).map(inlineRest);
    output.push(`> [!${label}]`);
    for (const line of content) output.push(`> ${line}`.trimEnd());
    return;
  }
  if (name === "versionadded" || name === "versionchanged") {
    const version = normalizeVersion(arg);
    const label = name === "versionadded" ? "Added in" : "Changed in";
    const content = stripDirectiveOptions(body).map(inlineRest).join(" ").trim();
    output.push(`> **${label}${version === "" ? "" : ` ${version}`}:** ${content}`);
    return;
  }
  if (name === "deprecated") {
    const version = normalizeVersion(arg);
    const content = stripDirectiveOptions(body).map(inlineRest).join(" ").trim();
    output.push(`> **Deprecated since${version === "" ? "" : ` ${version}`}:** ${content}`);
    return;
  }
  if (IGNORED_DIRECTIVES.has(name)) return;
}

function admonitionLabel(name: string): "NOTE" | "WARNING" | "IMPORTANT" | "CAUTION" {
  if (name === "warning" || name === "caution" || name === "danger" || name === "error") return "WARNING";
  if (name === "important") return "IMPORTANT";
  return "NOTE";
}

function stripDirectiveOptions(body: string[]): string[] {
  return body.filter((line) => !/^\s*:[a-z][a-z0-9_-]*:\s*$/i.test(line));
}

function normalizeVersion(arg: string): string {
  const match = arg.match(/\b(v?\d+(?:\.\d+){0,2})\b/i);
  if (match === null) return "";
  const version = match[1]!;
  return /^v/i.test(version) ? version : `v${version}`;
}

function inlineRest(line: string): string {
  let value = line;
  value = value.replace(/`([^`<]+?)\s+<([^>`]+)>`__?/g, (_, text: string, url: string) => `[${text.trim()}](${url})`);
  value = value.replace(/`([^`]+)`__/g, (_match, text: string) => text);
  value = value.replace(/`([^`]+)`_/g, (_match, text: string) => text);
  value = value.replace(/:(?:([a-z]+):)?([a-z]+):`([^`]+)`/gi, (_match, _domain: string | undefined, role: string, target: string) => {
    const visible = target.includes(" <") ? target.split(/\s+<[^>]*>$/, 1)[0]! : target;
    if (role === "doc") return `[${visible}](${visible})`;
    return visible;
  });
  value = value.replace(/``([^`]+)``/g, (_match, code: string) => `\`${code}\``);
  return value;
}

function splitLines(value: string): Line[] {
  return value.split(/\r?\n/).map((text, index) => ({ text, number: index + 1 }));
}

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Bounded, deterministic transclusion resolver for reST ``.. include::`` and
 * AsciiDoc ``include::`` directives.
 *
 * Safety contract (the erasure rule — never drop relevant context at any cost,
 * but never expand content we are not 100% sure is safe):
 *  - Targets are resolved against the source file's directory (leading ``/`` is
 *    stripped; Sphinx-rooted targets resolve back into the configured source
 *    root via ``../`` traversal which the containment check still permits).
 *  - The resolved path MUST stay inside the configured source root. Anything
 *    escaping it (``/etc/passwd``, repo-parent traversal) is rejected and left
 *    as a directive so the normalizer drops it and the page is classified.
 *  - Only targets in the same format family as the shell are resolved, so the
 *    spliced content is parseable by the shell's normalizer.
 *  - Cycle detection (per-resolution chain) and a depth cap prevent loops.
 *  - Nothing is executed; only file text is read and spliced.
 *
 * Unresolved directives are LEFT IN PLACE (the normalizer ignores ``include``),
 * and surfaced via {@link IncludeResolution.unresolved} so the caller can mark
 * the page with an actionable skip reason instead of silently losing it.
 */

const MAX_INCLUDE_DEPTH = 8;

const REST_INCLUDE = /^\.\.\s+include::\s*(\S.*?)\s*$/;
const ADOC_INCLUDE = /^include::([^[|\s]+)(?:\[[^\]]*\])?\s*$/;

const REST_EXTS = new Set([".rst", ".txt"]);
const ADOC_EXTS = new Set([".adoc", ".asciidoc"]);

export type IncludeUnresolvedReason =
  | "missing"
  | "out-of-scope"
  | "cycle"
  | "depth"
  | "unsupported-format"
  | "antora-id";

export type IncludeUnresolved = {
  target: string;
  reason: IncludeUnresolvedReason;
};

export type IncludeResolution = {
  content: string;
  resolvedTargets: string[];
  unresolved: IncludeUnresolved[];
};

export type ResolveIncludesOptions = {
  content: string;
  filePath: string;
  sourceRoot: string;
  format: "rst" | "restText" | "adoc" | "asciidoc";
};

export async function resolveIncludes(
  options: ResolveIncludesOptions,
): Promise<IncludeResolution> {
  const family = options.format === "adoc" || options.format === "asciidoc" ? "adoc" : "rest";
  const resolvedTargets: string[] = [];
  const unresolved: IncludeUnresolved[] = [];
  const chain = new Set<string>();
  const content = await resolveText(
    options.content,
    options.filePath,
    options.sourceRoot,
    family,
    chain,
    0,
    resolvedTargets,
    unresolved,
  );
  return { content, resolvedTargets, unresolved };
}

async function resolveText(
  content: string,
  filePath: string,
  sourceRoot: string,
  family: "rest" | "adoc",
  chain: Set<string>,
  depth: number,
  resolvedTargets: string[],
  unresolved: IncludeUnresolved[],
): Promise<string> {
  if (depth >= MAX_INCLUDE_DEPTH) return content;
  const dir = path.dirname(filePath);
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const match = family === "rest" ? line.match(REST_INCLUDE) : line.match(ADOC_INCLUDE);
    if (match === null) {
      out.push(line);
      continue;
    }
    const rawTarget = (match[1] ?? "").trim();
    if (rawTarget === "") {
      out.push(line);
      continue;
    }
    // Antora resource ids (``partial$foo``) are not filesystem paths; skip them.
    if (family === "adoc" && (rawTarget.includes("$") || rawTarget.includes(":"))) {
      unresolved.push({ target: rawTarget, reason: "antora-id" });
      // Leave the directive so the AsciiDoc normalizer can drop it; content is
      // not silently lost because the pointer remains for classification.
      out.push(line);
      continue;
    }
    const target = rawTarget.replace(/^\//, "");
    const candidate = path.resolve(dir, target);
    const reason = resolveGuard(candidate, sourceRoot, family, chain);
    if (reason !== undefined) {
      unresolved.push({ target: rawTarget, reason });
      out.push(line);
      continue;
    }
    chain.add(candidate);
    let included = "";
    try {
      included = await readFile(candidate, "utf8");
    } catch {
      chain.delete(candidate);
      unresolved.push({ target: rawTarget, reason: "missing" });
      out.push(line);
      continue;
    }
    const rel = path.relative(sourceRoot, candidate).replace(/\\/g, "/");
    resolvedTargets.push(rel);
    const nested = await resolveText(
      included,
      candidate,
      sourceRoot,
      family,
      chain,
      depth + 1,
      resolvedTargets,
      unresolved,
    );
    chain.delete(candidate);
    // Splice with blank-line guards so headings/code upstream/downstream don't fuse.
    out.push("");
    out.push(...nested.split(/\r?\n/));
    out.push("");
  }
  return out.join("\n");
}

function resolveGuard(
  candidate: string,
  sourceRoot: string,
  family: "rest" | "adoc",
  chain: Set<string>,
): IncludeUnresolvedReason | undefined {
  if (chain.has(candidate)) return "cycle";
  const rel = path.relative(sourceRoot, candidate);
  if (rel === "") return undefined; // candidate is the root itself; unusual but safe
  if (rel.startsWith("..") || path.isAbsolute(rel)) return "out-of-scope";
  const ext = path.extname(candidate).toLowerCase();
  const allowed = family === "rest" ? REST_EXTS : ADOC_EXTS;
  if (!allowed.has(ext)) return "unsupported-format";
  return undefined;
}
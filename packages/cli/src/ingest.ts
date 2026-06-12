import { createHash } from "node:crypto";
import { readFile, readdir, stat, unlink, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { normalizeMarkdown } from "@agentdocs/normalizer";
import {
  DocPageSchema,
  IngestManifestSchema,
  type DocPage,
  type IngestManifest,
} from "@agentdocs/shared";
import { minimatch } from "minimatch";

export type IngestOptions = {
  cwd: string;
  out: string;
  preserveSourcePath?: boolean;
  source: string;
  include?: string[];
  exclude?: string[];
  facets?: Record<string, string>;
  contextRules?: Array<{ match: string; facets: Record<string, string> }>;
  mdxMode?: "tolerant" | "strict";
  sourceType?: "local_markdown" | "repo";
};

export type IngestResult = {
  manifest: IngestManifest;
  manifestPath: string;
  pages: DocPage[];
};

export class IngestError extends Error {
  override readonly name = "IngestError";
}

export async function ingestLocalMarkdown(
  options: IngestOptions,
): Promise<IngestResult> {
  const sourcePath = path.resolve(options.cwd, options.source);
  const outputRoot = path.resolve(options.cwd, options.out);
  const sourceIdentity = isWithin(options.cwd, sourcePath)
    ? toPosixPath(path.relative(options.cwd, sourcePath) || ".")
    : toPosixPath(sourcePath);
  const pagesDirectory = path.join(outputRoot, "sources", "pages");
  const manifestPath = path.join(outputRoot, "sources", "ingest-manifest.json");
  const stateManifestPath = path.join(
    outputRoot,
    "sources",
    "state",
    `ingest-${hash(sourceIdentity)}.json`,
  );
  const sourceStats = await statSource(sourcePath);
  const files = (await discoverMarkdownFiles(sourcePath, outputRoot)).filter((filePath) => {
    const relative = toPosixPath(path.relative(
      sourceStats.isDirectory() ? sourcePath : path.dirname(sourcePath),
      filePath,
    ));
    return matchesFilters(relative, options.include, options.exclude);
  });

  if (files.length === 0) {
    throw new IngestError(
      `No Markdown or MDX files found at ${options.source}.`,
    );
  }

  const pages: DocPage[] = [];
  const diagnostics: IngestManifest["diagnostics"] = [];
  for (const filePath of files) {
    const markdown = await readFile(filePath, "utf8");
    const sourceRelativePath = sourceStats.isDirectory()
      ? path.relative(sourcePath, filePath)
      : path.basename(filePath);
    const configuredSourcePath = toPosixPath(path.normalize(options.source))
      .replace(/^\.\//, "");
    const canPreserveSourcePath = options.preserveSourcePath === true
      && configuredSourcePath !== ".."
      && !configuredSourcePath.startsWith("../")
      && !path.isAbsolute(configuredSourcePath);
    const repoPath = canPreserveSourcePath
      ? sourceStats.isDirectory()
        ? path.join(configuredSourcePath, sourceRelativePath)
        : configuredSourcePath
      : sourceRelativePath;
    try {
      const page = normalizeMarkdown({
        markdown,
        format: path.extname(filePath).toLowerCase() === ".mdx" ? "mdx" : "markdown",
        repoPath,
        context: { fixed: options.facets, rules: options.contextRules },
        mdxMode: options.mdxMode ?? "tolerant",
        sourceType: options.sourceType ?? "local_markdown",
      });
      if (!hasUsefulPageContent(page)) {
        diagnostics.push({
          repoPath: toPosixPath(repoPath),
          status: "skipped",
          mode: page.normalization.mode === "mdx-fallback" ? "mdx-fallback" : "strict",
          warnings: page.normalization.warnings,
          message: "No useful prose, headings, or fenced code remained after normalization.",
        });
        continue;
      }
      pages.push(page);
      diagnostics.push({
        repoPath: toPosixPath(repoPath),
        status: page.normalization.mode === "mdx-fallback" ? "degraded" : "usable",
        mode: page.normalization.mode === "mdx-fallback" ? "mdx-fallback" : "strict",
        warnings: page.normalization.warnings,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.mdxMode === "strict") {
        throw new IngestError(`Failed to ingest ${toPosixPath(repoPath)} in strict MDX mode: ${message}`);
      }
      diagnostics.push({
        repoPath: toPosixPath(repoPath),
        status: "failed",
        warnings: [],
        message,
      });
    }
  }

  pages.sort((left, right) => compareStrings(left.repoPath!, right.repoPath!));
  const validatedPages = pages.map((page) => DocPageSchema.parse(page));
  const manifestPages: IngestManifest["pages"] = validatedPages.map((page) => {
    const outputPath = path.posix.join("sources", "pages", `${page.id}.json`);
    return {
      id: page.id,
      repoPath: page.repoPath!,
      outputPath,
      contentHash: page.contentHash,
    };
  });

  const manifest = IngestManifestSchema.parse({
    schemaVersion: 1,
    sourceType: options.sourceType ?? "local_markdown",
    sourcePath: sourceIdentity,
    pageCount: pages.length,
    counts: {
      usable: diagnostics.filter((item) => item.status === "usable").length,
      degraded: diagnostics.filter((item) => item.status === "degraded").length,
      skipped: diagnostics.filter((item) => item.status === "skipped").length,
      failed: diagnostics.filter((item) => item.status === "failed").length,
    },
    diagnostics,
    pages: manifestPages,
  });

  await mkdir(pagesDirectory, { recursive: true });
  await mkdir(path.dirname(stateManifestPath), { recursive: true });
  await removeStaleIngestPages(stateManifestPath, outputRoot, new Set(manifestPages.map((page) => page.outputPath)));
  for (const [index, page] of validatedPages.entries()) {
    await writeJson(
      path.join(outputRoot, ...manifestPages[index]!.outputPath.split("/")),
      page,
    );
  }
  await writeJson(manifestPath, manifest);
  await writeJson(stateManifestPath, manifest);

  if (validatedPages.length === 0) {
    throw new IngestError(
      `No useful Markdown or MDX pages remained after normalization. Diagnostics were written to ${manifestPath}.`,
    );
  }

  return { manifest, manifestPath, pages: validatedPages };
}

function hasUsefulPageContent(page: DocPage): boolean {
  if (page.headings.some((heading) => heading.text.trim().length > 0)) return true;
  if (page.codeBlocks.some((block) => block.value.trim().length > 0)) return true;
  return page.markdown
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/<!-- AgentDocs omitted MDX [^>]+ -->/g, "")
    .replace(/[#>*_`~[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .length >= 24;
}

async function statSource(sourcePath: string) {
  try {
    return await stat(sourcePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new IngestError(`Source path not found: ${sourcePath}`);
    }
    throw error;
  }
}

function matchesFilters(
  relativePath: string,
  include?: string[],
  exclude?: string[],
): boolean {
  const included = include === undefined || include.length === 0
    || include.some((pattern) => minimatch(relativePath, pattern));
  const excluded = exclude?.some((pattern) => minimatch(relativePath, pattern)) ?? false;
  return included && !excluded;
}

async function discoverMarkdownFiles(
  sourcePath: string,
  excludedDirectory?: string,
): Promise<string[]> {
  if (excludedDirectory !== undefined && isWithin(excludedDirectory, sourcePath)) {
    return [];
  }
  let sourceStats;
  try {
    sourceStats = await stat(sourcePath);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new IngestError(`Source path not found: ${sourcePath}`);
    }
    throw error;
  }

  if (sourceStats.isFile()) {
    if (!isMarkdownFile(sourcePath)) {
      throw new IngestError(`Unsupported input file: ${sourcePath}`);
    }
    return [sourcePath];
  }

  if (!sourceStats.isDirectory()) {
    throw new IngestError(`Source path is not a file or directory: ${sourcePath}`);
  }

  const files: string[] = [];
  for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
    const entryPath = path.join(sourcePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await discoverMarkdownFiles(entryPath, excludedDirectory)));
    } else if (entry.isFile() && isMarkdownFile(entryPath)) {
      files.push(entryPath);
    }
  }
  return files.sort(compareStrings);
}

async function removeStaleIngestPages(
  manifestPath: string,
  outputRoot: string,
  currentPaths: Set<string>,
): Promise<void> {
  let previous: IngestManifest;
  try {
    previous = IngestManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8")),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new IngestError(`Invalid previous ingest manifest at ${manifestPath}: ${message}`);
  }
  for (const page of previous.pages.filter((item) => !currentPaths.has(item.outputPath))) {
    await removeOutputFile(outputRoot, page.outputPath);
  }
}

async function removeOutputFile(outputRoot: string, relativePath: string): Promise<void> {
  const destination = path.resolve(outputRoot, ...relativePath.split("/"));
  if (!isWithin(outputRoot, destination) || destination === outputRoot) {
    throw new IngestError(`Refusing to remove file outside output directory: ${destination}`);
  }
  try {
    await unlink(destination);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isMarkdownFile(filePath: string): boolean {
  return [".md", ".mdx"].includes(path.extname(filePath).toLowerCase());
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

import { createHash } from "node:crypto";
import { readFile, readdir, stat, unlink, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { normalizeMarkdown } from "@agentdocs/normalizer";
import {
  DocPageSchema,
  IngestManifestSchema,
  type DocPage,
  type IngestManifest,
  type SourceCoverage,
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

type SourceFileFormat = "markdown" | "mdx" | "rst" | "restText" | "adoc" | "asciidoc";

type SourceFile = {
  filePath: string;
  format: SourceFileFormat;
  supported: boolean;
};

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
  const sourceRoot = sourceStats.isDirectory() ? sourcePath : path.dirname(sourcePath);
  const scopedSourceFiles = await discoverSourceFiles(
    sourcePath,
    outputRoot,
    sourceRoot,
    options.include,
    options.exclude,
  );
  const files = scopedSourceFiles
    .filter((file) => file.supported)
    .map((file) => file.filePath);

  if (files.length === 0) {
    const manifest = await writeEmptyIngestManifest({
      counts: { usable: 0, degraded: 0, skipped: 0, failed: 0 },
      manifestPath,
      outputRoot,
      sourceCoverage: createSourceCoverage(scopedSourceFiles, {
        usable: 0,
        degraded: 0,
        skipped: 0,
        failed: 0,
      }),
      sourceIdentity,
      sourceType: options.sourceType ?? "local_markdown",
      stateManifestPath,
    });
    throw new IngestError(
      manifest.sourceCoverage.unsupportedFiles > 0
        ? `No supported Markdown or MDX files found at ${options.source}. Found ${manifest.sourceCoverage.unsupportedFiles} unsupported docs-like file(s); coverage diagnostics were written to ${manifestPath}.`
        : `No Markdown or MDX files found at ${options.source}.`,
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
    sourceCoverage: createSourceCoverage(scopedSourceFiles, {
      usable: diagnostics.filter((item) => item.status === "usable").length,
      degraded: diagnostics.filter((item) => item.status === "degraded").length,
      skipped: diagnostics.filter((item) => item.status === "skipped").length,
      failed: diagnostics.filter((item) => item.status === "failed").length,
    }),
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

async function writeEmptyIngestManifest(options: {
  counts: IngestManifest["counts"];
  manifestPath: string;
  outputRoot: string;
  sourceCoverage: SourceCoverage;
  sourceIdentity: string;
  sourceType: IngestManifest["sourceType"];
  stateManifestPath: string;
}): Promise<IngestManifest> {
  const manifest = IngestManifestSchema.parse({
    schemaVersion: 1,
    sourceType: options.sourceType,
    sourcePath: options.sourceIdentity,
    pageCount: 0,
    counts: options.counts,
    sourceCoverage: options.sourceCoverage,
    diagnostics: [],
    pages: [],
  });
  await mkdir(path.dirname(options.manifestPath), { recursive: true });
  await mkdir(path.dirname(options.stateManifestPath), { recursive: true });
  await removeStaleIngestPages(options.stateManifestPath, options.outputRoot, new Set());
  await writeJson(options.manifestPath, manifest);
  await writeJson(options.stateManifestPath, manifest);
  return manifest;
}

function createSourceCoverage(
  files: SourceFile[],
  counts: IngestManifest["counts"],
): SourceCoverage {
  const supportedByFormat = {
    markdown: files.filter((file) => file.format === "markdown").length,
    mdx: files.filter((file) => file.format === "mdx").length,
  };
  const unsupportedByFormat = {
    rst: files.filter((file) => file.format === "rst").length,
    restText: files.filter((file) => file.format === "restText").length,
    adoc: files.filter((file) => file.format === "adoc").length,
    asciidoc: files.filter((file) => file.format === "asciidoc").length,
  };
  const supportedFiles = supportedByFormat.markdown + supportedByFormat.mdx;
  const unsupportedFiles = unsupportedByFormat.rst
    + unsupportedByFormat.restText
    + unsupportedByFormat.adoc
    + unsupportedByFormat.asciidoc;
  const intendedFiles = supportedFiles + unsupportedFiles;
  const compiledFiles = counts.usable + counts.degraded;
  const coverageRatio = intendedFiles === 0 ? 0 : roundRatio(compiledFiles / intendedFiles);
  const hasUnsupportedGap = unsupportedFiles > 0;
  const gapSeverity = hasUnsupportedGap && coverageRatio < 0.5
    ? "fail"
    : hasUnsupportedGap
      ? "warn"
      : compiledFiles < supportedFiles
        ? "warn"
        : "none";
  const gapReason = hasUnsupportedGap ? "unsupported_format" as const : undefined;
  const message = hasUnsupportedGap
    ? `${compiledFiles} of ${intendedFiles} docs-like file(s) compiled; ${unsupportedFiles} unsupported reST/AsciiDoc file(s) were in scope.`
    : `${compiledFiles} of ${intendedFiles} supported Markdown/MDX file(s) compiled.`;

  return {
    supportedFiles,
    unsupportedFiles,
    intendedFiles,
    compiledFiles,
    degradedFiles: counts.degraded,
    skippedFiles: counts.skipped,
    failedFiles: counts.failed,
    coverageRatio,
    supportedByFormat,
    unsupportedByFormat,
    gapSeverity,
    gapReason,
    message,
  };
}

async function discoverSourceFiles(
  sourcePath: string,
  excludedDirectory?: string,
  sourceRoot?: string,
  include?: string[],
  exclude?: string[],
): Promise<SourceFile[]> {
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
    const relative = toPosixPath(path.relative(sourceRoot ?? path.dirname(sourcePath), sourcePath));
    if (!matchesFilters(relative, include, exclude)) {
      return [];
    }
    const classified = await classifySourceFile(sourcePath, sourceRoot ?? path.dirname(sourcePath));
    if (classified === undefined) {
      throw new IngestError(`Unsupported input file: ${sourcePath}`);
    }
    return [classified];
  }

  if (!sourceStats.isDirectory()) {
    throw new IngestError(`Source path is not a file or directory: ${sourcePath}`);
  }

  const files: SourceFile[] = [];
  for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
    const entryPath = path.join(sourcePath, entry.name);
    if (entry.isDirectory()) {
      const relativeDirectory = toPosixPath(path.relative(sourceRoot ?? sourcePath, entryPath));
      if (!couldContainIncludedPath(relativeDirectory, include)
        || isExcludedDirectory(relativeDirectory, exclude)) {
        continue;
      }
      files.push(...(await discoverSourceFiles(entryPath, excludedDirectory, sourceRoot ?? sourcePath, include, exclude)));
    } else if (entry.isFile()) {
      const relative = toPosixPath(path.relative(sourceRoot ?? sourcePath, entryPath));
      if (!matchesFilters(relative, include, exclude)) {
        continue;
      }
      const classified = await classifySourceFile(entryPath, sourceRoot ?? sourcePath);
      if (classified !== undefined) {
        files.push(classified);
      }
    }
  }
  return files.sort((left, right) => compareStrings(left.filePath, right.filePath));
}

function couldContainIncludedPath(relativeDirectory: string, include?: string[]): boolean {
  if (include === undefined || include.length === 0) {
    return true;
  }
  const normalizedDirectory = relativeDirectory === "" ? "" : `${relativeDirectory.replace(/\/+$/, "")}/`;
  return include.some((pattern) => {
    const prefix = literalGlobPrefix(pattern);
    return prefix === ""
      || prefix.startsWith(normalizedDirectory)
      || normalizedDirectory.startsWith(prefix);
  });
}

function literalGlobPrefix(pattern: string): string {
  const normalized = pattern.replaceAll("\\", "/").replace(/^\.\//, "");
  const wildcardIndex = normalized.search(/[*?[{]/);
  const literal = wildcardIndex === -1 ? normalized : normalized.slice(0, wildcardIndex);
  const slashIndex = literal.lastIndexOf("/");
  return slashIndex === -1 ? "" : literal.slice(0, slashIndex + 1);
}

function isExcludedDirectory(relativeDirectory: string, exclude?: string[]): boolean {
  if (exclude === undefined || exclude.length === 0) {
    return false;
  }
  const directory = `${relativeDirectory.replace(/\/+$/, "")}/`;
  return exclude.some((pattern) => minimatch(directory, pattern) || minimatch(relativeDirectory, pattern));
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

async function classifySourceFile(
  filePath: string,
  sourceRoot: string,
): Promise<SourceFile | undefined> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".md") return { filePath, format: "markdown", supported: true };
  if (extension === ".mdx") return { filePath, format: "mdx", supported: true };
  if (extension === ".rst") return { filePath, format: "rst", supported: false };
  if (extension === ".adoc") return { filePath, format: "adoc", supported: false };
  if (extension === ".asciidoc") return { filePath, format: "asciidoc", supported: false };
  if (extension === ".txt" && await isLikelyRestTextFile(filePath, sourceRoot)) {
    return { filePath, format: "restText", supported: false };
  }
  return undefined;
}

async function isLikelyRestTextFile(filePath: string, sourceRoot: string): Promise<boolean> {
  const relative = toPosixPath(path.relative(sourceRoot, filePath)).toLowerCase();
  const pathLooksLikeDocs = relative.split("/").some((part) =>
    ["doc", "docs", "documentation", "sphinx"].includes(part));
  if (pathLooksLikeDocs) {
    return true;
  }
  const text = (await readFile(filePath, "utf8")).slice(0, 16_384);
  return /(?:^|\n)\.\. (?:toctree|note|warning|code-block|versionadded|versionchanged|deprecated)::/m.test(text)
    || /(?:^|\n)[^\n]+\n[=\-~`^#*]{3,}\n/m.test(text)
    || /:[a-z][a-z0-9_-]+:`[^`]+`/i.test(text);
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
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

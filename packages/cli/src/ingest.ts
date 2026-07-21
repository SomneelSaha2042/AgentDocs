import { createHash } from "node:crypto";
import { readFile, readdir, stat, unlink, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { normalizeAsciiDoc, normalizeMarkdown, normalizeRest, type ApplyContextFacetsOptions } from "@agentdocs/normalizer";
import {
  DocPageSchema,
  IngestManifestSchema,
  SourceLimitDiagnosticsSchema,
  SourceProvenanceManifestSchema,
  type DocPage,
  type IngestManifest,
  type SourceProvenanceManifest,
  type SourceLimitConfig,
  type SourceLimitDiagnostics,
  type SourceCoverage,
  type SkipReason,
} from "@agentdocs/shared";
import { minimatch } from "minimatch";
import { resolveIncludes, type IncludeUnresolved } from "./includes.js";

export type IngestOptions = {
  cwd: string;
  out: string;
  preserveSourcePath?: boolean;
  source: string;
  include?: string[];
  exclude?: string[];
  facets?: Record<string, string>;
  contextRules?: Array<{ match: string; facets: Record<string, string> }>;
  limits?: SourceLimitConfig;
  mdxMode?: "tolerant" | "strict";
  onProgress?: (event: IngestProgressEvent) => void;
  sourceType?: "local_markdown" | "repo";
  sourceManifest?: string;
};

export type IngestProgressEvent = {
  phase: "discovered" | "selected" | "processed";
  message: string;
  processedFiles?: number;
  selectedFiles?: number;
  totalFiles?: number;
};

export type IngestResult = {
  manifest: IngestManifest;
  manifestPath: string;
  pages: DocPage[];
};

export class IngestError extends Error {
  override readonly name = "IngestError";
}

const OPENAPI_UNSUPPORTED_MESSAGE =
  "OpenAPI ingestion is planned but not supported in this build. Use markdown, MDX, reST, AsciiDoc, repo, or website sources.";

type SourceFileFormat = "markdown" | "mdx" | "rst" | "restText" | "adoc" | "asciidoc";

type SourceFile = {
  filePath: string;
  format: SourceFileFormat;
  supported: boolean;
};

type ProvenanceFile = SourceProvenanceManifest["files"][number];

type LoadedProvenance = {
  manifest: SourceProvenanceManifest;
  manifestPath: string;
  files: Map<string, ProvenanceFile>;
};

export async function ingestLocalMarkdown(
  options: IngestOptions,
): Promise<IngestResult> {
  const startedAt = Date.now();
  const sourcePath = path.resolve(options.cwd, options.source);
  const outputRoot = path.resolve(options.cwd, options.out);
  const provenance = await loadProvenanceManifest(options.cwd, options.sourceManifest);
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
  const provenancePath = provenance === undefined
    ? undefined
    : path.posix.join("sources", "provenance-manifest.json");
  const sourceStats = await statSource(sourcePath);
  const sourceRoot = sourceStats.isDirectory() ? sourcePath : path.dirname(sourcePath);
  const scopedSourceFiles = await discoverSourceFiles(
    sourcePath,
    outputRoot,
    sourceRoot,
    options.include,
    options.exclude,
  );
  options.onProgress?.({
    phase: "discovered",
    message: `Discovered ${scopedSourceFiles.length} docs-like file(s) in source scope.`,
    totalFiles: scopedSourceFiles.length,
  });
  const selection = await selectFilesWithinLimits(scopedSourceFiles, options.limits);
  options.onProgress?.({
    phase: "selected",
    message: `Selected ${selection.selectedSupportedFiles.length} supported file(s) for ingestion${selection.diagnostics.reached.length === 0 ? "" : `; limits reached: ${selection.diagnostics.reached.join(", ")}`}.`,
    selectedFiles: selection.selectedSupportedFiles.length,
    totalFiles: selection.diagnostics.totalSupportedFiles,
  });
  const selectedFiles = selection.selectedSupportedFiles
    .filter((file) => file.supported);

  if (selectedFiles.length === 0) {
    const manifest = await writeEmptyIngestManifest({
      counts: { usable: 0, degraded: 0, skipped: 0, failed: 0 },
      manifestPath,
      outputRoot,
      sourceCoverage: createSourceCoverage(scopedSourceFiles, {
        usable: 0,
        degraded: 0,
        skipped: selection.limitSkippedSupportedFiles(),
        failed: 0,
      }, selection.diagnostics),
      sourceIdentity,
      sourceType: options.sourceType ?? "local_markdown",
      limits: selection.diagnostics,
      stateManifestPath,
      provenancePath,
      provenanceManifest: provenance?.manifest,
    });
    throw new IngestError(
      selection.diagnostics.reached.length > 0
        ? `No supported docs files were selected at ${options.source} because ingestion limits were reached (${selection.diagnostics.reached.join(", ")}); diagnostics were written to ${manifestPath}.`
        : manifest.sourceCoverage.unsupportedFiles > 0
        ? `No supported docs files found at ${options.source}. Found ${manifest.sourceCoverage.unsupportedFiles} unsupported docs-like file(s); coverage diagnostics were written to ${manifestPath}.`
        : `No supported docs files found at ${options.source}.`,
    );
  }

  const pages: DocPage[] = [];
  const diagnostics: IngestManifest["diagnostics"] = [];
  for (const sourceFile of selectedFiles) {
    if (hasElapsedLimitBeenReached(startedAt, options.limits)) {
      selection.markElapsedReached();
      break;
    }
    const filePath = sourceFile.filePath;
    const initialContent = await readFile(filePath, "utf8");
    let markdown = initialContent;
    let unresolved: IncludeUnresolved[] = [];
    if (
      sourceFile.format === "rst" ||
      sourceFile.format === "restText" ||
      sourceFile.format === "adoc" ||
      sourceFile.format === "asciidoc"
    ) {
      const resolution = await resolveIncludes({
        content: initialContent,
        filePath,
        sourceRoot,
        format: sourceFile.format,
      });
      markdown = resolution.content;
      unresolved = resolution.unresolved;
    }
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
    const provenanceFile = provenanceFileFor(
      provenance,
      toPosixPath(sourceRelativePath),
      toPosixPath(repoPath),
    );
    if (provenanceFile !== undefined) {
      const actualHash = createHash("sha256").update(initialContent, "utf8").digest("hex");
      if (actualHash !== provenanceFile.sha256) {
        throw new IngestError(
          `Provenance hash mismatch for ${toPosixPath(repoPath)}: expected ${provenanceFile.sha256}, got ${actualHash}. Refresh the sidecar or restore the captured source.`,
        );
      }
    }
    const provenanceWarning = provenance !== undefined && provenanceFile === undefined
      ? [`No provenance record found for ${toPosixPath(repoPath)}.`]
      : [];
    try {
      const page = normalizeSourceFile({
        markdown,
        format: sourceFile.format,
        repoPath,
        context: { fixed: options.facets, rules: options.contextRules },
        mdxMode: options.mdxMode ?? "tolerant",
        sourceType: options.sourceType ?? "local_markdown",
        sourceUrl: provenanceFile?.sourceUrl,
        canonicalUrl: provenanceFile?.canonicalUrl,
      });
      const skipReason = classifySkip(page, unresolved);
      if (skipReason !== undefined) {
        diagnostics.push({
          repoPath: toPosixPath(repoPath),
          status: "skipped",
          mode: page.normalization.mode,
          warnings: [...page.normalization.warnings, ...provenanceWarning],
          message: skipReason === "empty"
            ? "No useful prose, headings, or fenced code remained after normalization."
            : `Unresolved include directive: ${skipReason}`,
          skipReason,
          includeTargets: unresolved.map((u) => u.target),
        });
        continue;
      }
      pages.push(page);
      diagnostics.push({
        repoPath: toPosixPath(repoPath),
        status: page.normalization.mode === "mdx-fallback" ? "degraded" : "usable",
        mode: page.normalization.mode,
        warnings: [...page.normalization.warnings, ...provenanceWarning],
        includeTargets: unresolved.length > 0 ? unresolved.map((u) => u.target) : undefined,
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
    if (pages.length % 100 === 0 || pages.length === selectedFiles.length) {
      options.onProgress?.({
        phase: "processed",
        message: `Processed ${pages.length} supported file(s).`,
        processedFiles: pages.length,
        selectedFiles: selectedFiles.length,
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
    provenancePath,
    pageCount: pages.length,
    counts: {
      usable: diagnostics.filter((item) => item.status === "usable").length,
      degraded: diagnostics.filter((item) => item.status === "degraded").length,
      skipped: diagnostics.filter((item) => item.status === "skipped").length
        + selection.limitSkippedSupportedFiles()
        + selectedFiles.length - diagnostics.length,
      failed: diagnostics.filter((item) => item.status === "failed").length,
    },
    sourceCoverage: createSourceCoverage(scopedSourceFiles, {
      usable: diagnostics.filter((item) => item.status === "usable").length,
      degraded: diagnostics.filter((item) => item.status === "degraded").length,
      skipped: diagnostics.filter((item) => item.status === "skipped").length
        + selection.limitSkippedSupportedFiles()
        + selectedFiles.length - diagnostics.length,
      failed: diagnostics.filter((item) => item.status === "failed").length,
    }, selection.diagnostics),
    limits: selection.diagnostics,
    diagnostics,
    pages: manifestPages,
  });

  await mkdir(pagesDirectory, { recursive: true });
  await mkdir(path.dirname(stateManifestPath), { recursive: true });
  await removeStaleIngestPages(stateManifestPath, outputRoot, new Set(manifestPages.map((page) => page.outputPath)));
  if (provenance === undefined) {
    await removeOutputFile(outputRoot, path.posix.join("sources", "provenance-manifest.json"));
  }
  for (const [index, page] of validatedPages.entries()) {
    await writeJson(
      path.join(outputRoot, ...manifestPages[index]!.outputPath.split("/")),
      page,
    );
  }
  await writeJson(manifestPath, manifest);
  await writeJson(stateManifestPath, manifest);
  if (provenance !== undefined && provenancePath !== undefined) {
    await writeJson(path.join(outputRoot, ...provenancePath.split("/")), provenance.manifest);
  }

  if (validatedPages.length === 0) {
    throw new IngestError(
      `No useful Markdown or MDX pages remained after normalization. Diagnostics were written to ${manifestPath}.`,
    );
  }

  return { manifest, manifestPath, pages: validatedPages };
}

function classifySkip(
  page: DocPage,
  unresolved: IncludeUnresolved[],
): SkipReason | undefined {
  if (unresolved.length > 0) {
    const firstOut = unresolved.find((u) => u.reason === "out-of-scope");
    if (firstOut) return "include-out-of-scope";
    const firstMissing = unresolved.find((u) => u.reason === "missing");
    if (firstMissing) return "include-missing";
    const firstCycle = unresolved.find((u) => u.reason === "cycle");
    if (firstCycle) return "include-cycle";
    const firstDepth = unresolved.find((u) => u.reason === "depth");
    if (firstDepth) return "include-depth";
    const firstFormat = unresolved.find((u) => u.reason === "unsupported-format");
    if (firstFormat) return "include-unsupported-format";
    const firstAntora = unresolved.find((u) => u.reason === "antora-id");
    if (firstAntora) return "include-antora-id";
  }
  if (!hasUsefulPageContent(page)) {
    return "empty";
  }
  return undefined;
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

async function loadProvenanceManifest(
  cwd: string,
  configuredPath: string | undefined,
): Promise<LoadedProvenance | undefined> {
  if (configuredPath === undefined) return undefined;
  const manifestPath = path.resolve(cwd, configuredPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new IngestError(`Unable to read provenance manifest ${manifestPath}: ${message}`);
  }
  let manifest: SourceProvenanceManifest;
  try {
    manifest = SourceProvenanceManifestSchema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new IngestError(`Invalid provenance manifest ${manifestPath}: ${message}`);
  }
  const files = new Map<string, ProvenanceFile>();
  for (const file of manifest.files) {
    const key = toPosixPath(file.path).replace(/^\.\//, "");
    if (files.has(key)) {
      throw new IngestError(`Invalid provenance manifest ${manifestPath}: duplicate file path ${key}.`);
    }
    files.set(key, file);
  }
  return { manifest, manifestPath, files };
}

function provenanceFileFor(
  provenance: LoadedProvenance | undefined,
  sourceRelativePath: string,
  repoPath: string,
): ProvenanceFile | undefined {
  if (provenance === undefined) return undefined;
  const direct = provenance.files.get(sourceRelativePath) ?? provenance.files.get(repoPath);
  if (direct !== undefined) return direct;
  const suffix = `/${sourceRelativePath}`;
  const matches = [...provenance.files.entries()]
    .filter(([key]) => key.endsWith(suffix))
    .map(([, file]) => file);
  return matches.length === 1 ? matches[0] : undefined;
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
  limits?: SourceLimitDiagnostics;
  manifestPath: string;
  outputRoot: string;
  sourceCoverage: SourceCoverage;
  sourceIdentity: string;
  sourceType: IngestManifest["sourceType"];
  stateManifestPath: string;
  provenancePath?: string;
  provenanceManifest?: SourceProvenanceManifest;
}): Promise<IngestManifest> {
  const manifest = IngestManifestSchema.parse({
    schemaVersion: 1,
    sourceType: options.sourceType,
    sourcePath: options.sourceIdentity,
    provenancePath: options.provenancePath,
    pageCount: 0,
    counts: options.counts,
    sourceCoverage: options.sourceCoverage,
    limits: options.limits,
    diagnostics: [],
    pages: [],
  });
  await mkdir(path.dirname(options.manifestPath), { recursive: true });
  await mkdir(path.dirname(options.stateManifestPath), { recursive: true });
  await removeStaleIngestPages(options.stateManifestPath, options.outputRoot, new Set());
  if (options.provenanceManifest === undefined) {
    await removeOutputFile(options.outputRoot, path.posix.join("sources", "provenance-manifest.json"));
  }
  await writeJson(options.manifestPath, manifest);
  await writeJson(options.stateManifestPath, manifest);
  if (options.provenancePath !== undefined && options.provenanceManifest !== undefined) {
    await writeJson(
      path.join(options.outputRoot, ...options.provenancePath.split("/")),
      options.provenanceManifest,
    );
  }
  return manifest;
}

function createSourceCoverage(
  files: SourceFile[],
  counts: IngestManifest["counts"],
  limits?: SourceLimitDiagnostics,
): SourceCoverage {
  const supportedByFormat = {
    markdown: files.filter((file) => file.format === "markdown").length,
    mdx: files.filter((file) => file.format === "mdx").length,
    rst: files.filter((file) => file.format === "rst").length,
    restText: files.filter((file) => file.format === "restText").length,
    adoc: files.filter((file) => file.format === "adoc").length,
    asciidoc: files.filter((file) => file.format === "asciidoc").length,
  };
  const unsupportedByFormat = {
    rst: 0,
    restText: 0,
    adoc: 0,
    asciidoc: 0,
  };
  const supportedFiles = supportedByFormat.markdown
    + supportedByFormat.mdx
    + supportedByFormat.rst
    + supportedByFormat.restText
    + supportedByFormat.adoc
    + supportedByFormat.asciidoc;
  const unsupportedFiles = 0;
  const intendedFiles = supportedFiles + unsupportedFiles;
  const compiledFiles = counts.usable + counts.degraded;
  const coverageRatio = intendedFiles === 0 ? 0 : roundRatio(compiledFiles / intendedFiles);
  const hasUnsupportedGap = unsupportedFiles > 0;
  const limitReached = (limits?.reached.length ?? 0) > 0;
  const gapSeverity = limitReached
    ? "warn"
    : hasUnsupportedGap && coverageRatio < 0.5
    ? "fail"
    : hasUnsupportedGap
      ? "warn"
      : compiledFiles < supportedFiles
        ? "warn"
        : "none";
  const gapReason = limitReached
    ? "scale_limited" as const
    : hasUnsupportedGap
      ? "unsupported_format" as const
      : undefined;
  const message = limitReached
    ? `${compiledFiles} of ${intendedFiles} docs-like file(s) compiled; ingestion limits reached (${limits!.reached.join(", ")}).`
    : hasUnsupportedGap
    ? `${compiledFiles} of ${intendedFiles} docs-like file(s) compiled; ${unsupportedFiles} unsupported file(s) were in scope.`
    : `${compiledFiles} of ${intendedFiles} supported docs file(s) compiled.`;

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

async function selectFilesWithinLimits(
  files: SourceFile[],
  limits: SourceLimitConfig | undefined,
): Promise<{
  diagnostics: SourceLimitDiagnostics;
  limitSkippedSupportedFiles: () => number;
  markElapsedReached: () => void;
  selectedSupportedFiles: SourceFile[];
}> {
  const supported = files.filter((file) => file.supported);
  const reached = new Set<SourceLimitDiagnostics["reached"][number]>();
  const selected: SourceFile[] = [];
  let selectedBytes = 0;
  let stop = false;
  for (const file of supported) {
    if (stop) {
      continue;
    }
    if (limits?.maxFiles !== undefined && selected.length >= limits.maxFiles) {
      reached.add("maxFiles");
      stop = true;
      continue;
    }
    if (limits?.maxPages !== undefined && selected.length >= limits.maxPages) {
      reached.add("maxPages");
      stop = true;
      continue;
    }
    const size = (await stat(file.filePath)).size;
    if (limits?.maxBytes !== undefined && selectedBytes + size > limits.maxBytes) {
      reached.add("maxBytes");
      stop = true;
      continue;
    }
    selected.push(file);
    selectedBytes += size;
  }
  const diagnostics = () => SourceLimitDiagnosticsSchema.parse({
    configured: limits ?? {},
    reached: [...reached].sort(compareStrings),
    totalDocsLikeFiles: files.length,
    selectedDocsLikeFiles: selected.length + files.filter((file) => !file.supported).length,
    totalSupportedFiles: supported.length,
    selectedSupportedFiles: selected.length,
    skippedByLimit: supported.length - selected.length,
    selectedBytes,
    message: reached.size === 0
      ? `Selected all ${supported.length} supported file(s) in source scope.`
      : `Selected ${selected.length} of ${supported.length} supported file(s); limit(s) reached: ${[...reached].sort(compareStrings).join(", ")}.`,
  });
  return {
    get diagnostics() {
      return diagnostics();
    },
    limitSkippedSupportedFiles: () => supported.length - selected.length,
    markElapsedReached: () => {
      reached.add("maxElapsedMs");
    },
    selectedSupportedFiles: selected,
  };
}

function hasElapsedLimitBeenReached(startedAt: number, limits: SourceLimitConfig | undefined): boolean {
  return limits?.maxElapsedMs !== undefined && Date.now() - startedAt >= limits.maxElapsedMs;
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
      if (await isLikelyOpenApiFile(sourcePath)) {
        throw new IngestError(OPENAPI_UNSUPPORTED_MESSAGE);
      }
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
  if (extension === ".rst") return { filePath, format: "rst", supported: true };
  if (extension === ".adoc") return { filePath, format: "adoc", supported: true };
  if (extension === ".asciidoc") return { filePath, format: "asciidoc", supported: true };
  if (extension === ".txt" && await isLikelyRestTextFile(filePath, sourceRoot)) {
    return { filePath, format: "restText", supported: true };
  }
  return undefined;
}

type NormalizeSourceFileOptions = {
  markdown: string;
  format: SourceFileFormat;
  repoPath: string;
  context: ApplyContextFacetsOptions;
  mdxMode: "tolerant" | "strict";
  sourceType: "local_markdown" | "repo";
  sourceUrl?: string;
  canonicalUrl?: string;
};

function normalizeSourceFile(options: NormalizeSourceFileOptions): DocPage {
  switch (options.format) {
    case "markdown":
    case "mdx":
      return normalizeMarkdown({
        markdown: options.markdown,
        format: options.format,
        repoPath: options.repoPath,
        context: options.context,
        mdxMode: options.mdxMode,
        sourceType: options.sourceType,
        sourceUrl: options.sourceUrl,
        canonicalUrl: options.canonicalUrl,
      });
    case "rst":
    case "restText":
      return normalizeRest({
        rest: options.markdown,
        sourceFormat: options.format,
        repoPath: options.repoPath,
        context: options.context,
        sourceType: options.sourceType,
        sourceUrl: options.sourceUrl,
        canonicalUrl: options.canonicalUrl,
      });
    case "adoc":
    case "asciidoc":
      return normalizeAsciiDoc({
        asciidoc: options.markdown,
        sourceFormat: options.format,
        repoPath: options.repoPath,
        context: options.context,
        sourceType: options.sourceType,
        sourceUrl: options.sourceUrl,
        canonicalUrl: options.canonicalUrl,
      });
  }
}

async function isLikelyOpenApiFile(filePath: string): Promise<boolean> {
  const extension = path.extname(filePath).toLowerCase();
  if (![".json", ".yaml", ".yml"].includes(extension)) {
    return false;
  }
  const text = (await readFile(filePath, "utf8")).slice(0, 16_384);
  return /(?:^|[\n{,])\s*["']?openapi["']?\s*[:=]\s*["']?3\./i.test(text)
    || /(?:^|[\n{,])\s*["']?swagger["']?\s*[:=]\s*["']?2\./i.test(text);
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

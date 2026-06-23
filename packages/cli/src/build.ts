import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  generateStaticArtifacts,
  type ProjectIdentity,
} from "@agentdocs/generator";
import { buildAgentMap } from "@agentdocs/graph";
import { buildSearchIndex } from "@agentdocs/indexer";
import {
  chunkMarkdownByHeading,
  applyContextFacets,
  extractDeterministicEntities,
  extractVersionHints,
} from "@agentdocs/normalizer";
import {
  AgentMapSchema,
  ChunkSchema,
  DocPageSchema,
  IngestManifestSchema,
  SourceCoverageSchema,
  type Chunk,
  type DocPage,
  type SourceCoverage,
} from "@agentdocs/shared";

export type BuildOptions = {
  cwd: string;
  out: string;
  project?: ProjectIdentity;
  rules?: string[];
  writeAgentsMd?: boolean;
  writeLlmsTxt?: boolean;
  writeManifest?: boolean;
  writeTaskPacks?: boolean;
  tasks?: Array<{ id: string; title: string; queries: string[]; requiredFacets: Record<string, string> }>;
  context?: {
    preferred?: Record<string, string>;
    exclusiveKeys?: string[];
    rules?: Array<{ match: string; facets: Record<string, string> }>;
  };
};

export type BuildResult = {
  agentMapPath: string;
  agentsMdPath?: string;
  chunksPath: string;
  chunkCount: number;
  edgeCount: number;
  entityCount: number;
  llmsTxtPath?: string;
  manifestPath?: string;
  indexBackend: "sqlite-fts5" | "lexical";
  indexPath: string;
  pageCount: number;
  sourceCoverage?: SourceCoverage;
  taskPackCount: number;
  taskPackPaths: string[];
};

export class BuildError extends Error {
  override readonly name = "BuildError";
}

type PageFile = {
  file: string;
  page: DocPage;
};

export async function buildFromSources(
  options: BuildOptions,
): Promise<BuildResult> {
  const outputRoot = path.resolve(options.cwd, options.out);
  const pagesDirectory = path.join(outputRoot, "sources", "pages");
  const chunksPath = path.join(outputRoot, "chunks.jsonl");
  const agentMapPath = path.join(outputRoot, "agent-map.json");
  const taskPacksDirectory = path.join(outputRoot, "task-packs");
  const pages = await readPages(pagesDirectory);
  const sourceCoverage = await readSourceCoverage(outputRoot);
  if (pages.length === 0) {
    throw new BuildError(
      `No normalized pages found at ${pagesDirectory}. Run "agentdocs ingest" or "agentdocs crawl" first.`,
    );
  }

  const enrichedPages = pages.map(({ file, page }) => ({
    file,
    page: enrichPage(page, options.context?.rules),
  }));
  const chunks = enrichedPages
    .flatMap(({ page }) => chunkMarkdownByHeading(page))
    .map((chunk) => ChunkSchema.parse(chunk));
  if (chunks.length === 0 || !hasUsefulBuildContent(enrichedPages.map(({ page }) => page), chunks)) {
    throw new BuildError(
      "Normalized pages contain no useful documentation content. Inspect crawl diagnostics or source extraction before building.",
    );
  }
  const graph = AgentMapSchema.parse(
    buildAgentMap({
      chunks,
      pages: enrichedPages.map(({ page }) => page),
    }),
  );
  const generated = generateStaticArtifacts({
    agentMap: graph,
    linkTaskPacks: options.writeTaskPacks !== false,
    project: options.project ?? fallbackProject(graph.pages),
    rules: options.rules,
    preferredFacets: options.context?.preferred,
    exclusiveKeys: options.context?.exclusiveKeys,
    sourceCoverage,
    tasks: options.tasks,
  });
  const agentMap = generated.agentMap;

  for (const { file, page } of enrichedPages) {
    await writeFile(
      path.join(pagesDirectory, file),
      `${JSON.stringify(DocPageSchema.parse(page), null, 2)}\n`,
      "utf8",
    );
  }
  await writeChunks(chunksPath, chunks);
  await writeFile(agentMapPath, `${JSON.stringify(agentMap, null, 2)}\n`, "utf8");
  const llmsTxtPath = options.writeLlmsTxt === false
    ? undefined
    : path.join(outputRoot, "llms.txt");
  const agentsMdPath = options.writeAgentsMd === false
    ? undefined
    : path.join(outputRoot, "AGENTS.md");
  const manifestPath = options.writeManifest === false
    ? undefined
    : path.join(outputRoot, "manifest.json");
  const taskPackPaths: string[] = [];
  if (llmsTxtPath !== undefined) {
    await writeFile(llmsTxtPath, generated.llmsTxt, "utf8");
  }
  if (agentsMdPath !== undefined) {
    await writeFile(agentsMdPath, generated.agentsMd, "utf8");
  }
  if (manifestPath !== undefined) {
    await writeFile(manifestPath, `${JSON.stringify(generated.manifest, null, 2)}\n`, "utf8");
  }
  if (options.writeTaskPacks !== false) {
    await mkdir(taskPacksDirectory, { recursive: true });
    await removeStaleTaskPacks(taskPacksDirectory, new Set(Object.keys(generated.taskPackMarkdown)));
    for (const [id, markdown] of Object.entries(generated.taskPackMarkdown)) {
      const taskPackPath = path.join(taskPacksDirectory, `${id}.md`);
      await writeFile(taskPackPath, markdown, "utf8");
      taskPackPaths.push(taskPackPath);
    }
  } else {
    await removeStaleTaskPacks(taskPacksDirectory, new Set());
  }
  await removeDisabledArtifact(options.writeLlmsTxt === false, path.join(outputRoot, "llms.txt"));
  await removeDisabledArtifact(options.writeAgentsMd === false, path.join(outputRoot, "AGENTS.md"));
  await removeDisabledArtifact(options.writeManifest === false, path.join(outputRoot, "manifest.json"));
  const index = await buildSearchIndex({
    agentMap,
    cwd: options.cwd,
    out: options.out,
    preferredFacets: options.context?.preferred,
    exclusiveKeys: options.context?.exclusiveKeys,
  });

  return {
    agentMapPath,
    agentsMdPath,
    chunksPath,
    chunkCount: chunks.length,
    edgeCount: agentMap.edges.length,
    entityCount: agentMap.entities.length,
    llmsTxtPath,
    manifestPath,
    indexBackend: index.backend,
    indexPath: index.indexPath,
    pageCount: enrichedPages.length,
    sourceCoverage,
    taskPackCount: generated.taskPacks.length,
    taskPackPaths,
  };
}

function hasUsefulBuildContent(pages: DocPage[], chunks: Chunk[]): boolean {
  if (pages.some((page) => page.codeBlocks.some((block) => block.value.trim().length >= 20))) {
    return true;
  }
  return chunks.some((chunk) =>
    chunk.text.replace(/^#{1,6}\s+.+$/gm, "").replace(/\s+/g, " ").trim().length >= 24);
}

async function removeStaleTaskPacks(
  directory: string,
  currentIds: Set<string>,
): Promise<void> {
  let files: string[];
  try {
    files = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  for (const file of files.filter((entry) => entry.endsWith(".md"))) {
    if (!currentIds.has(path.basename(file, ".md"))) {
      await unlink(path.join(directory, file));
    }
  }
}

async function removeDisabledArtifact(disabled: boolean, filePath: string): Promise<void> {
  if (!disabled) {
    return;
  }
  try {
    await unlink(filePath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

async function readPages(pagesDirectory: string): Promise<PageFile[]> {
  let files: string[];
  try {
    files = await readdir(pagesDirectory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const pages: PageFile[] = [];
  for (const file of files.filter((entry) => entry.endsWith(".json")).sort(compareStrings)) {
    try {
      pages.push({
        file,
        page: DocPageSchema.parse(
          JSON.parse(await readFile(path.join(pagesDirectory, file), "utf8")),
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BuildError(`Invalid normalized page ${file}: ${message}`);
    }
  }
  return pages.sort((left, right) => comparePages(left.page, right.page));
}

async function readSourceCoverage(outputRoot: string): Promise<SourceCoverage | undefined> {
  const stateDirectory = path.join(outputRoot, "sources", "state");
  let files: string[] = [];
  try {
    files = (await readdir(stateDirectory))
      .filter((file) => /^ingest-[a-f0-9]{16}\.json$/.test(file))
      .sort(compareStrings);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const manifestPaths = files.length > 0
    ? files.map((file) => path.join(stateDirectory, file))
    : [path.join(outputRoot, "sources", "ingest-manifest.json")];
  const coverages: SourceCoverage[] = [];
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = IngestManifestSchema.parse(
        JSON.parse(await readFile(manifestPath, "utf8")),
      );
      coverages.push(manifest.sourceCoverage);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new BuildError(`Invalid ingest manifest at ${manifestPath}: ${message}`);
    }
  }
  if (coverages.length === 0) {
    return undefined;
  }
  return aggregateSourceCoverage(coverages);
}

function aggregateSourceCoverage(coverages: SourceCoverage[]): SourceCoverage {
  const totals = coverages.reduce((summary, coverage) => ({
    supportedFiles: summary.supportedFiles + coverage.supportedFiles,
    unsupportedFiles: summary.unsupportedFiles + coverage.unsupportedFiles,
    intendedFiles: summary.intendedFiles + coverage.intendedFiles,
    compiledFiles: summary.compiledFiles + coverage.compiledFiles,
    degradedFiles: summary.degradedFiles + coverage.degradedFiles,
    skippedFiles: summary.skippedFiles + coverage.skippedFiles,
    failedFiles: summary.failedFiles + coverage.failedFiles,
    supportedByFormat: {
      markdown: summary.supportedByFormat.markdown + coverage.supportedByFormat.markdown,
      mdx: summary.supportedByFormat.mdx + coverage.supportedByFormat.mdx,
      rst: summary.supportedByFormat.rst + coverage.supportedByFormat.rst,
      restText: summary.supportedByFormat.restText + coverage.supportedByFormat.restText,
      adoc: summary.supportedByFormat.adoc + coverage.supportedByFormat.adoc,
      asciidoc: summary.supportedByFormat.asciidoc + coverage.supportedByFormat.asciidoc,
    },
    unsupportedByFormat: {
      rst: summary.unsupportedByFormat.rst + coverage.unsupportedByFormat.rst,
      restText: summary.unsupportedByFormat.restText + coverage.unsupportedByFormat.restText,
      adoc: summary.unsupportedByFormat.adoc + coverage.unsupportedByFormat.adoc,
      asciidoc: summary.unsupportedByFormat.asciidoc + coverage.unsupportedByFormat.asciidoc,
    },
  }), {
    supportedFiles: 0,
    unsupportedFiles: 0,
    intendedFiles: 0,
    compiledFiles: 0,
    degradedFiles: 0,
    skippedFiles: 0,
    failedFiles: 0,
    supportedByFormat: { markdown: 0, mdx: 0, rst: 0, restText: 0, adoc: 0, asciidoc: 0 },
    unsupportedByFormat: { rst: 0, restText: 0, adoc: 0, asciidoc: 0 },
  });
  const coverageRatio = totals.intendedFiles === 0
    ? 0
    : Math.round((totals.compiledFiles / totals.intendedFiles) * 10_000) / 10_000;
  const gapSeverity = coverages.some((coverage) => coverage.gapSeverity === "fail")
    ? "fail"
    : coverages.some((coverage) => coverage.gapSeverity === "warn")
      ? "warn"
      : "none";
  return SourceCoverageSchema.parse({
    ...totals,
    coverageRatio,
    gapSeverity,
    gapReason: totals.unsupportedFiles > 0 ? "unsupported_format" : undefined,
    message: totals.unsupportedFiles > 0
      ? `${totals.compiledFiles} of ${totals.intendedFiles} docs-like file(s) compiled; ${totals.unsupportedFiles} unsupported file(s) were in scope.`
      : `${totals.compiledFiles} of ${totals.intendedFiles} supported docs file(s) compiled.`,
  });
}

function enrichPage(
  page: DocPage,
  rules?: Array<{ match: string; facets: Record<string, string> }>,
): DocPage {
  return applyContextFacets(DocPageSchema.parse({
    ...page,
    versionHints: extractVersionHints(page.markdown),
    codeBlocks: page.codeBlocks.map((block) => {
      const extraction = extractDeterministicEntities(block.value);
      return {
        ...block,
        extracted: {
          packages: extraction.packages,
          imports: extraction.imports,
          envVars: extraction.envVars,
          cliCommands: extraction.cliCommands,
          httpRoutes: extraction.httpRoutes,
        },
      };
    }),
  }), { rules });
}

async function writeChunks(filePath: string, chunks: Chunk[]): Promise<void> {
  const contents = chunks.map((chunk) => JSON.stringify(chunk)).join("\n");
  await writeFile(filePath, contents.length === 0 ? "" : `${contents}\n`, "utf8");
}

function comparePages(left: DocPage, right: DocPage): number {
  const leftSource = left.canonicalUrl ?? left.sourceUrl ?? left.repoPath ?? left.id;
  const rightSource =
    right.canonicalUrl ?? right.sourceUrl ?? right.repoPath ?? right.id;
  return compareStrings(leftSource, rightSource);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fallbackProject(pages: DocPage[]): ProjectIdentity {
  const name = pages[0]?.title ?? "Unknown project";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown-project";
  return { name, slug };
}

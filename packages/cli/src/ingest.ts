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

export type IngestOptions = {
  cwd: string;
  out: string;
  source: string;
};

export type IngestResult = {
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
  const files = await discoverMarkdownFiles(sourcePath, outputRoot);

  if (files.length === 0) {
    throw new IngestError(
      `No Markdown or MDX files found at ${options.source}.`,
    );
  }

  const pages: DocPage[] = [];
  const sourceStats = await stat(sourcePath);
  for (const filePath of files) {
    const markdown = await readFile(filePath, "utf8");
    const repoPath = sourceStats.isDirectory()
      ? path.relative(sourcePath, filePath)
      : path.basename(filePath);
    try {
      pages.push(normalizeMarkdown({ markdown, repoPath }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new IngestError(`Failed to ingest ${toPosixPath(repoPath)}: ${message}`);
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
    sourceType: "local_markdown",
    sourcePath: sourceIdentity,
    pageCount: pages.length,
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

  return { manifestPath, pages: validatedPages };
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

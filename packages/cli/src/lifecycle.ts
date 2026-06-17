import { createHash } from "node:crypto";
import { rm, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";

import {
  CrawlManifestSchema,
  IngestManifestSchema,
  type AgentDocsConfig,
} from "@agentdocs/shared";

export class LifecycleInputError extends Error {
  override readonly name = "LifecycleInputError";
  readonly exitCode = 2;
}

export class LifecycleError extends Error {
  override readonly name = "LifecycleError";
}

export async function cleanOutputDirectory(cwd: string, out: string): Promise<void> {
  const outputRoot = path.resolve(cwd, out);
  assertSafeOutputDirectory(cwd, outputRoot);
  await rm(outputRoot, { recursive: true, force: true });
}

export async function pruneRemovedSourceArtifacts(
  config: AgentDocsConfig | undefined,
  cwd: string,
  out: string,
): Promise<void> {
  if (config === undefined) {
    return;
  }
  const outputRoot = path.resolve(cwd, out);
  const stateDirectory = path.join(outputRoot, "sources", "state");
  let files: string[];
  try {
    files = await readdir(stateDirectory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  const currentStateFiles = new Set(
    config.sources
      .map((source) => stateFileForSource(cwd, source))
      .filter((file): file is string => file !== undefined),
  );
  const staleFiles = files
    .filter((file) => /^ingest-[a-f0-9]{16}\.json$|^crawl-[a-f0-9]{16}\.json$/.test(file))
    .filter((file) => !currentStateFiles.has(file))
    .sort(compareStrings);

  for (const file of staleFiles) {
    const manifestPath = path.join(stateDirectory, file);
    const contents = await readFile(manifestPath, "utf8");
    const outputPaths = file.startsWith("ingest-")
      ? pathsFromIngestManifest(contents)
      : pathsFromCrawlManifest(contents);
    for (const outputPath of outputPaths) {
      await removeOutputFile(outputRoot, outputPath);
    }
    await unlink(manifestPath);
  }
}

function assertSafeOutputDirectory(cwd: string, outputRoot: string): void {
  const workspaceRoot = path.resolve(cwd);
  const parsed = path.parse(outputRoot);
  if (outputRoot === parsed.root) {
    throw new LifecycleInputError(`Refusing to clean filesystem root: ${outputRoot}`);
  }
  if (outputRoot === workspaceRoot) {
    throw new LifecycleInputError(`Refusing to clean the project root: ${outputRoot}`);
  }
  if (!isWithin(workspaceRoot, outputRoot)) {
    throw new LifecycleInputError(`Refusing to clean outside the project root: ${outputRoot}`);
  }
}

function stateFileForSource(cwd: string, source: AgentDocsConfig["sources"][number]): string | undefined {
  if (source.type === "local_markdown" || source.type === "repo") {
    const sourcePath = path.resolve(cwd, source.path);
    const sourceIdentity = isWithin(cwd, sourcePath)
      ? toPosixPath(path.relative(cwd, sourcePath) || ".")
      : toPosixPath(sourcePath);
    return `ingest-${shortHash(sourceIdentity)}.json`;
  }
  if (source.type === "website") {
    return `crawl-${shortHash(normalizeSourceUrl(source.url))}.json`;
  }
  return undefined;
}

function pathsFromIngestManifest(contents: string): string[] {
  try {
    const manifest = IngestManifestSchema.parse(JSON.parse(contents));
    return manifest.pages.map((page) => page.outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LifecycleError(`Invalid previous ingest source manifest: ${message}`);
  }
}

function pathsFromCrawlManifest(contents: string): string[] {
  try {
    const manifest = CrawlManifestSchema.parse(JSON.parse(contents));
    return manifest.pages.flatMap((page) => [
      page.rawHtmlPath,
      page.markdownPath,
      page.pagePath,
    ]).concat((manifest.unusablePages ?? []).map((page) => page.rawHtmlPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LifecycleError(`Invalid previous crawl source manifest: ${message}`);
  }
}

async function removeOutputFile(outputRoot: string, relativePath: string): Promise<void> {
  const destination = path.resolve(outputRoot, ...relativePath.split("/"));
  if (!isWithin(outputRoot, destination) || destination === outputRoot) {
    throw new LifecycleError(`Refusing to remove file outside output directory: ${destination}`);
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

function normalizeSourceUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.href;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

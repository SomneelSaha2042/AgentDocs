import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
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
  const pagesDirectory = path.join(outputRoot, "sources", "pages");
  const manifestPath = path.join(outputRoot, "sources", "ingest-manifest.json");
  const files = await discoverMarkdownFiles(sourcePath);

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
    sourcePath: toPosixPath(options.source),
    pageCount: pages.length,
    pages: manifestPages,
  });

  await mkdir(pagesDirectory, { recursive: true });
  for (const [index, page] of validatedPages.entries()) {
    await writeJson(
      path.join(outputRoot, ...manifestPages[index]!.outputPath.split("/")),
      page,
    );
  }
  await writeJson(manifestPath, manifest);

  return { manifestPath, pages: validatedPages };
}

async function discoverMarkdownFiles(sourcePath: string): Promise<string[]> {
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
      files.push(...(await discoverMarkdownFiles(entryPath)));
    } else if (entry.isFile() && isMarkdownFile(entryPath)) {
      files.push(entryPath);
    }
  }
  return files.sort(compareStrings);
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

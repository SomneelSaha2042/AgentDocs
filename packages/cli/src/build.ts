import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  chunkMarkdownByHeading,
  extractDeterministicEntities,
  extractVersionHints,
} from "@agentdocs/normalizer";
import {
  ChunkSchema,
  DocPageSchema,
  type Chunk,
  type DocPage,
} from "@agentdocs/shared";

export type BuildOptions = {
  cwd: string;
  out: string;
};

export type BuildResult = {
  chunksPath: string;
  chunkCount: number;
  pageCount: number;
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
  const pages = await readPages(pagesDirectory);
  if (pages.length === 0) {
    throw new BuildError(
      `No normalized pages found at ${pagesDirectory}. Run "agentdocs ingest" or "agentdocs crawl" first.`,
    );
  }

  const enrichedPages = pages.map(({ file, page }) => ({
    file,
    page: enrichPage(page),
  }));
  const chunks = enrichedPages
    .flatMap(({ page }) => chunkMarkdownByHeading(page))
    .map((chunk) => ChunkSchema.parse(chunk));

  for (const { file, page } of enrichedPages) {
    await writeFile(
      path.join(pagesDirectory, file),
      `${JSON.stringify(DocPageSchema.parse(page), null, 2)}\n`,
      "utf8",
    );
  }
  await writeChunks(chunksPath, chunks);

  return {
    chunksPath,
    chunkCount: chunks.length,
    pageCount: enrichedPages.length,
  };
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

function enrichPage(page: DocPage): DocPage {
  return DocPageSchema.parse({
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
  });
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

import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderReadinessMarkdown, scanReadiness } from "@agentdocs/doctor";
import {
  AgentMapSchema,
  CrawlManifestSchema,
  IngestManifestSchema,
  parseConfig,
  ReadinessCategorySchema,
  ReadinessReportSchema,
  type AgentMap,
  type ReadinessCategory,
  type ReadinessReport,
} from "@agentdocs/shared";

export type DoctorOptions = {
  category?: string;
  config: string;
  cwd: string;
  out: string;
};

export type DoctorResult = {
  jsonPath: string;
  markdownPath: string;
  report: ReadinessReport;
};

export class DoctorError extends Error {
  override readonly name = "DoctorError";
}

export class DoctorInputError extends Error {
  override readonly name = "DoctorInputError";
}

export class ReadinessThresholdError extends Error {
  override readonly name = "ReadinessThresholdError";
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const outputRoot = path.resolve(options.cwd, options.out);
  const reportsDirectory = path.join(outputRoot, "reports");
  const agentMapPath = path.join(outputRoot, "agent-map.json");
  const category = parseCategory(options.category);
  const agentMap = await readAgentMap(agentMapPath);
  const crawlQuality = await readCrawlQuality(
    path.join(outputRoot, "sources", "crawl-manifest.json"),
  );
  const ingestQuality = await readIngestQuality(
    path.join(outputRoot, "sources", "ingest-manifest.json"),
  );
  const config = await readOptionalConfig(path.resolve(options.cwd, options.config));
  const report = ReadinessReportSchema.parse(scanReadiness({
    agentMap,
    category,
    artifacts: {
      hasAgentMap: agentMap !== undefined,
      hasAgentsMd: await exists(path.join(outputRoot, "AGENTS.md")),
      hasConfig: await exists(path.resolve(options.cwd, options.config)),
      hasLlmsTxt: await exists(path.join(outputRoot, "llms.txt")),
      hasSitemap: await hasSitemapDiscovery(
        path.join(outputRoot, "sources", "crawl-manifest.json"),
      ),
      taskPackFileIds: await readMarkdownFileIds(path.join(outputRoot, "task-packs")),
      usablePages: crawlQuality?.usable,
      unusablePages: crawlQuality?.unusable,
      degradedPages: ingestQuality?.degraded,
      skippedPages: ingestQuality?.skipped,
      expectedTaskIds: config?.tasks.map((task) => task.id),
      preferredFacets: config?.context.preferred,
    },
  }));
  const markdownPath = path.join(reportsDirectory, "agent-readiness.md");
  const jsonPath = path.join(reportsDirectory, "agent-readiness.json");
  await mkdir(reportsDirectory, { recursive: true });
  await writeFile(markdownPath, renderReadinessMarkdown(report), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { jsonPath, markdownPath, report };
}

async function readIngestQuality(
  filePath: string,
): Promise<{ degraded: number; skipped: number } | undefined> {
  try {
    const manifest = IngestManifestSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
    return { degraded: manifest.counts.degraded, skipped: manifest.counts.skipped };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw new DoctorError(`Invalid ingest manifest at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readOptionalConfig(filePath: string) {
  try {
    return parseConfig(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function readCrawlQuality(
  filePath: string,
): Promise<{ usable: number; unusable: number } | undefined> {
  try {
    const manifest = CrawlManifestSchema.parse(
      JSON.parse(await readFile(filePath, "utf8")),
    );
    return {
      usable: manifest.counts?.usable ?? manifest.pageCount,
      unusable: manifest.counts?.unusable ?? manifest.unusablePages?.length ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DoctorError(`Invalid crawl manifest at ${filePath}: ${message}`);
  }
}

async function hasSitemapDiscovery(filePath: string): Promise<boolean> {
  try {
    const manifest = CrawlManifestSchema.parse(
      JSON.parse(await readFile(filePath, "utf8")),
    );
    return manifest.discovery === "sitemap" || manifest.discovery === "hybrid";
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DoctorError(`Invalid crawl manifest at ${filePath}: ${message}`);
  }
}

async function readAgentMap(filePath: string): Promise<AgentMap | undefined> {
  try {
    return AgentMapSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DoctorError(`Invalid agent map at ${filePath}: ${message}`);
  }
}

function parseCategory(value?: string): ReadinessCategory | undefined {
  if (value === undefined) {
    return undefined;
  }
  const result = ReadinessCategorySchema.safeParse(value);
  if (!result.success) {
    throw new DoctorInputError(
      `Unknown doctor category "${value}". Expected one of: ${ReadinessCategorySchema.options.join(", ")}.`,
    );
  }
  return result.data;
}

async function readMarkdownFileIds(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((file) => file.endsWith(".md"))
      .map((file) => path.basename(file, ".md"))
      .sort(compareStrings);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

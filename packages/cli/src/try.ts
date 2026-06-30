import path from "node:path";

import {
  TryResultSchema,
  type TryResult,
} from "@agentdocs/shared";

import { buildFromSources, type BuildOptions } from "./build.js";
import { buildContextBundle } from "./context.js";
import { crawlToDisk } from "./crawl.js";
import { runDoctor } from "./doctor.js";
import { ingestLocalMarkdown } from "./ingest.js";

export type TryOptions = {
  config: string;
  cwd: string;
  exclude?: string[];
  goal: string;
  include?: string[];
  maxPages?: number;
  out: string;
  project?: BuildOptions["project"];
  rules?: string[];
  sitemap?: string;
  source: string;
  writeAgentsMd?: boolean;
  writeLlmsTxt?: boolean;
  writeManifest?: boolean;
  writeTaskPacks?: boolean;
  context?: BuildOptions["context"];
  mdxMode?: "tolerant" | "strict";
  tasks?: BuildOptions["tasks"];
};

export async function runTry(options: TryOptions): Promise<TryResult> {
  const sourceKind = isWebsiteUrl(options.source) ? "website" : "local_markdown";
  const crawl = sourceKind === "website"
    ? await crawlToDisk({
        cwd: options.cwd,
        exclude: options.exclude,
        goal: options.goal,
        include: options.include,
        maxPages: options.maxPages,
        out: options.out,
        sitemap: options.sitemap,
        startUrl: options.source,
        contextRules: options.context?.rules,
      })
    : undefined;
  if (sourceKind === "local_markdown") {
    await ingestLocalMarkdown({
      cwd: options.cwd,
      out: options.out,
      source: options.source,
      contextRules: options.context?.rules,
      mdxMode: options.mdxMode,
    });
  }

  const build = await buildFromSources({
    cwd: options.cwd,
    out: options.out,
    project: options.project,
    rules: options.rules,
    writeAgentsMd: options.writeAgentsMd,
    writeLlmsTxt: options.writeLlmsTxt,
    writeManifest: options.writeManifest,
    writeTaskPacks: options.writeTaskPacks,
    context: options.context,
    tasks: options.tasks,
  });
  const doctor = await runDoctor({
    config: options.config,
    cwd: options.cwd,
    out: options.out,
  });
  const context = await buildContextBundle({
    cwd: options.cwd,
    goal: options.goal,
    out: options.out,
  });

  return TryResultSchema.parse({
    source: { kind: sourceKind, value: options.source },
    crawl: crawl === undefined
      ? undefined
      : {
          discovery: crawl.discovery,
          scope: crawl.scope.pathPrefix
            ?? (crawl.scope.include.length > 0 ? crawl.scope.include.join(", ") : "/"),
          attempted: crawl.counts.attempted,
          collected: crawl.counts.collected,
          skipped: crawl.counts.skipped,
          failed: crawl.counts.failed,
          usable: crawl.counts.usable,
          unusable: crawl.counts.unusable,
          duplicateContent: crawl.counts.duplicateContent,
          discoveryRequests: crawl.counts.discoveryRequests,
          warnings: [
            ...crawl.warnings,
            ...(crawl.failures ?? []).slice(0, 10)
              .map((failure) => `${failure.reason}: ${failure.url} (${failure.message})`),
            ...(crawl.counts.unusable > 0
              ? [`extraction_quality: ${crawl.counts.unusable} fetched page(s) were unusable`]
              : []),
          ],
        },
    pageCount: build.pageCount,
    chunkCount: build.chunkCount,
    taskPackCount: build.taskPackCount,
    readiness: {
      score: doctor.report.score,
      pass: doctor.report.summary.pass,
      warn: doctor.report.summary.warn,
      fail: doctor.report.summary.fail,
      reportPath: displayPath(options.cwd, doctor.markdownPath),
    },
    context,
    next: {
      command: `agentdocs --out ${quoteArgument(options.out)} serve-mcp`,
      prompt: `Use the AgentDocs MCP server and ${options.goal}.`,
    },
  });
}

export function formatTryResult(result: TryResult): string {
  const crawl = result.crawl === undefined ? "" : `
Crawl: ${result.crawl.discovery}, scope ${result.crawl.scope}
Requests: ${result.crawl.attempted} attempted, ${result.crawl.collected} collected, ${result.crawl.skipped} skipped, ${result.crawl.failed} failed
Extraction: ${result.crawl.usable ?? result.crawl.collected} usable, ${result.crawl.unusable ?? 0} unusable, ${result.crawl.duplicateContent ?? 0} duplicate
${result.crawl.warnings.length === 0 ? "" : `Warnings:\n${result.crawl.warnings.map((warning) => `- ${warning}`).join("\n")}\n`}`;
  const selectedTaskPack = result.context.selectedTaskPack === undefined
    ? "Selected task pack: none"
    : `Selected task pack: ${result.context.selectedTaskPack.id} (${result.context.selectedTaskPack.confidence} confidence)`;
  const warnings = [
    ...(result.crawl?.warnings.map((warning) => `- ${warning}`) ?? []),
    ...result.context.goalBundle.warnings.map((warning) => `- ${warning.code}: ${warning.key}=${warning.values.join(",")}`),
    ...result.context.search.warnings.map((warning) => `- ${warning.code}: ${warning.key}=${warning.values.join(",")}`),
  ];
  const evidence = result.context.search.results.length === 0
    ? "- No matching search evidence found."
    : result.context.search.results.slice(0, 3).map((item) => {
        const source = item.sourceUrl ?? item.repoPath ?? "Unknown source";
        const heading = item.headingPath.length === 0 ? "" : ` > ${item.headingPath.join(" > ")}`;
        return `- ${item.title}${heading} (${source})`;
      }).join("\n");

  return `AgentDocs built context for ${result.source.value}
${crawl}
Pages: ${result.pageCount}
Chunks: ${result.chunkCount}
Task packs: ${result.taskPackCount}
Readiness: ${result.readiness.score}/100

Best context for goal "${result.context.goal}":
${result.context.readFirst.map((resource) => `- ${resource}`).join("\n")}

${selectedTaskPack}

Top source evidence:
${evidence}

Warnings:
${warnings.length === 0 ? "- No context warnings." : warnings.join("\n")}

Next:
1. Run: ${result.next.command}
2. In your coding agent, ask:
   "${result.next.prompt}"
`;
}

function isWebsiteUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function displayPath(cwd: string, filePath: string): string {
  return path.relative(path.resolve(cwd), path.resolve(filePath)).replaceAll("\\", "/") || ".";
}

function quoteArgument(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

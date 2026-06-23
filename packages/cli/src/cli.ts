import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseConfig } from "@agentdocs/shared";
import { Command, CommanderError, InvalidArgumentError } from "commander";

import { initConfig } from "./init.js";
import { ingestLocalMarkdown } from "./ingest.js";
import { crawlToDisk } from "./crawl.js";
import { BuildError, buildFromSources } from "./build.js";
import { assertBuildCheckPassed, formatBuildCheckReport, runBuildCheck } from "./check.js";
import { exportArtifacts } from "./export.js";
import { formatInspectResult, inspectAgentMap } from "./inspect.js";
import { cleanOutputDirectory, pruneRemovedSourceArtifacts } from "./lifecycle.js";
import { ReadinessThresholdError, runDoctor } from "./doctor.js";
import { formatTryResult, runTry } from "./try.js";
import { buildContextBundle, formatContextBundle } from "./context.js";
import {
  buildHandoffBundle,
  formatContextVerification,
  formatHandoffBundle,
  formatSetupSnippets,
  formatStatusReport,
  readStatusReport,
  setupSnippets,
  verifyContext,
  writeWorkflowBuildArtifacts,
} from "./workflow.js";
import { formatSearchResponse, searchIndex } from "@agentdocs/indexer";
import type { AgentDocsConfig } from "@agentdocs/shared";

type GlobalOptions = {
  config: string;
  cwd?: string;
  json?: boolean;
  out: string;
  quiet?: boolean;
  verbose?: boolean;
};

declare const __AGENTDOCS_VERSION__: string | undefined;

export const AGENTDOCS_VERSION = typeof __AGENTDOCS_VERSION__ === "string"
  ? __AGENTDOCS_VERSION__
  : "0.1.0-beta.1";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function facetRecord(values: string[]): Record<string, string> {
  return Object.fromEntries(values.map((value) => {
    const separator = value.indexOf("=");
    if (separator < 1 || separator === value.length - 1) {
      throw new InvalidArgumentError("facet must use key=value");
    }
    return [value.slice(0, separator), value.slice(separator + 1)];
  }));
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("must be an integer");
  }
  return parsed;
}

function parseScore(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new InvalidArgumentError("must be an integer from 0 to 100");
  }
  return parsed;
}

function parseClient(value: string): "codex" | "claude" | "cursor" | "generic" {
  if (value !== "codex" && value !== "claude" && value !== "cursor" && value !== "generic") {
    throw new InvalidArgumentError("client must be codex, claude, cursor, or generic");
  }
  return value;
}

export function createProgram(): Command {
  const program = new Command()
    .name("agentdocs")
    .description(
      "Deterministic, local-first tooling for agent-readable documentation.",
    )
    .version(AGENTDOCS_VERSION)
    .option(
      "--config <path>",
      "Path to AgentDocs config",
      "agentdocs.config.yaml",
    )
    .option("--out <path>", "Output directory", ".agentdocs")
    .option("--cwd <path>", "Working directory")
    .option("--json", "Emit JSON where supported")
    .option("--verbose", "Print detailed progress")
    .option("--quiet", "Suppress non-error logs")
    .option("--no-color", "Disable colored output");

  program
    .command("init")
    .description("Create a starter AgentDocs configuration")
    .option("--force", "Overwrite an existing config")
    .action(async (options: { force?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const outSource = command.parent?.getOptionValueSource("out");
      const configPath = await initConfig({
        config: globals.config,
        cwd: globals.cwd ?? process.cwd(),
        force: options.force ?? false,
        out: outSource === "cli" ? globals.out : undefined,
      });

      if (!globals.quiet) {
        process.stdout.write(`Created ${configPath}\n`);
      }
    });

  program
    .command("try <url-or-path>")
    .description("Build and audit agent context for a docs URL or local path")
    .requiredOption("--goal <goal>", "Implementation goal to find context for")
    .option("--max-pages <n>", "Maximum pages to crawl", parseInteger)
    .option("--include <glob>", "Include URL/path glob", collect, [])
    .option("--exclude <glob>", "Exclude URL/path glob", collect, [])
    .option("--sitemap <url>", "Explicit sitemap URL")
    .action(
      async (
        source: string,
        options: {
          exclude: string[];
          goal: string;
          include: string[];
          maxPages?: number;
          sitemap?: string;
        },
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const { config, configPath, cwd, out } = await resolveCommandContext(command, globals);
        const result = await runTry({
          config: globals.config,
          cwd,
          exclude: options.exclude,
          goal: options.goal,
          include: options.include,
          maxPages: options.maxPages,
          out,
          project: config === undefined
            ? undefined
            : { name: config.name, slug: config.slug, version: config.version },
          rules: config?.agent.rules,
          sitemap: options.sitemap,
          source,
          writeAgentsMd: config?.output.writeAgentsMd,
          writeLlmsTxt: config?.output.writeLlmsTxt,
          writeManifest: config?.output.writeMcpManifest,
          writeTaskPacks: config?.output.writeTaskPacks,
          context: config?.context,
          mdxMode: config?.normalization.mdx,
          tasks: config?.tasks,
        });
        await writeWorkflowBuildArtifacts({
          config,
          configPath,
          cwd,
          out,
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(formatTryResult(result));
        }
      },
    );

  program
    .command("context <goal>")
    .description("Build a compact agent context bundle from existing artifacts")
    .action(async (goal: string, _options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const { cwd, out } = await resolveCommandContext(command, globals);
      const result = await buildContextBundle({ cwd, goal, out });
      if (globals.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(formatContextBundle(result));
      }
    });

  program
    .command("handoff <goal>")
    .description("Build an agent-native task handoff from existing artifacts")
    .action(async (goal: string, _options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const { config, configPath, cwd, out } = await resolveCommandContext(command, globals);
      const result = await buildHandoffBundle({ config, configPath, cwd, out }, goal);
      if (globals.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(formatHandoffBundle(result));
      }
    });

  program
    .command("setup-agent")
    .description("Print MCP setup snippets for coding-agent clients")
    .option("--client <client>", "Client to print: codex, claude, cursor, or generic", parseClient)
    .action(async (options: { client?: "codex" | "claude" | "cursor" | "generic" }, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const { out } = await resolveCommandContext(command, globals);
      const snippets = setupSnippets(out, options.client);
      if (globals.json) {
        process.stdout.write(`${JSON.stringify({ snippets })}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(formatSetupSnippets(snippets));
      }
    });

  program
    .command("status")
    .description("Check whether built AgentDocs artifacts are fresh")
    .action(async (_options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const { config, configPath, cwd, out } = await resolveCommandContext(command, globals);
      const result = await readStatusReport({ config, configPath, cwd, out });
      if (globals.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(formatStatusReport(result));
      }
    });

  program
    .command("verify-context")
    .description("Verify that task context is fresh, consistent, and evidence-backed")
    .requiredOption("--task <goal>", "Task or implementation goal to verify")
    .option("--facet <key=value>", "Hard context facet filter", collect, [])
    .action(async (options: { facet: string[]; task: string }, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const { config, configPath, cwd, out } = await resolveCommandContext(command, globals);
      const result = await verifyContext(
        { config, configPath, cwd, out },
        options.task,
        facetRecord(options.facet),
      );
      if (globals.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(formatContextVerification(result));
      }
    });

  program
    .command("crawl <url>")
    .description("Crawl a documentation website")
    .option("--max-pages <n>", "Maximum pages to crawl", parseInteger)
    .option("--include <glob>", "Include URL/path glob", collect, [])
    .option("--exclude <glob>", "Exclude URL/path glob", collect, [])
    .option("--respect-robots", "Respect robots.txt where supported")
    .option("--sitemap <url>", "Explicit sitemap URL")
    .option("--user-agent <value>", "Custom user agent")
    .option("--timeout-ms <n>", "Request timeout", parseInteger)
    .action(
      async (
        startUrl: string,
        options: {
          exclude: string[];
          include: string[];
          maxPages?: number;
          respectRobots?: boolean;
          sitemap?: string;
          timeoutMs?: number;
          userAgent?: string;
        },
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const context = await resolveCommandContext(command, globals);
        const result = await crawlToDisk({
          ...options,
          cwd: context.cwd,
          out: context.out,
          startUrl,
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(
            `Crawled ${result.pageCount} useful page(s) using ${result.discovery} discovery within ${result.scope.pathPrefix ?? (result.scope.include.join(", ") || "/")} (${result.counts.unusable} unusable, ${result.counts.duplicateContent} duplicate, ${result.counts.failed} failed) to ${result.manifestPath}\n${result.warnings.length === 0 ? "" : `Warnings:\n${result.warnings.map((warning) => `- ${warning}`).join("\n")}\n`}`,
          );
        }
      },
    );

  program
    .command("ingest <path>")
    .description("Ingest a local documentation source")
    .option("--max-files <n>", "Maximum docs-like files to consider", parseInteger)
    .option("--max-bytes <n>", "Maximum bytes of supported Markdown/MDX to read", parseInteger)
    .option("--max-pages <n>", "Maximum supported pages to ingest", parseInteger)
    .option("--max-elapsed-ms <n>", "Maximum elapsed time for local ingestion", parseInteger)
    .option("--strict", "Fail on unsupported MDX instead of using the tolerant fallback")
    .action(async (
      source: string,
      options: {
        maxBytes?: number;
        maxElapsedMs?: number;
        maxFiles?: number;
        maxPages?: number;
        strict?: boolean;
      },
      command: Command,
    ) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const context = await resolveCommandContext(command, globals);
      const result = await ingestLocalMarkdown({
        cwd: context.cwd,
        out: context.out,
        source,
        limits: limitOptions(options),
        mdxMode: options.strict ? "strict" : context.config?.normalization.mdx,
        onProgress: progressLogger(globals),
      });

      if (globals.json) {
        process.stdout.write(
          `${JSON.stringify({
            manifestPath: result.manifestPath,
            pageCount: result.pages.length,
            counts: result.manifest.counts,
            sourceCoverage: result.manifest.sourceCoverage,
            limits: result.manifest.limits,
            diagnostics: result.manifest.diagnostics,
          })}\n`,
        );
      } else if (!globals.quiet) {
        process.stdout.write(
          `Ingested ${result.pages.length} page(s) to ${result.manifestPath} (${result.manifest.counts.degraded} degraded, ${result.manifest.counts.skipped} skipped, ${result.manifest.counts.failed} failed; source coverage ${Math.round(result.manifest.sourceCoverage.coverageRatio * 100)}%, ${result.manifest.sourceCoverage.gapSeverity})\n${result.manifest.diagnostics.filter((item) => item.status !== "usable").map((item) => `- ${item.repoPath}: ${item.status}${item.message === undefined ? "" : `: ${item.message}`}${item.warnings.length === 0 ? "" : ` (${item.warnings.join(" ")})`}`).join("\n")}${result.manifest.diagnostics.some((item) => item.status !== "usable") ? "\n" : ""}`,
        );
      }
    });

  program
    .command("build")
    .description("Build AgentDocs artifacts")
    .option("--check", "Check whether built artifacts are fresh without writing files")
    .option("--clean", "Clean generated state before building")
    .option("--skip-crawl", "Build without crawling configured website sources")
    .action(
      async (
        options: { check?: boolean; clean?: boolean; skipCrawl?: boolean },
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const { config, configPath, cwd, out } = await resolveCommandContext(command, globals);
        if (options.check) {
          if (options.clean) {
            throw new CommanderError(
              2,
              "agentdocs.checkCleanConflict",
              'The "build --check" option cannot be combined with "--clean".',
            );
          }
          const report = await runBuildCheck({ config, configPath, cwd, out });
          if (globals.json) {
            process.stdout.write(`${JSON.stringify(report)}\n`);
          } else if (!globals.quiet) {
            process.stdout.write(formatBuildCheckReport(report));
          }
          assertBuildCheckPassed(report);
          return;
        }
        if (options.clean) {
          await cleanOutputDirectory(cwd, out);
        } else {
          await pruneRemovedSourceArtifacts(config, cwd, out);
        }
        await collectConfiguredSources(config, cwd, out, options.skipCrawl ?? false, undefined, progressLogger(globals));
        const result = await buildFromSources({
          cwd,
          out,
          project: config === undefined
            ? undefined
            : { name: config.name, slug: config.slug, version: config.version },
          rules: config?.agent.rules,
          writeAgentsMd: config?.output.writeAgentsMd,
          writeLlmsTxt: config?.output.writeLlmsTxt,
          writeManifest: config?.output.writeMcpManifest,
          writeTaskPacks: config?.output.writeTaskPacks,
          context: config?.context,
          tasks: config?.tasks,
        });
        await writeWorkflowBuildArtifacts({ config, configPath, cwd, out });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(
            `Built ${result.chunkCount} chunk(s), ${result.entityCount} entities, ${result.edgeCount} edges, and ${result.taskPackCount} task pack(s) from ${result.pageCount} page(s) to ${result.agentMapPath}${result.sourceCoverage === undefined ? "" : `\nSource coverage: ${Math.round(result.sourceCoverage.coverageRatio * 100)}% (${result.sourceCoverage.gapSeverity}${result.sourceCoverage.gapReason === undefined ? "" : `, ${result.sourceCoverage.gapReason}`})`}\n`,
          );
        }
      },
    );

  program
    .command("rebuild")
    .description("Rebuild AgentDocs artifacts")
    .option("--changed", "Recollect only stale configured sources before building")
    .action(async (options: { changed?: boolean }, command: Command) => {
      if (options.changed !== true) {
        throw new CommanderError(
          1,
          "agentdocs.rebuildRequiresChanged",
          'The "rebuild" command currently requires --changed.',
        );
      }
      const globals = command.optsWithGlobals<GlobalOptions>();
      const { config, configPath, cwd, out } = await resolveCommandContext(command, globals);
      if (config === undefined) {
        throw new BuildError('The "rebuild --changed" command requires agentdocs.config.yaml.');
      }
      const status = await readStatusReport({ config, configPath, cwd, out });
      const staleSourceKeys = status.sources.length === 0 || status.state === "unknown"
        ? undefined
        : new Set(status.sources
          .filter((source) => source.state !== "fresh")
          .map((source) => `${source.type}:${source.value}`));
      await pruneRemovedSourceArtifacts(config, cwd, out);
      if (staleSourceKeys === undefined || staleSourceKeys.size > 0) {
        await collectConfiguredSources(config, cwd, out, false, staleSourceKeys, progressLogger(globals));
      }
      const result = await buildFromSources({
        cwd,
        out,
        project: { name: config.name, slug: config.slug, version: config.version },
        rules: config.agent.rules,
        writeAgentsMd: config.output.writeAgentsMd,
        writeLlmsTxt: config.output.writeLlmsTxt,
        writeManifest: config.output.writeMcpManifest,
        writeTaskPacks: config.output.writeTaskPacks,
        context: config.context,
        tasks: config.tasks,
      });
      await writeWorkflowBuildArtifacts({ config, configPath, cwd, out });
      if (globals.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(
          `Rebuilt ${result.chunkCount} chunk(s), ${result.entityCount} entities, ${result.edgeCount} edges, and ${result.taskPackCount} task pack(s) from ${result.pageCount} page(s) to ${result.agentMapPath}${result.sourceCoverage === undefined ? "" : `\nSource coverage: ${Math.round(result.sourceCoverage.coverageRatio * 100)}% (${result.sourceCoverage.gapSeverity}${result.sourceCoverage.gapReason === undefined ? "" : `, ${result.sourceCoverage.gapReason}`})`}\n`,
        );
      }
    });

  program
    .command("watch")
    .description("Poll for stale AgentDocs sources and rebuild when needed")
    .option("--interval-ms <n>", "Polling interval", parseInteger, 2000)
    .option("--once", "Run one polling cycle and exit")
    .action(async (options: { intervalMs: number; once?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const context = await resolveCommandContext(command, globals);
      if (context.config === undefined) {
        throw new BuildError('The "watch" command requires agentdocs.config.yaml.');
      }
      do {
        const status = await readStatusReport(context);
        if (!globals.quiet) {
          process.stdout.write(`AgentDocs watch: ${status.state}\n`);
        }
        if (status.state !== "fresh") {
          await pruneRemovedSourceArtifacts(context.config, context.cwd, context.out);
          await collectConfiguredSources(context.config, context.cwd, context.out, false, undefined, progressLogger(globals));
          await buildFromSources({
            cwd: context.cwd,
            out: context.out,
            project: { name: context.config.name, slug: context.config.slug, version: context.config.version },
            rules: context.config.agent.rules,
            writeAgentsMd: context.config.output.writeAgentsMd,
            writeLlmsTxt: context.config.output.writeLlmsTxt,
            writeManifest: context.config.output.writeMcpManifest,
            writeTaskPacks: context.config.output.writeTaskPacks,
            context: context.config.context,
            tasks: context.config.tasks,
          });
          await writeWorkflowBuildArtifacts(context);
        }
        if (options.once === true) {
          break;
        }
        await delay(options.intervalMs);
      } while (true);
    });

  program
    .command("doctor")
    .description("Run agent-readiness checks")
    .option("--min-score <n>", "Fail below this score", parseScore)
    .option("--category <name>", "Run one category only")
    .action(
      async (
        options: { category?: string; minScore?: number },
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const { config, cwd, out } = await resolveCommandContext(command, globals);
        const result = await runDoctor({
          category: options.category,
          config: globals.config,
          cwd,
          out,
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(result.report)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(
            `Agent-readiness: ${result.report.score}/100 (${result.report.summary.pass} pass, ${result.report.summary.warn} warn, ${result.report.summary.fail} fail)\nReport: ${result.markdownPath}\n`,
          );
        }
        const minScore = options.minScore ?? config?.doctor.minScore;
        if (minScore !== undefined && result.report.score < minScore) {
          throw new ReadinessThresholdError(
            `Agent-readiness score ${result.report.score} is below the required minimum of ${minScore}.`,
          );
        }
        const policyFailures = [
          config?.doctor.failOnBrokenLinks
            && result.report.checks.find((check) => check.id === "has_broken_internal_links")?.status === "fail"
            ? "broken internal links"
            : undefined,
          config?.doctor.failOnMissingTaskPacks
            && result.report.checks.find((check) => check.id === "has_task_packs")?.status === "fail"
            ? "missing task packs"
            : undefined,
        ].filter((value): value is string => value !== undefined);
        if (policyFailures.length > 0) {
          throw new ReadinessThresholdError(
            `Agent-readiness policy failed: ${policyFailures.join(", ")}.`,
          );
        }
      },
    );

  program
    .command("search <query>")
    .description("Search the local documentation index")
    .option("--limit <n>", "Maximum results to return", parseInteger)
    .option("--facet <key=value>", "Hard context facet filter", collect, [])
    .action(
      async (
        query: string,
        options: { limit?: number; facet: string[] },
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const context = await resolveCommandContext(command, globals);
        const response = await searchIndex({
          cwd: context.cwd,
          limit: options.limit,
          out: context.out,
          query,
          facets: facetRecord(options.facet),
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(response)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(formatSearchResponse(response));
        }
      },
    );

  program
    .command("inspect <target> [id]")
    .description("Inspect generated AgentDocs state")
    .action(async (target: string, id: string | undefined, _options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const context = await resolveCommandContext(command, globals);
      const result = await inspectAgentMap({
        cwd: context.cwd,
        id,
        out: context.out,
        target,
      });
      if (globals.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(formatInspectResult(result));
      }
    });

  program
    .command("export")
    .description("Export generated artifacts")
    .requiredOption("--format <format>", "Export format: static or llms")
    .requiredOption("--to <path>", "Export destination")
    .option("--force", "Replace a non-empty export destination")
    .action(async (options: { force?: boolean; format: string; to: string }, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const { cwd, out } = await resolveCommandContext(command, globals);
      const result = await exportArtifacts({
        cwd,
        force: options.force,
        format: options.format,
        out,
        to: options.to,
      });
      if (globals.json) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } else if (!globals.quiet) {
        process.stdout.write(
          `Exported ${result.format} AgentDocs artifacts from ${result.source} to ${result.destination}\n`,
        );
      }
    });

  program
    .command("serve-mcp")
    .description("Start the local AgentDocs MCP server")
    .action(async (_options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const context = await resolveCommandContext(command, globals);
      const { serveAgentDocsMcp } = await import("@agentdocs/mcp-server");
      await serveAgentDocsMcp({
        cwd: context.cwd,
        out: context.out,
        version: AGENTDOCS_VERSION,
      });
    });

  return program;
}

async function collectConfiguredSources(
  config: AgentDocsConfig | undefined,
  cwd: string,
  out: string,
  skipCrawl: boolean,
  onlySourceKeys?: Set<string>,
  onProgress?: (event: { message: string }) => void,
): Promise<void> {
  if (config === undefined) {
    return;
  }
  for (const source of config.sources) {
    const sourceValue = source.type === "website" ? source.url : source.path;
    if (onlySourceKeys !== undefined && !onlySourceKeys.has(`${source.type}:${sourceValue}`)) {
      continue;
    }
    if (source.type === "local_markdown") {
      await ingestLocalMarkdown({
        cwd,
        out,
        preserveSourcePath: true,
        source: source.path,
        include: source.include,
        exclude: source.exclude,
        facets: source.facets,
        contextRules: config.context.rules,
        mdxMode: config.normalization.mdx,
        limits: source.limits,
        onProgress: prefixProgress(onProgress, `local_markdown ${source.path}`),
      });
      continue;
    }
    if (source.type === "repo") {
      await ingestLocalMarkdown({
        cwd,
        out,
        source: source.path,
        sourceType: "repo",
        include: source.include,
        exclude: source.exclude,
        facets: source.facets,
        contextRules: config.context.rules,
        mdxMode: config.normalization.mdx,
        limits: source.limits,
        onProgress: prefixProgress(onProgress, `repo ${source.path}`),
      });
      continue;
    }
    if (source.type === "website") {
      if (!skipCrawl) {
        await crawlToDisk({
          cwd,
          out,
          startUrl: source.url,
          include: source.include,
          exclude: source.exclude,
          sitemap: source.sitemap,
          facets: source.facets,
          contextRules: config.context.rules,
        });
      }
      continue;
    }
    throw new BuildError(
      `Configured ${source.type} sources are not implemented yet. Remove the source or use a supported local_markdown, repo, or website source.`,
    );
  }
}

async function readOptionalConfig(configPath: string) {
  try {
    return parseConfig(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function resolveConfiguredOut(
  command: Command,
  cliOut: string,
  configuredOut?: string,
): string {
  return command.parent?.getOptionValueSource("out") === "cli"
    ? cliOut
    : configuredOut ?? cliOut;
}

async function resolveCommandContext(command: Command, globals: GlobalOptions) {
  const cwd = globals.cwd ?? process.cwd();
  const configPath = path.resolve(cwd, globals.config);
  const config = await readOptionalConfig(configPath);
  return {
    config,
    configPath,
    cwd,
    out: resolveConfiguredOut(command, globals.out, config?.output.dir),
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function limitOptions(options: {
  maxBytes?: number;
  maxElapsedMs?: number;
  maxFiles?: number;
  maxPages?: number;
}) {
  return {
    maxBytes: options.maxBytes,
    maxElapsedMs: options.maxElapsedMs,
    maxFiles: options.maxFiles,
    maxPages: options.maxPages,
  };
}

function progressLogger(globals: GlobalOptions) {
  return globals.verbose === true && globals.quiet !== true
    ? (event: { message: string }) => {
      process.stderr.write(`agentdocs: ${event.message}\n`);
    }
    : undefined;
}

function prefixProgress(
  logger: ((event: { message: string }) => void) | undefined,
  prefix: string,
) {
  return logger === undefined
    ? undefined
    : (event: { message: string }) => logger({ message: `${prefix}: ${event.message}` });
}

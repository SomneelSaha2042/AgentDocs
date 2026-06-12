import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { ConfigValidationError, parseConfig } from "@agentdocs/shared";
import { Command, CommanderError, InvalidArgumentError } from "commander";

import { initConfig } from "./init.js";
import { ingestLocalMarkdown } from "./ingest.js";
import { crawlToDisk } from "./crawl.js";
import { BuildError, buildFromSources } from "./build.js";
import { formatInspectResult, inspectAgentMap } from "./inspect.js";
import { ReadinessThresholdError, runDoctor } from "./doctor.js";
import { formatTryResult, runTry } from "./try.js";
import { buildContextBundle, formatContextBundle } from "./context.js";
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

function addPlaceholderAction(command: Command): Command {
  return command.action(async (_options: unknown, actionCommand: Command) => {
    const globals = actionCommand.optsWithGlobals<GlobalOptions>();
    const configPath = path.resolve(
      globals.cwd ?? process.cwd(),
      globals.config,
    );
    let contents: string;
    try {
      contents = await readFile(configPath, "utf8");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new ConfigValidationError(
          `Config not found at ${configPath}. Run "agentdocs init" first or pass --config <path>.`,
        );
      }
      throw error;
    }
    parseConfig(contents);

    throw new CommanderError(
      1,
      "agentdocs.commandNotImplemented",
      `The "${command.name()}" command is not implemented yet.`,
    );
  });
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
        const { config, cwd, out } = await resolveCommandContext(command, globals);
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
    .option("--strict", "Fail on unsupported MDX instead of using the tolerant fallback")
    .action(async (source: string, options: { strict?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const context = await resolveCommandContext(command, globals);
      const result = await ingestLocalMarkdown({
        cwd: context.cwd,
        out: context.out,
        source,
        mdxMode: options.strict ? "strict" : context.config?.normalization.mdx,
      });

      if (globals.json) {
        process.stdout.write(
          `${JSON.stringify({
            manifestPath: result.manifestPath,
            pageCount: result.pages.length,
            counts: result.manifest.counts,
            diagnostics: result.manifest.diagnostics,
          })}\n`,
        );
      } else if (!globals.quiet) {
        process.stdout.write(
          `Ingested ${result.pages.length} page(s) to ${result.manifestPath} (${result.manifest.counts.degraded} degraded, ${result.manifest.counts.skipped} skipped, ${result.manifest.counts.failed} failed)\n${result.manifest.diagnostics.filter((item) => item.status !== "usable").map((item) => `- ${item.repoPath}: ${item.status}${item.message === undefined ? "" : `: ${item.message}`}${item.warnings.length === 0 ? "" : ` (${item.warnings.join(" ")})`}`).join("\n")}${result.manifest.diagnostics.some((item) => item.status !== "usable") ? "\n" : ""}`,
        );
      }
    });

  program
    .command("build")
    .description("Build AgentDocs artifacts")
    .option("--clean", "Clean generated state before building")
    .option("--skip-crawl", "Build without crawling configured website sources")
    .action(
      async (
        options: { clean?: boolean; skipCrawl?: boolean },
        command: Command,
      ) => {
        if (options.clean) {
          throw new CommanderError(
            1,
            "agentdocs.cleanNotImplemented",
            'The "build --clean" option is not implemented yet.',
          );
        }
        const globals = command.optsWithGlobals<GlobalOptions>();
        const { config, cwd, out } = await resolveCommandContext(command, globals);
        await collectConfiguredSources(config, cwd, out, options.skipCrawl ?? false);
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
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(
            `Built ${result.chunkCount} chunk(s), ${result.entityCount} entities, ${result.edgeCount} edges, and ${result.taskPackCount} task pack(s) from ${result.pageCount} page(s) to ${result.agentMapPath}\n`,
          );
        }
      },
    );

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

  addPlaceholderAction(
    program
      .command("export")
      .description("Export generated artifacts")
      .requiredOption("--format <format>", "Export format")
      .requiredOption("--to <path>", "Export destination"),
  );

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
): Promise<void> {
  if (config === undefined) {
    return;
  }
  for (const source of config.sources) {
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
  const config = await readOptionalConfig(path.resolve(cwd, globals.config));
  return {
    config,
    cwd,
    out: resolveConfiguredOut(command, globals.out, config?.output.dir),
  };
}

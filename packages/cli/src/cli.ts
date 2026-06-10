import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { ConfigValidationError, parseConfig } from "@agentdocs/shared";
import { Command, CommanderError, InvalidArgumentError } from "commander";

import { initConfig } from "./init.js";
import { ingestLocalMarkdown } from "./ingest.js";
import { crawlToDisk } from "./crawl.js";
import { buildFromSources } from "./build.js";

type GlobalOptions = {
  config: string;
  cwd?: string;
  json?: boolean;
  out: string;
  quiet?: boolean;
  verbose?: boolean;
};

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("must be an integer");
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
    .version("0.0.0")
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
        const result = await crawlToDisk({
          ...options,
          cwd: globals.cwd ?? process.cwd(),
          out: globals.out,
          startUrl,
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(
            `Crawled ${result.pageCount} page(s) to ${result.manifestPath}\n`,
          );
        }
      },
    );

  program
    .command("ingest <path>")
    .description("Ingest a local documentation source")
    .action(async (source: string, _options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const result = await ingestLocalMarkdown({
        cwd: globals.cwd ?? process.cwd(),
        out: globals.out,
        source,
      });

      if (globals.json) {
        process.stdout.write(
          `${JSON.stringify({
            manifestPath: result.manifestPath,
            pageCount: result.pages.length,
          })}\n`,
        );
      } else if (!globals.quiet) {
        process.stdout.write(
          `Ingested ${result.pages.length} page(s) to ${result.manifestPath}\n`,
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
        const result = await buildFromSources({
          cwd: globals.cwd ?? process.cwd(),
          out: globals.out,
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(result)}\n`);
        } else if (!globals.quiet) {
          process.stdout.write(
            `Built ${result.chunkCount} chunk(s) from ${result.pageCount} page(s) to ${result.chunksPath}\n`,
          );
        }
      },
    );

  addPlaceholderAction(
    program
      .command("doctor")
      .description("Run agent-readiness checks")
      .option("--min-score <n>", "Fail below this score", parseInteger)
      .option("--category <name>", "Run one category only"),
  );

  addPlaceholderAction(
    program
      .command("search <query>")
      .description("Search the local documentation index"),
  );

  addPlaceholderAction(
    program
      .command("inspect <target>")
      .description("Inspect generated AgentDocs state"),
  );

  addPlaceholderAction(
    program
      .command("export")
      .description("Export generated artifacts")
      .requiredOption("--format <format>", "Export format")
      .requiredOption("--to <path>", "Export destination"),
  );

  addPlaceholderAction(
    program.command("serve-mcp").description("Start the local AgentDocs MCP server"),
  );

  return program;
}

import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseConfig } from "@agentdocs/shared";
import { Command } from "commander";
import { describe, expect, it } from "vitest";

import { createProgram } from "./cli.js";
import { InitConfigError } from "./init.js";

describe("agentdocs CLI", () => {
  it("lists the Phase 1 commands", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("Usage: agentdocs");
    expect(help).toContain("try [options] <url-or-path>");
    expect(help).toContain("context <goal>");
    expect(help).toContain("crawl [options] <url>");
    expect(help).toContain("ingest <path>");
    expect(help).toContain("serve-mcp");
  });

  it("documents command-specific options", () => {
    const crawl = createProgram().commands.find((command) => command.name() === "crawl");
    const tryCommand = createProgram().commands.find(
      (command) => command.name() === "try",
    );
    const doctor = createProgram().commands.find(
      (command) => command.name() === "doctor",
    );
    const search = createProgram().commands.find(
      (command) => command.name() === "search",
    );
    const serveMcp = createProgram().commands.find(
      (command) => command.name() === "serve-mcp",
    );

    expect(crawl?.helpInformation()).toContain("--max-pages <n>");
    expect(tryCommand?.helpInformation()).toContain("--goal <goal>");
    expect(tryCommand?.helpInformation()).toContain("--max-pages <n>");
    expect(crawl?.helpInformation()).toContain("--include <glob>");
    expect(doctor?.helpInformation()).toContain("--min-score <n>");
    expect(search?.helpInformation()).toContain("--limit <n>");
    expect(serveMcp?.description()).toContain("local AgentDocs MCP server");
  });

  it("creates a schema-valid starter config in --out", async () => {
    const cwd = await createTemporaryDirectory();
    const program = createProgram().exitOverride();
    program.configureOutput({ writeOut: () => undefined });

    await program.parseAsync([
      "node",
      "agentdocs",
      "--cwd",
      cwd,
      "--quiet",
      "init",
      "--out",
      "generated",
    ]);

    const contents = await readFile(
      path.join(cwd, "generated", "agentdocs.config.yaml"),
      "utf8",
    );
    expect(parseConfig(contents).slug).toBe("my-project");
    expect(contents).toContain("# Website source example:");
    expect(contents).toContain("# OpenAPI source example:");
    expect(contents).toContain("# Repository source example:");
  });

  it("requires --force before overwriting a config", async () => {
    const cwd = await createTemporaryDirectory();

    await createProgram()
      .exitOverride()
      .parseAsync(["node", "agentdocs", "--cwd", cwd, "--quiet", "init"]);

    await expect(
      createProgram()
        .exitOverride()
        .parseAsync(["node", "agentdocs", "--cwd", cwd, "--quiet", "init"]),
    ).rejects.toThrowError(InitConfigError);

    await expect(
      createProgram()
        .exitOverride()
        .parseAsync([
          "node",
          "agentdocs",
          "--cwd",
          cwd,
          "--quiet",
          "init",
          "--force",
        ]),
    ).resolves.toBeInstanceOf(Command);
  });

  it("uses configured output unless --out is explicit", async () => {
    const cwd = await createTemporaryDirectory();
    await writeFile(path.join(cwd, "agentdocs.config.yaml"), `
name: Example
slug: example
sources:
  - type: local_markdown
    path: ./docs
output:
  dir: configured-output
doctor:
  minScore: 0
`, "utf8");

    await createProgram().exitOverride().parseAsync([
      "node",
      "agentdocs",
      "--cwd",
      cwd,
      "--quiet",
      "doctor",
    ]);
    await expect(readFile(
      path.join(cwd, "configured-output", "reports", "agent-readiness.json"),
      "utf8",
    )).resolves.toContain('"score"');

    await createProgram().exitOverride().parseAsync([
      "node",
      "agentdocs",
      "--cwd",
      cwd,
      "--out",
      "explicit-output",
      "--quiet",
      "doctor",
    ]);
    await expect(readFile(
      path.join(cwd, "explicit-output", "reports", "agent-readiness.json"),
      "utf8",
    )).resolves.toContain('"score"');
  });

  it("creates parent directories for nested config paths", async () => {
    const cwd = await createTemporaryDirectory();

    await createProgram().exitOverride().parseAsync([
      "node",
      "agentdocs",
      "--cwd",
      cwd,
      "--config",
      ".config/agentdocs.yaml",
      "--quiet",
      "init",
    ]);

    await expect(readFile(path.join(cwd, ".config", "agentdocs.yaml"), "utf8"))
      .resolves.toContain("slug: my-project");
  });

  it("builds configured local sources without a separate ingest command", async () => {
    const cwd = await createTemporaryDirectory();
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(cwd, "docs", "drafts"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "README.md"), "# Configured Docs\n\n## Install\n\nInstall the configured package before using the SDK.\n", "utf8");
    await writeFile(path.join(cwd, "docs", "drafts", "hidden.md"), "# Hidden\n", "utf8");
    await writeFile(path.join(cwd, "agentdocs.config.yaml"), `
name: Configured Docs
slug: configured-docs
sources:
  - type: local_markdown
    path: ./docs
    include: ["**/*.md"]
    exclude: ["**/drafts/**"]
doctor:
  minScore: 0
`, "utf8");

    await createProgram().exitOverride().parseAsync([
      "node",
      "agentdocs",
      "--cwd",
      cwd,
      "--quiet",
      "build",
    ]);

    const map = JSON.parse(
      await readFile(path.join(cwd, ".agentdocs", "agent-map.json"), "utf8"),
    );
    expect(map.pages.map((page: { repoPath: string }) => page.repoPath))
      .toEqual(["docs/README.md"]);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "agentdocs-cli-"));
}

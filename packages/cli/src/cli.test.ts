import { readFile } from "node:fs/promises";
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
    expect(help).toContain("crawl [options] <url>");
    expect(help).toContain("ingest <path>");
    expect(help).toContain("serve-mcp");
  });

  it("documents command-specific options", () => {
    const crawl = createProgram().commands.find((command) => command.name() === "crawl");
    const doctor = createProgram().commands.find(
      (command) => command.name() === "doctor",
    );

    expect(crawl?.helpInformation()).toContain("--max-pages <n>");
    expect(crawl?.helpInformation()).toContain("--include <glob>");
    expect(doctor?.helpInformation()).toContain("--min-score <n>");
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
});

async function createTemporaryDirectory(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "agentdocs-cli-"));
}

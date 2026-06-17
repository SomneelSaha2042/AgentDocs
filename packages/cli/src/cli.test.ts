import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
    expect(help).toContain("handoff <goal>");
    expect(help).toContain("setup-agent");
    expect(help).toContain("status");
    expect(help).toContain("verify-context");
    expect(help).toContain("rebuild");
    expect(help).toContain("watch");
    expect(help).toContain("crawl [options] <url>");
    expect(help).toContain("ingest [options] <path>");
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
    const ingest = createProgram().commands.find((command) => command.name() === "ingest");
    const serveMcp = createProgram().commands.find(
      (command) => command.name() === "serve-mcp",
    );
    const setupAgent = createProgram().commands.find(
      (command) => command.name() === "setup-agent",
    );
    const verifyContext = createProgram().commands.find(
      (command) => command.name() === "verify-context",
    );

    expect(crawl?.helpInformation()).toContain("--max-pages <n>");
    expect(tryCommand?.helpInformation()).toContain("--goal <goal>");
    expect(tryCommand?.helpInformation()).toContain("--max-pages <n>");
    expect(crawl?.helpInformation()).toContain("--include <glob>");
    expect(doctor?.helpInformation()).toContain("--min-score <n>");
    expect(search?.helpInformation()).toContain("--limit <n>");
    expect(ingest?.helpInformation()).toContain("--strict");
    expect(serveMcp?.description()).toContain("local AgentDocs MCP server");
    expect(setupAgent?.helpInformation()).toContain("--client <client>");
    expect(verifyContext?.helpInformation()).toContain("--task <goal>");
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

  it("cleans generated output before building when requested", async () => {
    const cwd = await createConfiguredDocsProject();
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);
    await writeFile(path.join(cwd, ".agentdocs", "stale.txt"), "stale\n", "utf8");
    const sourceBefore = await readFile(path.join(cwd, "docs", "one.md"), "utf8");

    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build", "--clean",
    ]);

    await expect(access(path.join(cwd, ".agentdocs", "stale.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(cwd, ".agentdocs", "agent-map.json"))).resolves.toBeUndefined();
    expect(await readFile(path.join(cwd, "docs", "one.md"), "utf8")).toBe(sourceBefore);
  });

  it("refuses to clean unsafe output directories", async () => {
    const cwd = await createConfiguredDocsProject(".");

    await expect(createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build", "--clean",
    ])).rejects.toThrowError(/project root/i);

    await expect(access(path.join(cwd, "docs", "one.md"))).resolves.toBeUndefined();
  });

  it("prunes artifacts from removed configured sources", async () => {
    const cwd = await createConfiguredDocsProject();
    await writeFile(path.join(cwd, "agentdocs.config.yaml"), `
name: Configured Docs
slug: configured-docs
sources:
  - type: local_markdown
    path: ./docs/one.md
  - type: local_markdown
    path: ./docs/two.md
doctor:
  minScore: 0
`, "utf8");
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);

    await writeFile(path.join(cwd, "agentdocs.config.yaml"), `
name: Configured Docs
slug: configured-docs
sources:
  - type: local_markdown
    path: ./docs/one.md
doctor:
  minScore: 0
`, "utf8");
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);

    const map = JSON.parse(await readFile(path.join(cwd, ".agentdocs", "agent-map.json"), "utf8"));
    expect(map.pages.map((page: { repoPath: string }) => page.repoPath)).toEqual(["docs/one.md"]);
    const pageFiles = await readdir(path.join(cwd, ".agentdocs", "sources", "pages"));
    expect(pageFiles.filter((file) => file.endsWith(".json"))).toHaveLength(1);
  });

  it("exports static and llms artifact sets", async () => {
    const cwd = await createConfiguredDocsProject();
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "doctor", "--min-score", "0",
    ]);

    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "export", "--format", "static", "--to", "dist-agentdocs",
    ]);
    await expect(access(path.join(cwd, "dist-agentdocs", "agent-map.json"))).resolves.toBeUndefined();
    await expect(access(path.join(cwd, "dist-agentdocs", "sources", "pages"))).resolves.toBeUndefined();

    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "export", "--format", "llms", "--to", "public-agentdocs",
    ]);
    await expect(access(path.join(cwd, "public-agentdocs", "agent-map.json"))).resolves.toBeUndefined();
    await expect(access(path.join(cwd, "public-agentdocs", "task-packs"))).resolves.toBeUndefined();
    await expect(access(path.join(cwd, "public-agentdocs", "reports", "agent-readiness.md"))).resolves.toBeUndefined();
    await expect(access(path.join(cwd, "public-agentdocs", "sources"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(cwd, "public-agentdocs", "index.sqlite"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires --force before replacing a non-empty export destination", async () => {
    const cwd = await createConfiguredDocsProject();
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);
    await mkdir(path.join(cwd, "exported"), { recursive: true });
    await writeFile(path.join(cwd, "exported", "old.txt"), "old\n", "utf8");

    await expect(createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "export", "--format", "llms", "--to", "exported",
    ])).rejects.toThrowError(/not empty/i);

    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "export", "--format", "llms", "--to", "exported", "--force",
    ]);
    await expect(access(path.join(cwd, "exported", "old.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(cwd, "exported", "agent-map.json"))).resolves.toBeUndefined();
  });

  it("rejects export destinations inside the active output directory", async () => {
    const cwd = await createConfiguredDocsProject();
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);

    await expect(createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "export", "--format", "static", "--to", ".agentdocs/exported",
    ])).rejects.toThrowError(/inside the AgentDocs output directory/i);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "agentdocs-cli-"));
}

async function createConfiguredDocsProject(outputDir = ".agentdocs"): Promise<string> {
  const cwd = await createTemporaryDirectory();
  await mkdir(path.join(cwd, "docs"), { recursive: true });
  await writeFile(
    path.join(cwd, "docs", "one.md"),
    "# One\n\n## Install\n\nInstall the first package before use.\n",
    "utf8",
  );
  await writeFile(
    path.join(cwd, "docs", "two.md"),
    "# Two\n\n## Configure\n\nConfigure the second package before use.\n",
    "utf8",
  );
  await writeFile(path.join(cwd, "agentdocs.config.yaml"), `
name: Configured Docs
slug: configured-docs
sources:
  - type: local_markdown
    path: ./docs
output:
  dir: ${JSON.stringify(outputDir)}
doctor:
  minScore: 0
`, "utf8");
  return cwd;
}

import { access, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  AgentMapSchema,
  ChunkSchema,
  DocPageSchema,
  ManifestSchema,
  TaskPackSchema,
} from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { buildFromSources } from "./build.js";
import { ingestLocalMarkdown } from "./ingest.js";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("buildFromSources", () => {
  it("writes deterministic schema-valid chunks and enriches pages", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-build-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });

    const first = await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
    const firstContents = await readFile(first.chunksPath, "utf8");
    const firstAgentMap = await readFile(first.agentMapPath, "utf8");
    const firstLlmsTxt = await readFile(first.llmsTxtPath!, "utf8");
    const firstAgentsMd = await readFile(first.agentsMdPath!, "utf8");
    const firstManifest = await readFile(first.manifestPath!, "utf8");
    const firstIndex = await readFile(first.indexPath);
    const firstTaskPacks = await Promise.all(
      first.taskPackPaths.map((file) => readFile(file, "utf8")),
    );
    const second = await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
    expect(await readFile(second.chunksPath, "utf8")).toBe(firstContents);
    expect(await readFile(second.agentMapPath, "utf8")).toBe(firstAgentMap);
    expect(await readFile(second.llmsTxtPath!, "utf8")).toBe(firstLlmsTxt);
    expect(await readFile(second.agentsMdPath!, "utf8")).toBe(firstAgentsMd);
    expect(await readFile(second.manifestPath!, "utf8")).toBe(firstManifest);
    expect(await readFile(second.indexPath)).toEqual(firstIndex);
    expect(second.indexBackend).toBe(first.indexBackend);
    expect(await Promise.all(second.taskPackPaths.map((file) => readFile(file, "utf8"))))
      .toEqual(firstTaskPacks);

    const chunks = firstContents
      .trim()
      .split("\n")
      .map((line) => ChunkSchema.parse(JSON.parse(line)));
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((chunk) => chunk.headingPath.includes("Create a client"))).toBe(true);
    const agentMap = AgentMapSchema.parse(JSON.parse(firstAgentMap));
    expect(agentMap.entities.length).toBeGreaterThan(0);
    expect(agentMap.edges.some((edge) => edge.type === "links_to")).toBe(true);
    expect(agentMap.edges.every((edge) => edge.evidence.length > 0)).toBe(true);
    expect(agentMap.taskPacks.length).toBeGreaterThan(0);
    for (const taskPack of agentMap.taskPacks) {
      expect(TaskPackSchema.parse(taskPack)).toEqual(taskPack);
      expect(taskPack.steps.length).toBeGreaterThan(0);
      expect(taskPack.evidence.length).toBeGreaterThan(0);
    }
    const manifest = ManifestSchema.parse(JSON.parse(firstManifest));
    expect(manifest.counts.taskPacks).toBe(agentMap.taskPacks.length);
    expect(manifest.project.name).toBe("Basic Docs Fixture");
    expect(firstLlmsTxt).toContain("## Task packs");
    expect(firstAgentsMd).toContain("## Common tasks");
    expect(firstTaskPacks.some((pack) => pack.includes("## Gotchas"))).toBe(true);

    const pageFiles = await import("node:fs/promises").then(({ readdir }) =>
      readdir(path.join(output, "sources", "pages")),
    );
    const pages = await Promise.all(
      pageFiles
        .filter((file) => file.endsWith(".json"))
        .map(async (file) =>
          DocPageSchema.parse(
            JSON.parse(await readFile(path.join(output, "sources", "pages", file), "utf8")),
          ),
        ),
    );
    expect(
      pages.flatMap((page) => page.codeBlocks).some((block) =>
        block.extracted?.envVars?.includes("EXAMPLE_API_KEY"),
      ),
    ).toBe(true);
    expect(
      pages.flatMap((page) => page.codeBlocks).some((block) =>
        block.extracted?.packages?.includes("@example/sdk"),
      ),
    ).toBe(true);
  });

  it("removes stale and disabled static artifacts", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-build-clean-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });
    await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
    await writeFile(path.join(output, "task-packs", "stale.md"), "# Stale\n", "utf8");

    await buildFromSources({
      cwd: REPOSITORY_ROOT,
      out: output,
      writeTaskPacks: false,
    });
    expect(await readFile(path.join(output, "llms.txt"), "utf8")).not.toContain("task-packs/");
    expect(await readFile(path.join(output, "AGENTS.md"), "utf8")).not.toContain("task-packs/");
    await expect(access(path.join(output, "task-packs", "stale.md"))).rejects.toMatchObject({ code: "ENOENT" });

    await buildFromSources({
      cwd: REPOSITORY_ROOT,
      out: output,
      writeAgentsMd: false,
      writeLlmsTxt: false,
      writeManifest: false,
      writeTaskPacks: false,
    });

    await expect(access(path.join(output, "AGENTS.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(output, "llms.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(output, "manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

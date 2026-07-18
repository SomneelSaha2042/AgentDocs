import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AgentMapSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { buildFromSources } from "./build.js";
import { ingestLocalMarkdown } from "./ingest.js";
import { formatInspectResult, InspectError, inspectAgentMap } from "./inspect.js";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("inspectAgentMap", () => {
  it("reads entities and internal links from the validated agent map", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-inspect-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });
    const build = await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });
    AgentMapSchema.parse(JSON.parse(await readFile(build.agentMapPath, "utf8")));

    const entities = await inspectAgentMap({
      cwd: REPOSITORY_ROOT,
      out: output,
      target: "entities",
    });
    const links = await inspectAgentMap({
      cwd: REPOSITORY_ROOT,
      out: output,
      target: "links",
    });

    expect(entities.target).toBe("entities");
    expect(entities.target === "entities" && entities.entities.length).toBeGreaterThan(0);
    expect(formatInspectResult(entities)).toContain("@example/sdk");
    expect(links.target).toBe("links");
    expect(links.target === "links" && links.links.length).toBeGreaterThan(0);
    expect(formatInspectResult(links)).toContain("links_to");
  });

  it("explains why a task pack was generated", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-inspect-pack-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });
    await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });

    const result = await inspectAgentMap({
      cwd: REPOSITORY_ROOT,
      id: "quickstart",
      out: output,
      target: "task-pack",
    });

    expect(result.target).toBe("task-pack");
    expect(result.target === "task-pack" && result.taskPack.id).toBe("quickstart");
    expect(result.target === "task-pack" && result.requiredPages.length).toBeGreaterThan(0);
    expect(formatInspectResult(result)).toContain("Generation evidence");
    expect(formatInspectResult(result)).toContain("Code/command evidence");
    expect(formatInspectResult(result)).toContain("Weak evidence reason");
    expect(formatInspectResult(result)).toContain("guides/setup.md");
  });

  it("reports available task packs when an ID is missing", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const output = await mkdtemp(path.join(os.tmpdir(), "agentdocs-inspect-missing-"));
    await ingestLocalMarkdown({
      cwd: REPOSITORY_ROOT,
      out: output,
      source: "fixtures/basic-docs",
    });
    await buildFromSources({ cwd: REPOSITORY_ROOT, out: output });

    await expect(inspectAgentMap({
      cwd: REPOSITORY_ROOT,
      id: "missing",
      out: output,
      target: "task-pack",
    })).rejects.toThrowError(InspectError);
    await expect(inspectAgentMap({
      cwd: REPOSITORY_ROOT,
      id: "missing",
      out: output,
      target: "task-pack",
    })).rejects.toThrowError("Available task packs: api-usage, configuration, installation, quickstart.");
  });
});

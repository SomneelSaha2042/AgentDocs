import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AgentMapSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { buildFromSources } from "./build.js";
import { ingestLocalMarkdown } from "./ingest.js";
import { formatInspectResult, inspectAgentMap } from "./inspect.js";

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
});

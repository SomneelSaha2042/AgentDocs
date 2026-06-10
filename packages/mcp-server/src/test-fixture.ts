import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildSearchIndex } from "@agentdocs/indexer";
import { AgentMapSchema, ManifestSchema, type AgentMap } from "@agentdocs/shared";
import { expect } from "vitest";

export async function writeFixtureArtifacts(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  const out = await mkdtemp(path.join(os.tmpdir(), "agentdocs-mcp-"));
  const map = fixtureMap();
  await mkdir(path.join(out, "task-packs"), { recursive: true });
  await writeFile(path.join(out, "agent-map.json"), `${JSON.stringify(map)}\n`, "utf8");
  await writeFile(path.join(out, "manifest.json"), `${JSON.stringify(ManifestSchema.parse({
    schemaVersion: "0.1.0",
    project: { name: "Fixture", slug: "fixture" },
    generatedAt: "1970-01-01T00:00:00.000Z",
    sources: [{ type: "local_markdown", value: "docs/auth.md" }],
    counts: { pages: 2, chunks: 2, entities: 0, edges: 1, taskPacks: 1 },
  }))}\n`, "utf8");
  await writeFile(path.join(out, "llms.txt"), "# Fixture\n", "utf8");
  await writeFile(path.join(out, "AGENTS.md"), "# Agent instructions\n", "utf8");
  await writeFile(
    path.join(out, "task-packs", "authentication.md"),
    "# Task: Authentication\n",
    "utf8",
  );
  await buildSearchIndex({ agentMap: map, cwd: out, out: "." });
  expect(await readFile(path.join(out, "index.sqlite"))).not.toHaveLength(0);
  return out;
}

function fixtureMap(): AgentMap {
  const hash = "a".repeat(64);
  return AgentMapSchema.parse({
    schemaVersion: "0.1.0",
    pages: [
      {
        id: "page_auth",
        sourceType: "local_markdown",
        repoPath: "docs/auth.md",
        title: "Authentication",
        markdown: "# Authentication\nUse an API key.\n",
        headings: [{ id: "heading_auth", depth: 1, text: "Authentication", slug: "authentication", position: {} }],
        links: [],
        codeBlocks: [{ id: "code_auth", language: "typescript", value: "const client = createClient();", sourceHeadingId: "heading_auth" }],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
      },
      {
        id: "page_setup",
        sourceType: "local_markdown",
        repoPath: "docs/setup.md",
        title: "Setup",
        markdown: "# Setup\nInstall the package.\n",
        headings: [{ id: "heading_setup", depth: 1, text: "Setup", slug: "setup", position: {} }],
        links: [],
        codeBlocks: [],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
      },
    ],
    chunks: [
      { id: "chunk_auth", pageId: "page_auth", headingPath: ["Authentication"], text: "Use an API key for authentication.", tokenEstimate: 7, links: [], entityIds: [], contentHash: hash },
      { id: "chunk_setup", pageId: "page_setup", headingPath: ["Setup"], text: "Install the package.", tokenEstimate: 4, links: [], entityIds: [], contentHash: hash },
    ],
    entities: [],
    edges: [{
      from: "page_auth",
      to: "page_setup",
      type: "links_to",
      evidence: [{ source: "page", pageId: "page_auth", repoPath: "docs/auth.md" }],
      confidence: 1,
    }],
    taskPacks: [{
      id: "authentication",
      title: "Authentication",
      description: "Configure authentication.",
      confidence: "high",
      requiredPages: ["page_auth"],
      relatedEntities: [],
      steps: [{ title: "Use an API key", description: "Configure the client.", evidence: [{ source: "page", pageId: "page_auth", repoPath: "docs/auth.md" }] }],
      gotchas: [{ text: "Do not expose API keys.", severity: "critical", evidence: [{ source: "page", pageId: "page_auth", repoPath: "docs/auth.md" }] }],
      codeExamples: ["const client = createClient();"],
      evidence: [{ source: "page", pageId: "page_auth", repoPath: "docs/auth.md" }],
    }],
  });
}

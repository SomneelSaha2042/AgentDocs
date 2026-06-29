import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ArtifactService, McpArtifactError } from "./artifacts.js";
import { writeFixtureArtifacts } from "./test-fixture.js";

describe("ArtifactService", () => {
  it("serves all Phase 9 tool data from built artifacts", async () => {
    const out = await writeFixtureArtifacts();
    const service = new ArtifactService({ cwd: out, out: "." });

    await expect(service.validateArtifacts()).resolves.toBeUndefined();
    expect((await service.searchDocs("authentication")).results[0])
      .toMatchObject({ pageId: "page_auth", chunkId: "chunk_auth" });
    expect((await service.searchDocs("install", 8, "authentication")).results)
      .toEqual([]);
    expect((await service.getPage("page_auth")).title).toBe("Authentication");
    expect((await service.getTaskPack("authentication")).markdown)
      .toContain("# Task: Authentication");
    const context = await service.getAgentStartContext("configure authentication");
    expect(context.readFirst[0]).toBe("agentdocs://task-packs/authentication.md");
    const stepMatchedContext = await service.getAgentStartContext("implement React mutation invalidation");
    expect(stepMatchedContext.readFirst[0]).toBe("agentdocs://task-packs/query-invalidation.md");
    expect(context.goalBundle.steps[0]).toMatchObject({
      pageId: "page_auth",
      role: "prerequisite",
    });
    expect((await service.getCodeExamples("client", "typescript")).examples[0])
      .toMatchObject({ codeBlockId: "code_auth", pageId: "page_auth" });
    expect((await service.getRelatedPages("page_auth")).pages[0])
      .toMatchObject({ pageId: "page_setup", relationship: "links_to" });
  });

  it("does not use free-form query_docs task text as a task-pack search filter", async () => {
    const out = await writeFixtureArtifacts();
    const service = new ArtifactService({ cwd: out, out: "." });

    const result = await service.queryDocs(
      "authenticate requests",
      "Configure a client that sends an API key with every request",
      undefined,
      3,
    );

    expect(result.task).toBe("authentication");
    expect(result.steps[0]?.text).toContain("API key");
    expect(result.steps[0]?.evidence[0]?.pageId).toBe("page_auth");
  });

  it("serves only allowlisted and validated resources", async () => {
    const out = await writeFixtureArtifacts();
    const service = new ArtifactService({ cwd: out, out: "." });

    await expect(service.readResource("agentdocs://llms.txt"))
      .resolves.toMatchObject({ mimeType: "text/plain", text: "# Fixture\n" });
    await expect(service.readResource("agentdocs://pages/page_auth.md"))
      .resolves.toMatchObject({ mimeType: "text/markdown" });
    await expect(service.readResource("agentdocs://task-packs/authentication.md"))
      .resolves.toMatchObject({ mimeType: "text/markdown" });
    await expect(service.readResource("agentdocs://pages/../../package.json"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.getPage("../package"))
      .rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(service.getTaskPack("../../secret"))
      .rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("returns structured missing and invalid-artifact errors", async () => {
    const out = await writeFixtureArtifacts();
    const service = new ArtifactService({ cwd: out, out: "." });
    await expect(service.getPage("page_missing"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    await writeFile(path.join(out, "agent-map.json"), "{}\n", "utf8");
    const invalid = new ArtifactService({ cwd: out, out: "." });
    await expect(invalid.validateArtifacts())
      .rejects.toMatchObject({ code: "INVALID_ARTIFACT" });
    await expect(invalid.getPage("page_auth"))
      .rejects.toBeInstanceOf(McpArtifactError);
    await expect(invalid.getPage("page_auth"))
      .rejects.toMatchObject({ code: "INVALID_ARTIFACT" });
  });
});

import { describe, expect, it } from "vitest";

import { createMcpRequestHandler } from "./server.js";
import { writeFixtureArtifacts } from "./test-fixture.js";

describe("AgentDocs MCP protocol", () => {
  it("enforces tool allowlists when tools are called", async () => {
    const out = await writeFixtureArtifacts();
    const handle = createMcpRequestHandler({
      allowedTools: ["query_docs", "read_page"],
      cwd: out,
      out: ".",
      version: "test-version",
    });

    const tools = await request(handle, 1, "tools/list");
    expect((tools.result as { tools: { name: string }[] }).tools.map((tool) => tool.name).sort())
      .toEqual(["query_docs", "read_page"]);

    const disallowed = await request(handle, 2, "tools/call", {
      name: "get_page",
      arguments: { pageId: "page_missing" },
    });
    expect(disallowed.result).toMatchObject({
      isError: true,
      structuredContent: {
        code: "TOOL_NOT_ALLOWED",
        message: 'Tool "get_page" is not allowed by this MCP server configuration.',
      },
    });
    expect(JSON.stringify(disallowed)).not.toContain("NOT_FOUND");

    const allowed = await request(handle, 3, "tools/call", {
      name: "query_docs",
      arguments: { goal: "authentication" },
    });
    expect(JSON.stringify(allowed)).toContain("Do not expose API keys");
  });

  it("exposes tools, resources, successful calls, and structured errors", async () => {
    const out = await writeFixtureArtifacts();
    const handle = createMcpRequestHandler({ cwd: out, out: ".", version: "test-version" });

    const initialized = await request(handle, 1, "initialize");
    expect(initialized.result).toMatchObject({
      serverInfo: { name: "agentdocs", version: "test-version" },
      capabilities: { tools: {}, resources: {} },
    });
    const tools = await request(handle, 2, "tools/list");
    const listedTools = (tools.result as { tools: { name: string; inputSchema: { properties?: Record<string, unknown> } }[] }).tools;
    expect(listedTools.map((tool) => tool.name).sort())
      .toEqual([
        "browse_docs",
        "explain_warning",
        "find_code_examples",
        "get_agent_start_context",
        "get_code_examples",
        "get_page",
        "get_related_pages",
        "get_setup_commands",
        "get_task_context",
        "get_task_pack",
        "get_version_policy",
        "list_available_tasks",
        "query_docs",
        "read_docs",
        "read_page",
        "search_docs",
        "verify_task_context",
      ]);
    expect(listedTools.find((tool) => tool.name === "query_docs")?.inputSchema.properties).not.toHaveProperty("limit");
    expect(listedTools.find((tool) => tool.name === "query_docs")?.inputSchema.properties)
      .toEqual(expect.objectContaining({ scopeRefs: expect.any(Object), navigationCursor: expect.any(Object) }));
    expect(listedTools.find((tool) => tool.name === "read_page")?.inputSchema.properties).toEqual(expect.objectContaining({ ref: expect.any(Object) }));
    expect(listedTools.find((tool) => tool.name === "browse_docs")?.inputSchema.properties)
      .toEqual(expect.objectContaining({ ref: expect.any(Object), cursor: expect.any(Object), relations: expect.any(Object) }));
    const map = await request(handle, 13, "tools/call", {
      name: "browse_docs",
      arguments: {},
    });
    expect(JSON.stringify(map)).toContain("agentdocs://map/pages");
    expect((map.result as { content: { text: string }[] }).content[0]?.text).toContain("Documentation map");
    const selectedSource = await request(handle, 14, "tools/call", {
      name: "read_docs",
      arguments: { ref: "agentdocs://pages/page_auth.md#chunk_auth" },
    });
    expect(JSON.stringify(selectedSource)).toContain("Use an API key for authentication.");
    const search = await request(handle, 3, "tools/call", {
      name: "search_docs",
      arguments: { query: "authentication" },
    });
    expect(JSON.stringify(search)).toContain("page_auth");
    const missing = await request(handle, 4, "tools/call", {
      name: "get_page",
      arguments: { pageId: "page_missing" },
    });
    expect(JSON.stringify(missing)).toContain("NOT_FOUND");
    const queryDocs = await request(handle, 9, "tools/call", {
      name: "query_docs",
      arguments: { goal: "authentication" },
    });
    const queryDocsResult = queryDocs.result as {
      content: { text: string }[];
      structuredContent: { citations: unknown[]; steps: unknown[] };
    };
    const queryDocsText = queryDocsResult.content.map((item) => item.text).join("\n");
    expect(queryDocsText).toContain("Answer:");
    expect(queryDocsText).toContain("Confidence:");
    expect(queryDocsText).toContain("Readiness:");
    expect(queryDocsText).toContain("Context map:");
    expect(queryDocsText).toContain("evidence=");
    expect(queryDocsText).toContain("children=");
    expect(queryDocsText).not.toMatch(/^\{/);
    expect(Math.ceil(queryDocsText.length / 4)).toBeGreaterThan(0);
    expect(queryDocsText.length).toBeLessThan(JSON.stringify(queryDocsResult.structuredContent).length);
    expect(queryDocsResult.structuredContent.citations.length).toBeGreaterThan(0);
    expect(queryDocsResult.structuredContent.steps.length).toBeGreaterThan(0);
    expect(JSON.stringify(queryDocs)).toContain("Do not expose API keys");
    expect(JSON.stringify(queryDocs)).toContain("code_auth");
    const invalidScope = await request(handle, 12, "tools/call", {
      name: "query_docs",
      arguments: {
        goal: "authentication",
        scopeRefs: ["agentdocs://pages/missing.md"],
      },
    });
    expect(invalidScope.result).toMatchObject({
      isError: true,
      structuredContent: { code: "INVALID_ARGUMENT" },
    });
    const page = await request(handle, 10, "tools/call", {
      name: "read_page",
      arguments: { ref: "agentdocs://pages/page_auth.md#chunk_auth" },
    });
    const pageText = (page.result as { content: { text: string }[] }).content
      .map((item) => item.text)
      .join("\n");
    expect(pageText).toContain("Source:");
    expect(pageText).not.toMatch(/^\{/);
    expect(JSON.stringify(page)).toContain("Use an API key for authentication.");
    expect(JSON.stringify(page)).not.toContain("# Authentication");
    const exactPage = await request(handle, 11, "tools/call", {
      name: "read_page",
      arguments: { ref: "agentdocs://pages/page_auth.md#heading_auth" },
    });
    expect(JSON.stringify(exactPage)).toContain("Authentication");
    expect(JSON.stringify(exactPage)).toContain("Use an API key for authentication.");
    const resources = await request(handle, 5, "resources/list");
    expect(JSON.stringify(resources)).toContain("agentdocs://llms.txt");
    expect(JSON.stringify(resources)).toContain("agentdocs://documentation-map.json");
    const pageResource = await request(handle, 6, "resources/read", {
      uri: "agentdocs://pages/page_auth.md",
    });
    expect(JSON.stringify(pageResource)).toContain("# Authentication");
    const taskContext = await request(handle, 7, "tools/call", {
      name: "get_task_context",
      arguments: { goal: "authentication" },
    });
    expect(JSON.stringify(taskContext)).toContain("browse_docs");
    const verification = await request(handle, 8, "tools/call", {
      name: "verify_task_context",
      arguments: { task: "authentication" },
    });
    expect(JSON.stringify(verification)).toContain("schemaVersion");
  });
});

async function request(
  handle: ReturnType<typeof createMcpRequestHandler>,
  id: number,
  method: string,
  params?: Record<string, unknown>,
) {
  return (await handle({ jsonrpc: "2.0", id, method, params }))!;
}

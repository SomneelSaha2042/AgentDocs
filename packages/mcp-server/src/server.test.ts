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
      arguments: { goal: "authentication", limit: 3 },
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
    expect((tools.result as { tools: { name: string }[] }).tools.map((tool) => tool.name).sort())
      .toEqual([
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
        "read_page",
        "search_docs",
        "verify_task_context",
      ]);
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
      arguments: { goal: "authentication", limit: 3 },
    });
    const queryDocsResult = queryDocs.result as {
      content: { text: string }[];
      structuredContent: { citations: unknown[]; steps: unknown[] };
    };
    const queryDocsText = queryDocsResult.content.map((item) => item.text).join("\n");
    expect(queryDocsText).toContain("Answer:");
    expect(queryDocsText).toContain("Confidence:");
    expect(queryDocsText).toContain("Readiness:");
    expect(queryDocsText).not.toMatch(/^\{/);
    expect(Math.ceil(queryDocsText.length / 4)).toBeLessThan(800);
    expect(queryDocsText.length).toBeLessThan(JSON.stringify(queryDocsResult.structuredContent).length);
    expect(queryDocsResult.structuredContent.citations.length).toBeGreaterThan(0);
    expect(queryDocsResult.structuredContent.steps.length).toBeGreaterThan(0);
    expect(JSON.stringify(queryDocs)).toContain("Do not expose API keys");
    expect(JSON.stringify(queryDocs)).toContain("code_auth");
    const boundedPage = await request(handle, 10, "tools/call", {
      name: "read_page",
      arguments: { chunkId: "chunk_auth", maxChars: 200 },
    });
    const boundedPageText = (boundedPage.result as { content: { text: string }[] }).content
      .map((item) => item.text)
      .join("\n");
    expect(boundedPageText).toContain("Source:");
    expect(boundedPageText).not.toMatch(/^\{/);
    expect(JSON.stringify(boundedPage)).toContain("Use an API key for authentication.");
    expect(JSON.stringify(boundedPage)).not.toContain("# Authentication");
    const resources = await request(handle, 5, "resources/list");
    expect(JSON.stringify(resources)).toContain("agentdocs://llms.txt");
    const page = await request(handle, 6, "resources/read", {
      uri: "agentdocs://pages/page_auth.md",
    });
    expect(JSON.stringify(page)).toContain("# Authentication");
    const taskContext = await request(handle, 7, "tools/call", {
      name: "get_task_context",
      arguments: { goal: "authentication" },
    });
    expect(JSON.stringify(taskContext)).toContain("query_docs");
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

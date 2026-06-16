import { describe, expect, it } from "vitest";

import { createMcpRequestHandler } from "./server.js";
import { writeFixtureArtifacts } from "./test-fixture.js";

describe("AgentDocs MCP protocol", () => {
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
    expect(JSON.stringify(taskContext)).toContain("get_task_context");
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

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createProgram } from "./cli.js";
import { formatTryResult } from "./try.js";

describe("try CLI", () => {
  it("turns a local docs path into an audited context handoff", async () => {
    const cwd = await prepareDocs();
    const writes: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
      writes.push(String(value));
      return true;
    });
    try {
      await createProgram().exitOverride().parseAsync([
        "node",
        "agentdocs",
        "--cwd",
        cwd,
        "--json",
        "try",
        "./docs",
        "--goal",
        "install the SDK",
      ]);
    } finally {
      write.mockRestore();
    }

    const result = JSON.parse(writes.join(""));
    expect(result).toMatchObject({
      source: { kind: "local_markdown", value: "./docs" },
      pageCount: 1,
      context: { goal: "install the SDK" },
      readiness: { score: expect.any(Number) },
      next: {
        command: "agentdocs --out .agentdocs serve-mcp --tools query_docs,read_page",
        prompt: "Use the AgentDocs MCP server and install the SDK.",
      },
    });
    expect(result.taskPackCount).toBeGreaterThan(0);
    expect(result.context.readFirst).toContain("agentdocs://task-packs/installation.md");
    expect(result.context.search.results.length).toBeGreaterThan(0);
    expect(formatTryResult(result)).toContain(`Best context for goal "install the SDK":
- agentdocs://task-packs/installation.md`);
    expect(formatTryResult(result)).toContain("Selected task pack: installation");
    expect(formatTryResult(result)).toContain("Warnings:");
    expect(formatTryResult(result)).toContain(
      "1. Run: agentdocs --out .agentdocs serve-mcp --tools query_docs,read_page",
    );
    await expect(readFile(path.join(cwd, ".agentdocs", "reports", "agent-readiness.md"), "utf8"))
      .resolves.toContain("# Agent-readiness report");
  });

  it("crawls an HTTP source before building context", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-try-web-"));
    const server = createServer((request, response) => {
      response.setHeader("content-type", "text/html");
      response.end(`<html><head><title>Authentication</title></head><body>
        <h1>Authentication</h1>
        <p>Use the API key to authenticate requests.</p>
      </body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Fixture server did not expose a TCP address.");
    }
    const source = `http://127.0.0.1:${address.port}/docs`;

    try {
      const writes: string[] = [];
      const write = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
        writes.push(String(value));
        return true;
      });
      try {
        await createProgram().exitOverride().parseAsync([
          "node",
          "agentdocs",
          "--cwd",
          cwd,
          "--json",
          "try",
          source,
          "--goal",
          "authenticate requests",
        ]);
      } finally {
        write.mockRestore();
      }

      const result = JSON.parse(writes.join(""));
      expect(result.source).toEqual({ kind: "website", value: source });
      expect(result.pageCount).toBe(1);
      expect(result.context.search.results.length).toBeGreaterThan(0);
      expect(result.crawl).toMatchObject({
        scope: "/",
        collected: 1,
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error === undefined ? resolve() : reject(error));
      });
    }
  });
});

async function prepareDocs(): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-try-cli-"));
  await mkdir(path.join(cwd, "docs"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "install.md"), `# Install the SDK

Install the package:

\`\`\`bash
pnpm add @example/sdk
\`\`\`
`, "utf8");
  return cwd;
}

import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  AgentSetupSnippetSchema,
  BuildStateSchema,
  ContextVerificationSchema,
  HandoffBundleSchema,
  StatusReportSchema,
} from "@agentdocs/shared";
import { describe, expect, it, vi } from "vitest";

import { createProgram } from "./cli.js";

describe("agent workflow CLI", () => {
  it("prints setup snippets for common MCP clients", async () => {
    const cwd = await createFixtureProject();
    const output = await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--out", ".custom-agentdocs", "--json", "setup-agent", "--client", "codex",
      ]);
    });

    const parsed = JSON.parse(output) as { snippets: unknown[] };
    expect(parsed.snippets).toHaveLength(1);
    const snippet = AgentSetupSnippetSchema.parse(parsed.snippets[0]);
    expect(snippet.client).toBe("codex");
    expect(snippet.contents).toContain("[mcp_servers.agentdocs]");
    expect(snippet.contents).toContain(".custom-agentdocs");
    expect(snippet.prompt).toContain("Use the AgentDocs MCP server before web search.");

    const human = await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--out", ".custom-agentdocs", "setup-agent", "--client", "codex",
      ]);
    });
    expect(human).toContain("[mcp_servers.agentdocs]");
    expect(human).toContain(".custom-agentdocs");
    expect(human).toContain("Agent prompt:");
  });

  it("reports fresh, stale, and refreshed status for configured local docs", async () => {
    const cwd = await createFixtureProject();
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);

    const fresh = StatusReportSchema.parse(JSON.parse(await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--json", "status",
      ]);
    })));
    expect(fresh.state).toBe("fresh");
    expect(await readFile(path.join(cwd, ".agentdocs", "agent-brief.md"), "utf8"))
      .toContain("Persistent Agent Prompt");

    await writeFile(
      path.join(cwd, "docs", "auth.md"),
      "# Authentication\n\n## API key\n\nInstall and use EXAMPLE_API_KEY safely.\n",
      "utf8",
    );
    const stale = StatusReportSchema.parse(JSON.parse(await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--json", "status",
      ]);
    })));
    expect(stale.state).toBe("stale");
    expect(stale.sources.some((source) => source.reason.includes("fingerprint changed"))).toBe(true);

    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "rebuild", "--changed",
    ]);
    const refreshed = StatusReportSchema.parse(JSON.parse(await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--json", "status",
      ]);
    })));
    expect(refreshed.state).toBe("fresh");
  });

  it("records source limits in build state for reproducible shards", async () => {
    const cwd = await createFixtureProject();
    await writeFile(
      path.join(cwd, "docs", "second.md"),
      "# Second\n\nAnother page in the same source scope.\n",
      "utf8",
    );
    await writeFile(path.join(cwd, "agentdocs.config.yaml"), `
name: Workflow Fixture
slug: workflow-fixture
version: v1
sources:
  - type: local_markdown
    path: ./docs
    limits:
      maxFiles: 1
doctor:
  minScore: 0
`, "utf8");

    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);
    const state = BuildStateSchema.parse(JSON.parse(
      await readFile(path.join(cwd, ".agentdocs", "state", "build-state.json"), "utf8"),
    ));
    const status = StatusReportSchema.parse(JSON.parse(await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--json", "status",
      ]);
    })));

    expect(state.sources[0]).toMatchObject({
      fileCount: 2,
      selectedFileCount: 1,
      limits: { maxFiles: 1 },
    });
    expect(status.sources[0]).toMatchObject({
      fileCount: 2,
      selectedFileCount: 1,
      limits: { maxFiles: 1 },
    });
  });

  it("emits handoff and verification bundles", async () => {
    const cwd = await createFixtureProject();
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);

    const handoff = HandoffBundleSchema.parse(JSON.parse(await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--out", ".agentdocs", "--json", "handoff", "authenticate with api key",
      ]);
    })));
    expect(handoff.mcp.suggestedTools).toContain("query_docs");
    expect(handoff.mcp.command).toBe("agentdocs --out .agentdocs serve-mcp");
    expect(handoff.selectedTaskPack?.id).toBe("authentication");
    expect(handoff.context.selectedTaskPack?.id).toBe(handoff.selectedTaskPack?.id);
    expect(handoff.topSources.length).toBeGreaterThan(0);

    const humanHandoff = await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "handoff", "authenticate with api key",
      ]);
    });
    expect(humanHandoff).toContain("Selected task pack: authentication (medium confidence)");
    expect(humanHandoff).toContain("Read first:");
    expect(humanHandoff).toContain("Warnings:");

    const verification = ContextVerificationSchema.parse(JSON.parse(await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "--json", "verify-context", "--task", "authenticate with api key",
      ]);
    })));
    expect(["pass", "warn", "fail"]).toContain(verification.status);
    expect(verification.freshness?.state).toBe("fresh");
    expect(verification.issues.map((issue) => issue.code)).not.toContain("missing_task_pack");

    const humanVerification = await captureStdout(async () => {
      await createProgram().exitOverride().parseAsync([
        "node", "agentdocs", "--cwd", cwd, "verify-context", "--task", "authenticate with api key",
      ]);
    });
    expect(humanVerification).toContain("Context verification:");
    expect(humanVerification).toContain("Freshness:");
    expect(humanVerification).toContain("Issues:");
  });

  it("supports one-cycle watch checks", async () => {
    const cwd = await createFixtureProject();
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "build",
    ]);
    await createProgram().exitOverride().parseAsync([
      "node", "agentdocs", "--cwd", cwd, "--quiet", "watch", "--once",
    ]);
  });
});

async function createFixtureProject(): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-workflow-"));
  await mkdir(path.join(cwd, "docs"), { recursive: true });
  await writeFile(
    path.join(cwd, "docs", "auth.md"),
    "# Authentication\n\n## Install\n\nRun `npm install @example/sdk`.\n\n## API key\n\nUse EXAMPLE_API_KEY for authentication. Never expose API keys.\n",
    "utf8",
  );
  await writeFile(path.join(cwd, "agentdocs.config.yaml"), `
name: Workflow Fixture
slug: workflow-fixture
version: v1
sources:
  - type: local_markdown
    path: ./docs
doctor:
  minScore: 0
`, "utf8");
  return cwd;
}

async function captureStdout(action: () => Promise<void>): Promise<string> {
  const writes: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
    writes.push(String(value));
    return true;
  });
  try {
    await action();
  } finally {
    write.mockRestore();
  }
  return writes.join("");
}

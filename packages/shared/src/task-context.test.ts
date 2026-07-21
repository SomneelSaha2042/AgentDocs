import { describe, expect, it } from "vitest";

import { AgentMapSchema, type AgentMap } from "./models.js";
import { TaskContextAssembler } from "./task-context.js";

describe("TaskContextAssembler", () => {
  it("returns compact evidence-linked task context", () => {
    const assembler = new TaskContextAssembler({ agentMap: fixtureMap() });
    const result = assembler.queryDocs({
      goal: "authenticate requests with an API key",
      task: "authentication",
      limit: 3,
      search: {
        query: "authenticate requests with an API key",
        results: [{
          title: "Authentication",
          repoPath: "docs/auth.md",
          headingPath: ["Authentication"],
          snippet: "Use an API key for authentication.",
          score: 10,
          pageId: "page_auth",
          chunkId: "chunk_auth",
          facets: [],
        }],
        warnings: [],
      },
    });

    expect(result.estimatedTokens).toBeLessThan(800);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.every((step) => step.evidence.length > 0)).toBe(true);
    expect(result.gotchas.every((gotcha) => gotcha.evidence.length > 0)).toBe(true);
    expect(result.codeExamples.every((example) => example.evidence.length > 0)).toBe(true);
    expect(result.readiness.recommendation).toBe("inspect");
    expect(result.readiness.coverage).toBe("unknown");
    expect(result.answer).toContain("Inspect the cited source evidence");
    expect(result.followUpRefs).toHaveLength(0);
    expect(JSON.stringify(result)).toContain("code_auth");
  });

  it("stops when an explicit symbol has no source candidate", () => {
    const assembler = new TaskContextAssembler({ agentMap: fixtureMap() });
    const decision = assembler.buildContextDecision({
      goal: "authenticate requests with `createSession()`",
      task: "authentication",
      search: {
        query: "authenticate requests with createSession",
        results: [{
          title: "Authentication",
          repoPath: "docs/auth.md",
          headingPath: ["Authentication"],
          snippet: "Use an API key for authentication.",
          score: 10,
          pageId: "page_auth",
          chunkId: "chunk_auth",
          facets: [],
        }],
        warnings: [],
      },
    });

    expect(decision.verification.coverage).toBe("partial");
    expect(decision.verification.recommendation).toBe("stop");
    expect(decision.verification.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "symbol", value: "createSession", status: "missing" }),
    ]));
    expect(decision.query.readiness.recommendation).toBe("stop");
    expect(decision.query.answer).not.toContain("sufficient to implement");
  });

  it("stops when an explicit facet has no source evidence", () => {
    const assembler = new TaskContextAssembler({ agentMap: fixtureMap() });
    const decision = assembler.buildContextDecision({
      goal: "authenticate requests",
      task: "Use the Next.js App Router implementation.",
      facets: { framework: "Next.js", router: "app" },
      search: {
        query: "authenticate requests Next.js App Router",
        results: [{
          title: "Authentication",
          repoPath: "docs/auth.md",
          headingPath: ["Authentication"],
          snippet: "Use an API key for authentication.",
          score: 10,
          pageId: "page_auth",
          chunkId: "chunk_auth",
          facets: [],
        }],
        warnings: [],
      },
    });

    expect(decision.verification.recommendation).toBe("stop");
    expect(decision.verification.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing_task_requirement_evidence",
        severity: "critical",
        message: expect.stringContaining("framework=Next.js"),
      }),
    ]));
    expect(decision.query.readiness.recommendation).toBe("stop");
    expect(decision.query.steps).toHaveLength(0);
    expect(decision.query.codeExamples).toHaveLength(0);
  });

  it("inspects when no task pack matches but no explicit requirement is blocked", () => {
    const assembler = new TaskContextAssembler({ agentMap: fixtureMap() });
    const decision = assembler.buildContextDecision({
      goal: "deploy a widget",
      task: "use the documented deployment path",
      search: { query: "deploy a widget", results: [], warnings: [] },
    });

    expect(decision.selectedTaskPack).toBeUndefined();
    expect(decision.verification.recommendation).toBe("inspect");
    expect(decision.verification.requirements.every((requirement) => requirement.status !== "missing")).toBe(true);
  });

  it("keeps exact evidence outside a selected task pack reachable", () => {
    const map = fixtureMap();
    const hash = "b".repeat(64);
    map.pages.push({
      id: "page_adapter",
      sourceType: "local_markdown",
      repoPath: "docs/adapter.md",
      title: "Database adapter",
      markdown: "# Database adapter\nUse @example/adapter for the documented auth adapter.\n\n```ts\nimport { Adapter } from \"@example/adapter\";\n```\n",
      headings: [{ id: "heading_adapter", depth: 1, text: "Database adapter", slug: "database-adapter", position: {} }],
      links: [],
      codeBlocks: [{ id: "code_adapter", language: "ts", value: "import { Adapter } from \"@example/adapter\";", sourceHeadingId: "heading_adapter" }],
      contentHash: hash,
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
      facets: [],
      normalization: { mode: "strict", warnings: [] },
    });
    map.chunks.push({
      id: "chunk_adapter",
      pageId: "page_adapter",
      headingPath: ["Database adapter"],
      text: "Use @example/adapter for the documented auth adapter.",
      tokenEstimate: 10,
      links: [],
      entityIds: [],
      contentHash: hash,
      facets: [],
    });
    const result = new TaskContextAssembler({ agentMap: AgentMapSchema.parse(map) }).queryDocs({
      goal: "authenticate requests",
      task: "authentication with @example/adapter",
      search: {
        query: "authenticate requests authentication with @example/adapter",
        results: [{
          title: "Authentication",
          repoPath: "docs/auth.md",
          headingPath: ["Authentication"],
          snippet: "Use an API key for authentication.",
          score: 10,
          pageId: "page_auth",
          chunkId: "chunk_auth",
          facets: [],
        }],
        warnings: [],
      },
      limit: 3,
    });

    expect(JSON.stringify(result)).toContain("@example/adapter");
    expect(result.readiness.gaps).toEqual([]);
  });

  it("reads bounded sections by default and respects maxChars", () => {
    const assembler = new TaskContextAssembler({ agentMap: fixtureMap() });
    const result = assembler.readPage({ pageId: "page_auth", maxChars: 20 });

    expect(result.section.chunkId).toBe("chunk_auth");
    expect(result.section.text).toHaveLength(20);
    expect(result.section.truncated).toBe(true);
    expect(result.section.text).not.toContain("# Authentication");
  });

  it("caps non-full section reads even when maxChars is broad", () => {
    const map = fixtureMap();
    map.chunks[0]!.text = "Use an API key for authentication. ".repeat(80);
    const result = new TaskContextAssembler({ agentMap: map }).readPage({
      pageId: "page_auth",
      maxChars: 5000,
    });

    expect(result.section.chunkId).toBe("chunk_auth");
    expect(result.section.text.length).toBeLessThanOrEqual(1000);
    expect(result.section.truncated).toBe(true);
  });

  it("can read a cited code block id passed as chunkId", () => {
    const result = new TaskContextAssembler({ agentMap: fixtureMap() }).readPage({
      chunkId: "code_auth",
    });

    expect(result.section.title).toBe("Code example");
    expect(result.section.text).toContain("createClient");
    expect(result.section.evidence[0]?.source).toBe("code_block");
  });

  it("keeps query output compact even when callers request a high limit", () => {
    const hash = "b".repeat(64);
    const largeText = "Use octokit.paginate with octokit.rest.repos.listCommits. ".repeat(80);
    const map = AgentMapSchema.parse({
      schemaVersion: "0.2.0",
      pages: [{
        id: "page_pagination",
        sourceType: "local_markdown",
        repoPath: "docs/pagination.md",
        title: "Pagination",
        markdown: `# Pagination\n${largeText}`,
        headings: [{ id: "heading_pagination", depth: 1, text: "Pagination", slug: "pagination", position: {} }],
        links: [],
        codeBlocks: [{
          id: "code_route",
          language: "ts",
          value: "const messages = await octokit.paginate('GET /repos/{owner}/{repo}/commits', { owner, repo }, response => response.data.map(commit => commit.commit.message));",
          sourceHeadingId: "heading_pagination",
        }, {
          id: "code_paginate",
          language: "ts",
          value: "const messages = await octokit.paginate(octokit.rest.repos.listCommits, { owner, repo }, response => response.data.map(commit => commit.commit.message));\n".repeat(12),
          sourceHeadingId: "heading_pagination",
        }],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
        facets: [],
      }],
      chunks: Array.from({ length: 10 }, (_, index) => ({
        id: `chunk_${index}`,
        pageId: "page_pagination",
        headingPath: ["Pagination"],
        text: `${largeText} chunk ${index}`,
        tokenEstimate: 900,
        links: [],
        entityIds: [],
        contentHash: hash,
        facets: [],
      })),
      entities: [],
      edges: [],
      taskPacks: [],
    });
    const result = new TaskContextAssembler({ agentMap: map }).queryDocs({
      goal: "fetch commits with octokit pagination",
      limit: 10,
      search: {
        query: "fetch commits with octokit pagination",
        results: map.chunks.map((chunk, index) => ({
          title: "Pagination",
          repoPath: "docs/pagination.md",
          headingPath: chunk.headingPath,
          snippet: chunk.text,
          score: 100 - index,
          pageId: chunk.pageId,
          chunkId: chunk.id,
          facets: [],
        })),
        warnings: [],
      },
    });

    expect(result.estimatedTokens).toBeLessThan(800);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.length).toBeLessThanOrEqual(3);
    expect(result.followUpRefs).toHaveLength(0);
    expect(JSON.stringify(result).length).toBeLessThan(3200);
    expect(result.citations.every((citation) => (citation.quote?.length ?? 0) <= 160)).toBe(true);
    expect(result.codeExamples[0]?.value).toContain("GET /repos/{owner}/{repo}/commits");
  });

  it("keeps follow-up refs when evidence is weak or incomplete", () => {
    const map = fixtureMap();
    map.taskPacks[0]!.confidence = "low";
    map.pages[0]!.codeBlocks = [];
    const result = new TaskContextAssembler({ agentMap: map }).queryDocs({
      goal: "authenticate requests",
      task: "authentication",
      search: {
        query: "authenticate requests",
        results: [{
          title: "Authentication",
          repoPath: "docs/auth.md",
          headingPath: ["Authentication"],
          snippet: "Use an API key for authentication.",
          score: 10,
          pageId: "page_auth",
          chunkId: "chunk_auth",
          facets: [],
        }],
        warnings: [],
      },
    });

    expect(result.confidence).toBe("low");
    expect(result.warnings).toContain("Evidence is weak.");
    expect(result.followUpRefs.length).toBeGreaterThan(0);
  });

  it("builds context, handoff, query, and verification from one decision", () => {
    const map = fixtureMap();
    const assembler = new TaskContextAssembler({ agentMap: map });
    const search = {
      query: "authenticate requests with an API key",
      results: [{
        title: "Authentication",
        repoPath: "docs/auth.md",
        headingPath: ["Authentication"],
        snippet: "Use an API key for authentication.",
        score: 10,
        pageId: "page_auth",
        chunkId: "chunk_auth",
        facets: [],
      }],
      warnings: [{ code: "context_conflict" as const, key: "version", values: ["v1", "v2"] }],
    };
    map.taskPacks[0]!.confidence = "low";
    map.pages[0]!.codeBlocks = [];
    map.taskPacks[0]!.gotchas.push({
      text: "Deprecated client setup is still documented.",
      severity: "warning",
      evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
    });

    const decision = assembler.buildContextDecision({ goal: "authenticate requests with an API key", search });
    const context = assembler.buildContextBundle({
      goal: "authenticate requests with an API key",
      search,
      selectedTaskPackMarkdown: "# Task: Authentication\n",
    });
    const handoff = assembler.buildHandoffBundle({
      goal: "authenticate requests with an API key",
      search,
      selectedTaskPackMarkdown: "# Task: Authentication\n",
      setupCommands: ["npm install @example/sdk"],
    });
    const verification = assembler.verifyContext({ goal: "authenticate requests with an API key", search });

    expect(decision.selectedTaskPack?.id).toBe("authentication");
    expect(context.selectedTaskPack?.id).toBe(decision.selectedTaskPack?.id);
    expect(handoff.selectedTaskPack?.id).toBe(decision.selectedTaskPack?.id);
    expect(decision.query.task).toBe(decision.selectedTaskPack?.id);
    expect(handoff.warnings).toEqual(decision.warnings);
    expect(handoff.warnings).toContain("No canonical code examples found.");
    expect(verification.issues.map((issue) => issue.code)).toEqual(decision.verification.issues.map((issue) => issue.code));
    expect(verification.issues.map((issue) => issue.code)).toContain("weak_evidence");
    expect(verification.issues.map((issue) => issue.code)).toContain("deprecated_evidence");
    expect(verification.issues.map((issue) => issue.code)).toContain("mixed_search_context");
    expect(verification.issues.map((issue) => issue.code)).toContain("no_canonical_code_examples");
  });

  it("lets source-ranked chunks override broad task-pack boilerplate", () => {
    const map = fixtureMap();
    map.pages.push({
      id: "page_routes",
      sourceType: "local_markdown",
      repoPath: "docs/routes.md",
      title: "Routes",
      markdown: "# Routes\nValidate incoming request bodies with a route schema.\n",
      headings: [{ id: "heading_validate", depth: 1, text: "Validate your data", slug: "validate-your-data", position: {} }],
      links: [],
      codeBlocks: [{
        id: "code_validate_body",
        language: "js",
        value: "fastify.post('/', { schema: { body: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } }, async () => ({ ok: true }))",
        sourceHeadingId: "heading_validate",
      }],
      contentHash: "d".repeat(64),
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
      facets: [],
      normalization: { mode: "strict", warnings: [] },
    });
    map.chunks.push({
      id: "chunk_validate_body",
      pageId: "page_routes",
      headingPath: ["Validate your data"],
      text: "To validate incoming request bodies, pass route options with schema.body as a JSON Schema object.",
      tokenEstimate: 18,
      links: [],
      entityIds: [],
      contentHash: "d".repeat(64),
      facets: [],
    });
    map.taskPacks.push({
      id: "schema-validation",
      title: "Schema validation",
      description: "Implement schema validation.",
      confidence: "high",
      requiredPages: ["page_auth"],
      relatedEntities: [],
      steps: [{
        title: "Customize validator compiler",
        description: "Use a custom validator compiler when replacing the built-in validator.",
        evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
      }],
      gotchas: [],
      codeExamples: [],
      evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
      context: { facets: {}, conflicts: [] },
    });

    const result = new TaskContextAssembler({ agentMap: map }).queryDocs({
      goal: "POST route request body schema validation",
      task: "schema-validation",
      search: {
        query: "POST route request body schema validation",
        results: [{
          title: "Routes",
          repoPath: "docs/routes.md",
          headingPath: ["Validate your data"],
          snippet: "pass route options with schema.body",
          score: 50,
          pageId: "page_routes",
          chunkId: "chunk_validate_body",
          facets: [],
        }],
        warnings: [],
      },
    });

    expect(result.steps[0]?.title).toBe("Validate your data");
    expect(result.codeExamples[0]?.value).toContain("schema: { body:");
    expect(result.codeExamples[0]?.value).not.toContain("createClient");
  });
});


describe("TaskContextAssembler facet safety", () => {
  it("filters wrong-router evidence for Modern Router implementation goals", () => {
    const hash = "f".repeat(64);
    const appFacet = {
      key: "router",
          value: "modern-router",
      evidence: [{ source: "heading" as const, pageId: "page_app", headingId: "heading_app", repoPath: "docs/modern-router.md" }],
    };
    const pagesFacet = {
      key: "router",
          value: "legacy-router",
      evidence: [{ source: "heading" as const, pageId: "page_pages", headingId: "heading_pages", repoPath: "docs/legacy-router.md" }],
    };
    const map = AgentMapSchema.parse({
      schemaVersion: "0.2.0",
      pages: [{
        id: "page_app",
        sourceType: "local_markdown",
            repoPath: "docs/modern-router.md",
        title: "Modern Router webhook route handlers",
        markdown: "# Modern Router webhook route handlers\nUse a route handler and read the raw body with req.text().\n",
        headings: [{ id: "heading_app", depth: 1, text: "Modern Router webhook route handlers", slug: "modern-router-webhook-route-handlers", position: {} }],
        links: [],
        codeBlocks: [{
          id: "code_app_webhook",
          language: "ts",
          value: "export async function POST(req: Request) { const body = await req.text(); return Response.json({ received: true }); }",
          sourceHeadingId: "heading_app",
        }],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
        facets: [appFacet],
      }, {
        id: "page_pages",
        sourceType: "local_markdown",
            repoPath: "docs/legacy-router.md",
        title: "Legacy Router webhook API routes",
        markdown: "# Legacy Router webhook API routes\nUse LegacyRequest and disable legacyBodyParser in API route config.\n",
        headings: [{ id: "heading_pages", depth: 1, text: "Legacy Router webhook API routes", slug: "legacy-router-webhook-api-routes", position: {} }],
        links: [],
        codeBlocks: [{
          id: "code_pages_webhook",
          language: "ts",
          value: "import type { LegacyRequest, LegacyResponse } from 'legacy'; export const config = { api: { legacyBodyParser: false } };",
          sourceHeadingId: "heading_pages",
        }],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
        facets: [pagesFacet],
      }],
      chunks: [{
        id: "chunk_app",
        pageId: "page_app",
        headingPath: ["Modern Router webhook route handlers"],
        text: "In Modern Router, export async function POST(req: Request) and read the raw request body with await req.text() before signature verification.",
        tokenEstimate: 30,
        links: [],
        entityIds: [],
        contentHash: hash,
        facets: [appFacet],
      }, {
        id: "chunk_pages",
        pageId: "page_pages",
        headingPath: ["Legacy Router webhook API routes"],
        text: "In Legacy Router, use LegacyRequest, LegacyResponse, and export const config = { api: { legacyBodyParser: false } }.",
        tokenEstimate: 26,
        links: [],
        entityIds: [],
        contentHash: hash,
        facets: [pagesFacet],
      }],
      entities: [],
      edges: [],
      taskPacks: [{
        id: "webhooks",
        title: "Webhooks",
        description: "Implement webhook handlers with signature verification.",
        confidence: "high",
        requiredPages: ["page_app", "page_pages"],
        relatedEntities: [],
        steps: [{
          title: "Use Modern Router route handlers",
          description: "Export async function POST(req: Request) and read the raw body with req.text().",
          evidence: [{ source: "heading", pageId: "page_app", headingId: "heading_app", repoPath: "docs/modern-router.md" }],
        }, {
          title: "Use Legacy Router API config",
          description: "Use LegacyRequest and export const config with legacyBodyParser disabled.",
          evidence: [{ source: "heading", pageId: "page_pages", headingId: "heading_pages", repoPath: "docs/legacy-router.md" }],
        }],
        gotchas: [],
        codeExamples: [],
        evidence: [{ source: "heading", pageId: "page_app", headingId: "heading_app", repoPath: "docs/modern-router.md" }],
        context: {
          facets: { router: ["modern-router", "legacy-router"] },
          conflicts: [{
            key: "router",
            values: ["modern-router", "legacy-router"],
            evidence: [
              { source: "heading", pageId: "page_app", headingId: "heading_app", repoPath: "docs/modern-router.md" },
              { source: "heading", pageId: "page_pages", headingId: "heading_pages", repoPath: "docs/legacy-router.md" },
            ],
          }],
        },
      }],
    });
    const search = {
      query: "Example webhook Modern Router route handler",
      results: [{
        title: "Legacy Router webhook API routes",
        repoPath: "docs/legacy-router.md",
        headingPath: ["Legacy Router webhook API routes"],
        snippet: "Use LegacyRequest and legacyBodyParser false.",
        score: 100,
        pageId: "page_pages",
        chunkId: "chunk_pages",
        facets: [pagesFacet],
      }, {
        title: "Modern Router webhook route handlers",
        repoPath: "docs/modern-router.md",
        headingPath: ["Modern Router webhook route handlers"],
        snippet: "Export async function POST and read request.text().",
        score: 90,
        pageId: "page_app",
        chunkId: "chunk_app",
        facets: [appFacet],
      }],
      warnings: [],
    };
    const assembler = new TaskContextAssembler({ agentMap: map });
    const result = assembler.queryDocs({
      goal: "Write a Modern Router webhook route handler",
      task: "webhooks",
      search,
    });
    const verification = assembler.verifyContext({
      goal: "Write a Modern Router webhook route handler",
      task: "webhooks",
      search,
    });

    expect(result.task).toBe("webhooks");
    expect(JSON.stringify(result.steps)).toContain("req.text");
    expect(JSON.stringify(result.steps)).not.toContain("LegacyRequest");
    expect(result.codeExamples[0]?.value).toContain("POST(req: Request)");
    expect(result.codeExamples[0]?.value).not.toContain("legacyBodyParser");
    expect(result.warnings.some((warning) => warning.startsWith("preferred_context_mismatch: router=modern-router"))).toBe(true);
    expect(verification.status).toBe("fail");
    expect(verification.issues.map((issue) => issue.code)).toContain("preferred_context_mismatch");
    expect(verification.issues.map((issue) => issue.code)).toContain("mixed_context");
  });
});

function fixtureMap(): AgentMap {
  const hash = "a".repeat(64);
  return AgentMapSchema.parse({
    schemaVersion: "0.2.0",
    pages: [{
      id: "page_auth",
      sourceType: "local_markdown",
      repoPath: "docs/auth.md",
      title: "Authentication",
      markdown: "# Authentication\nUse an API key for authentication.\n\n```ts\nconst client = createClient({ auth: process.env.API_KEY });\n```\n",
      headings: [{ id: "heading_auth", depth: 1, text: "Authentication", slug: "authentication", position: {} }],
      links: [],
      codeBlocks: [{
        id: "code_auth",
        language: "ts",
        value: "const client = createClient({ auth: process.env.API_KEY });",
        sourceHeadingId: "heading_auth",
      }],
      contentHash: hash,
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
      facets: [],
    }],
    chunks: [{
      id: "chunk_auth",
      pageId: "page_auth",
      headingPath: ["Authentication"],
      text: "Use an API key for authentication. Never expose API keys in client-side code.",
      tokenEstimate: 14,
      links: [],
      entityIds: [],
      contentHash: hash,
      facets: [],
    }],
    entities: [],
    edges: [],
    taskPacks: [{
      id: "authentication",
      title: "Authentication",
      description: "Configure authentication.",
      confidence: "high",
      requiredPages: ["page_auth"],
      relatedEntities: [],
      steps: [{
        title: "Use an API key",
        description: "Use an API key for authentication.",
        evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
      }],
      gotchas: [{
        text: "Never expose API keys in client-side code.",
        severity: "critical",
        evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
      }],
      codeExamples: ["const client = createClient({ auth: process.env.API_KEY });"],
      evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
      context: { facets: {}, conflicts: [] },
    }],
  });
}

// ---------------------------------------------------------------------------
// Generic multi-pack routing fixture with overlapping SDK terms.
// ---------------------------------------------------------------------------

function awsLikeFixtureMap(): AgentMap {
  const hash = "c".repeat(64);
  return AgentMapSchema.parse({
    schemaVersion: "0.2.0",
    pages: [
      {
        id: "page_install",
        sourceType: "local_markdown",
        repoPath: "docs/installation.md",
        title: "Installation",
        markdown:
          "# Installation\n\nInstall using npm.\n\n```sh\nnpm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb\n```\n",
        headings: [{ id: "heading_install", depth: 1, text: "Installation", slug: "installation", position: {} }],
        links: [],
        codeBlocks: [{
          id: "code_install",
          language: "sh",
          value: "npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb",
          sourceHeadingId: "heading_install",
        }],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
        facets: [],
      },
      {
        id: "page_auth",
        sourceType: "local_markdown",
        repoPath: "docs/auth.md",
        title: "Authentication",
        markdown:
          "# Authentication\n\nConfigure AWS credentials using environment variables or the SDK config object.\n\n```js\nconst client = new DynamoDBClient({ region: process.env.AWS_REGION });\n```\n",
        headings: [{ id: "heading_auth", depth: 1, text: "Authentication", slug: "authentication", position: {} }],
        links: [],
        codeBlocks: [{
          id: "code_auth",
          language: "js",
          value: "const client = new DynamoDBClient({ region: process.env.AWS_REGION });",
          sourceHeadingId: "heading_auth",
        }],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
        facets: [],
      },
      {
        id: "page_pagination",
        sourceType: "local_markdown",
        repoPath: "docs/pagination.md",
        title: "Pagination",
        markdown:
          "# Pagination\n\nUse ExclusiveStartKey and LastEvaluatedKey to page through DynamoDB query results.\n\n```js\nlet lastEvaluatedKey;\ndo {\n  const params = { TableName, ExclusiveStartKey: lastEvaluatedKey };\n  const response = await docClient.send(new QueryCommand(params));\n  items.push(...response.Items);\n  lastEvaluatedKey = response.LastEvaluatedKey;\n} while (lastEvaluatedKey);\n```\n",
        headings: [{ id: "heading_pagination", depth: 1, text: "Pagination", slug: "pagination", position: {} }],
        links: [],
        codeBlocks: [{
          id: "code_pagination",
          language: "js",
          value:
            "let lastEvaluatedKey;\ndo {\n  const params = { TableName, ExclusiveStartKey: lastEvaluatedKey };\n  const response = await docClient.send(new QueryCommand(params));\n  items.push(...response.Items);\n  lastEvaluatedKey = response.LastEvaluatedKey;\n} while (lastEvaluatedKey);",
          sourceHeadingId: "heading_pagination",
        }],
        contentHash: hash,
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
        facets: [],
      },
    ],
    chunks: [
      {
        id: "chunk_install",
        pageId: "page_install",
        headingPath: ["Installation"],
        text: "Install using npm. Run: npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb. Use the DynamoDB client SDK for Node.js and JavaScript.",
        tokenEstimate: 26,
        links: [],
        entityIds: [],
        contentHash: hash,
        facets: [],
      },
      {
        id: "chunk_auth",
        pageId: "page_auth",
        headingPath: ["Authentication"],
        text: "Configure AWS credentials. Pass a config object to DynamoDBClient with region. Use DynamoDBClient to create the base SDK client. Configure with environment variables AWS_REGION and AWS_ACCESS_KEY_ID.",
        tokenEstimate: 34,
        links: [],
        entityIds: [],
        contentHash: hash,
        facets: [],
      },
      {
        id: "chunk_pagination",
        pageId: "page_pagination",
        headingPath: ["Pagination"],
        text: "Use ExclusiveStartKey and LastEvaluatedKey to page through DynamoDB query results. Send QueryCommand via DynamoDBDocumentClient. Loop with do-while until LastEvaluatedKey is undefined. Collect all Items across pages.",
        tokenEstimate: 40,
        links: [],
        entityIds: [],
        contentHash: hash,
        facets: [],
      },
    ],
    entities: [],
    edges: [],
    taskPacks: [
      {
        id: "installation",
        title: "Installation",
        description: "Install the documented packages using source-backed commands.",
        confidence: "high",
        requiredPages: ["page_install"],
        relatedEntities: [],
        steps: [{
          title: "Install with npm",
          description: "Run npm install to add the AWS SDK packages to your project.",
          evidence: [{ source: "heading", pageId: "page_install", headingId: "heading_install", repoPath: "docs/installation.md" }],
        }],
        gotchas: [],
        codeExamples: ["npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb"],
        evidence: [{ source: "heading", pageId: "page_install", headingId: "heading_install", repoPath: "docs/installation.md" }],
        context: { facets: {}, conflicts: [] },
      },
      {
        id: "authentication",
        title: "Authentication",
        description: "Configure authentication using documented credentials and constraints.",
        confidence: "high",
        requiredPages: ["page_auth"],
        relatedEntities: [],
        steps: [{
          title: "Configure DynamoDB client",
          description: "Create DynamoDBClient with region config. Use environment variables for credentials.",
          evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
        }],
        gotchas: [],
        codeExamples: ["const client = new DynamoDBClient({ region: process.env.AWS_REGION });"],
        evidence: [{ source: "heading", pageId: "page_auth", headingId: "heading_auth", repoPath: "docs/auth.md" }],
        context: { facets: {}, conflicts: [] },
      },
      {
        id: "pagination",
        title: "Pagination",
        description: "Implement pagination using ExclusiveStartKey and LastEvaluatedKey.",
        confidence: "high",
        requiredPages: ["page_pagination"],
        relatedEntities: [],
        steps: [{
          title: "Loop with ExclusiveStartKey",
          description: "Use do-while loop with ExclusiveStartKey from LastEvaluatedKey to fetch all pages from DynamoDB QueryCommand responses.",
          evidence: [{ source: "heading", pageId: "page_pagination", headingId: "heading_pagination", repoPath: "docs/pagination.md" }],
        }],
        gotchas: [],
        codeExamples: [
          "let lastEvaluatedKey;\ndo {\n  const params = { TableName, ExclusiveStartKey: lastEvaluatedKey };\n  const response = await docClient.send(new QueryCommand(params));\n  items.push(...response.Items);\n  lastEvaluatedKey = response.LastEvaluatedKey;\n} while (lastEvaluatedKey);",
        ],
        evidence: [{ source: "heading", pageId: "page_pagination", headingId: "heading_pagination", repoPath: "docs/pagination.md" }],
        context: { facets: {}, conflicts: [] },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Routing regression tests for overlapping install/auth/pagination vocabulary.
// ---------------------------------------------------------------------------

describe("TaskContextAssembler routing with overlapping task vocabulary", () => {
  it("routes DynamoDB pagination goal to pagination pack, not installation/auth", () => {
    const assembler = new TaskContextAssembler({ agentMap: awsLikeFixtureMap() });

    const result = assembler.queryDocs({
      goal: "Implement pagination for querying a DynamoDB table using ExclusiveStartKey and LastEvaluatedKey",
    });

    expect(result.task).toBe("pagination");
    expect(result.answer).toContain("Pagination");
    expect(result.answer).not.toContain("Installation");
    expect(result.answer).not.toContain("Authentication");
  });

  it("routes when goal+task contain specific API names mixed with generic prose", () => {
    const assembler = new TaskContextAssembler({ agentMap: awsLikeFixtureMap() });

    const result = assembler.queryDocs({
      goal: "Write a module in index.js using ES Modules to query all pages from a DynamoDB table using DynamoDB v3",
      task: "Use DynamoDBDocumentClient to paginate query results using ExclusiveStartKey and LastEvaluatedKey",
    });

    expect(result.task).toBe("pagination");
  });

  it("specific API terms in goal outscore generic word frequency in installation/auth packs", () => {
    const assembler = new TaskContextAssembler({ agentMap: awsLikeFixtureMap() });

    const result = assembler.queryDocs({
      goal: "Retrieve all pages from a DynamoDB table using DynamoDB v3 SDK",
      task: "Implement pagination using ExclusiveStartKey and LastEvaluatedKey",
    });

    expect(result.task).toBe("pagination");
  });

  it("falls back correctly when goal truly matches installation", () => {
    const assembler = new TaskContextAssembler({ agentMap: awsLikeFixtureMap() });

    const result = assembler.queryDocs({
      goal: "Install the AWS SDK packages using npm install",
    });

    expect(result.task).toBe("installation");
  });

  it("falls back correctly when goal truly matches authentication", () => {
    const assembler = new TaskContextAssembler({ agentMap: awsLikeFixtureMap() });

    const result = assembler.queryDocs({
      goal: "Configure AWS credentials and authentication for DynamoDBClient",
    });

    expect(result.task).toBe("authentication");
  });

  it("routes pagination goal correctly even when pagination pack has generic step text", () => {
    // The pagination pack's step description is generic while installation and
    // authentication contain many overlapping SDK terms. Specific pagination
    // terms should still control routing.
    const map = awsLikeFixtureMap();

    // Make pagination pack step generic (no explicit ExclusiveStartKey mention)
    map.taskPacks[2]!.steps[0]!.description =
      "Implement paging through results using the SDK pagination pattern.";

    // Make installation pack extremely verbose with many generic tokens
    map.taskPacks[0]!.steps[0]!.description =
      "Use the DynamoDB SDK to install and configure modules. " +
      "Run the npm install command in your DynamoDB table project directory. " +
      "Use the DynamoDB v3 SDK module with Node.js. " +
      "This module is required for any DynamoDB table query or scan operation. " +
      "Use the client SDK module to implement DynamoDB functionality.";

    // Make authentication pack also noisy
    map.taskPacks[1]!.steps[0]!.description =
      "Use DynamoDBClient to configure authentication. " +
      "This module requires credentials to query any DynamoDB table using the v3 SDK. " +
      "Implement authentication using the DynamoDB SDK configuration. " +
      "Pass region and credentials when you use the DynamoDB client module.";

    const assembler = new TaskContextAssembler({ agentMap: map });

    const result = assembler.queryDocs({
      goal: "Write a module in index.js using ES Modules to query all pages from a DynamoDB table using DynamoDB v3",
      task: "Use DynamoDBDocumentClient to paginate query results using ExclusiveStartKey and LastEvaluatedKey",
    });

    expect(result.task).toBe("pagination");
  });
});
// ---------------------------------------------------------------------------
// Phase 5 proof-derived generic routing regressions.
// ---------------------------------------------------------------------------

describe("TaskContextAssembler routing from product-proof signals", () => {
  it("routes environment configuration goals to configuration instead of quickstart", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "configure environment variables for local development",
    });

    expect(result.task).toBe("configuration");
  });

  it("routes install and golden workflow goals to installation instead of errors", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "install the package and run the golden workflow",
    });

    expect(result.task).toBe("installation");
  });

  it("routes deployment goals to deployment instead of testing", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "deploy the app to production hosting",
    });

    expect(result.task).toBe("deployment");
  });

  it("routes authentication and policy goals to authentication instead of pagination", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "implement authentication with row level security policies",
    });

    expect(result.task).toBe("authentication");
  });

  it("routes mutation invalidation goals to API usage instead of errors", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "implement a mutation and invalidate cached queries after success",
    });

    expect(result.task).toBe("api-usage");
  });

  it("routes create workflow goals to API usage instead of errors", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "create a scheduled workflow pipeline",
    });

    expect(result.task).toBe("api-usage");
  });

  it("routes true getting-started goals to quickstart", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "quickstart and create the first client",
    });

    expect(result.task).toBe("quickstart");
  });

  it("routes true debugging goals to errors", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "debug task failures and troubleshoot error output",
    });

    expect(result.task).toBe("errors");
  });

  it("routes true testing goals to testing", () => {
    const result = new TaskContextAssembler({ agentMap: genericRoutingFixtureMap() }).queryDocs({
      goal: "test the application with mocks and assertions",
    });

    expect(result.task).toBe("testing");
  });

  it("warns when the top task selection is ambiguous", () => {
    const map = genericRoutingFixtureMap();
    map.taskPacks = map.taskPacks.filter((pack) => pack.id === "quickstart" || pack.id === "api-usage");
    for (const pack of map.taskPacks) {
      pack.description = "Create and use a client with source-backed setup evidence.";
      pack.steps[0]!.description = "Create and use a client with source-backed setup evidence.";
      pack.codeExamples = ["const client = createClient(); await client.use();"];
    }
    const result = new TaskContextAssembler({ agentMap: map }).queryDocs({
      goal: "create and use a client",
    });

    expect(result.warnings.some((warning) => warning.startsWith("ambiguous_task_selection"))).toBe(true);
  });

  it("warns and verifies intent mismatch when search evidence selects a different available pack", () => {
    const map = genericRoutingFixtureMap();
    map.taskPacks = map.taskPacks.filter((pack) => pack.id === "errors");
    const errorsPack = map.taskPacks[0]!;
    errorsPack.description =
      "Configure authentication credentials and credential policies while debugging failures.";
    errorsPack.steps[0]!.description =
      "Configure authentication credentials, tokens, policies, and secrets when debugging failures.";
    const search = {
      query: "configure authentication and credentials",
      results: [{
        title: "Errors and debugging",
        repoPath: "docs/errors.md",
        headingPath: ["Errors and debugging"],
        snippet: "Debug failures by reading error messages.",
        score: 20,
        pageId: "page_errors",
        chunkId: "chunk_errors",
        facets: [],
      }],
      warnings: [],
    };
    const assembler = new TaskContextAssembler({ agentMap: map });

    const result = assembler.queryDocs({
      goal: "configure authentication and credentials",
      search,
    });
    const verification = assembler.verifyContext({
      goal: "configure authentication and credentials",
      search,
    });

    expect(result.task).toBe("errors");
    expect(result.warnings.some((warning) => warning.startsWith("intent_evidence_mismatch"))).toBe(true);
    expect(verification.issues.map((issue) => issue.code)).toContain("intent_evidence_mismatch");
  });

  it("falls back to source-ranked context when no task packs exist", () => {
    const map = genericRoutingFixtureMap();
    map.taskPacks = [];

    const result = new TaskContextAssembler({ agentMap: map }).queryDocs({
      goal: "configure environment variables",
    });

    expect(result.task).toBeUndefined();
    expect(result.steps[0]?.title).toBe("Environment configuration");
    expect(result.warnings).not.toContain("intent_evidence_mismatch");
  });

  it("keeps errors/debugging packs from winning create-and-deploy goals", () => {
    const map = genericRoutingFixtureMap();
    const errorsPack = map.taskPacks.find((pack) => pack.id === "errors")!;
    errorsPack.description =
      "Create, deploy, and configure production applications while troubleshooting every failure.";
    errorsPack.steps[0]!.description =
      "Create, deploy, configure, and publish production applications while debugging errors and failures.";

    const result = new TaskContextAssembler({ agentMap: map }).queryDocs({
      goal: "create and deploy the app to production hosting",
    });

    expect(result.task).toBe("deployment");
  });
});

function genericRoutingFixtureMap(): AgentMap {
  const hash = "e".repeat(64);
  const families = [
    {
      id: "quickstart",
      title: "Quickstart",
      heading: "Getting started",
      text: "Create a new application and initialize the first client. Start with the hello world example.",
      code: "const client = createClient();",
    },
    {
      id: "installation",
      title: "Installation",
      heading: "Install packages",
      text: "Install the package and run the first workflow command after setup.",
      code: "npm install @example/client",
    },
    {
      id: "authentication",
      title: "Authentication",
      heading: "Authentication and policies",
      text: "Authenticate requests with credentials and configure row level security policies before querying protected data.",
      code: "const client = createClient({ token: process.env.API_TOKEN });",
    },
    {
      id: "configuration",
      title: "Configuration",
      heading: "Environment configuration",
      text: "Configure environment variables and options for local development and production.",
      code: "EXAMPLE_API_URL=https://api.example.test\nEXAMPLE_TOKEN=secret",
    },
    {
      id: "deployment",
      title: "Deployment",
      heading: "Deploy to production",
      text: "Deploy the application to production hosting and configure the runtime.",
      code: "npm run deploy",
    },
    {
      id: "testing",
      title: "Testing",
      heading: "Testing",
      text: "Test the application with assertions, mocks, and integration fixtures.",
      code: "expect(result.ok).toBe(true);",
    },
    {
      id: "errors",
      title: "Errors and debugging",
      heading: "Errors and debugging",
      text: "Debug failures by reading error messages, retries, and troubleshooting output.",
      code: "try { await run(); } catch (error) { console.error(error); }",
    },
    {
      id: "pagination",
      title: "Pagination",
      heading: "Pagination",
      text: "Paginate with a cursor and continue until the next page token is empty.",
      code: "while (cursor) { const page = await list({ cursor }); cursor = page.nextCursor; }",
    },
    {
      id: "api-usage",
      title: "API usage",
      heading: "API usage",
      text: "Use routes, middleware, schemas, workflow pipelines, mutations, updates, and invalidation APIs.",
      code: "await mutation.mutate(input, { onSuccess: () => cache.invalidateQueries() });",
    },
  ];
  return AgentMapSchema.parse({
    schemaVersion: "0.2.0",
    pages: families.map((family) => ({
      id: `page_${family.id}`,
      sourceType: "local_markdown",
      repoPath: `docs/${family.id}.md`,
      title: family.title,
      markdown: `# ${family.heading}\n\n${family.text}\n\n\`\`\`ts\n${family.code}\n\`\`\`\n`,
      headings: [{ id: `heading_${family.id}`, depth: 1, text: family.heading, slug: family.heading.toLowerCase().replace(/\s+/g, "-"), position: {} }],
      links: [],
      codeBlocks: [{ id: `code_${family.id}`, language: "ts", value: family.code, sourceHeadingId: `heading_${family.id}` }],
      contentHash: hash,
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
      facets: [],
    })),
    chunks: families.map((family) => ({
      id: `chunk_${family.id}`,
      pageId: `page_${family.id}`,
      headingPath: [family.heading],
      text: family.text,
      tokenEstimate: 24,
      links: [],
      entityIds: [],
      contentHash: hash,
      facets: [],
    })),
    entities: [],
    edges: [],
    taskPacks: families.map((family) => ({
      id: family.id,
      title: family.title,
      description: `Complete ${family.title} with source-backed evidence.`,
      confidence: "high",
      requiredPages: [`page_${family.id}`],
      relatedEntities: [],
      steps: [{
        title: family.heading,
        description: family.text,
        evidence: [{ source: "heading", pageId: `page_${family.id}`, headingId: `heading_${family.id}`, repoPath: `docs/${family.id}.md` }],
      }],
      gotchas: [],
      codeExamples: [family.code],
      evidence: [{ source: "heading", pageId: `page_${family.id}`, headingId: `heading_${family.id}`, repoPath: `docs/${family.id}.md` }],
      context: { facets: {}, conflicts: [] },
    })),
  });
}

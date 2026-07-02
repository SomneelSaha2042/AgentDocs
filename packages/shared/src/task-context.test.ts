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
    expect(result.answer).toContain("sufficient to implement");
    expect(result.followUpRefs).toHaveLength(0);
    expect(JSON.stringify(result)).toContain("code_auth");
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
      taskPacks: [{
        id: "pagination",
        title: "Pagination",
        description: "Implement pagination.",
        confidence: "high",
        requiredPages: ["page_pagination"],
        relatedEntities: [],
        steps: [{
          title: "Use paginate",
          description: largeText,
          evidence: [{ source: "heading", pageId: "page_pagination", headingId: "heading_pagination", repoPath: "docs/pagination.md", quote: largeText }],
        }],
        gotchas: [],
        codeExamples: [],
        evidence: [{ source: "heading", pageId: "page_pagination", headingId: "heading_pagination", repoPath: "docs/pagination.md", quote: largeText }],
        context: { facets: {}, conflicts: [] },
      }],
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

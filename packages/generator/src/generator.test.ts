import { createHash } from "node:crypto";

import { AgentMapSchema, ManifestSchema, TaskPackSchema } from "@agentdocs/shared";
import { describe, expect, it } from "vitest";

import { generateStaticArtifacts } from "./generator.js";

describe("generateStaticArtifacts", () => {
  it("generates deterministic compact evidence-linked artifacts", () => {
    const pageId = "page_fixture";
    const markdown = `# Setup

Install and configure the client.

\`\`\`bash
pnpm add @example/sdk
\`\`\`
`;
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "setup.md",
          title: "Setup",
          description: "Example SDK documentation.",
          markdown,
          headings: [
            {
              id: "heading_setup",
              depth: 1,
              text: "Setup",
              slug: "setup",
              position: { startLine: 1, endLine: 1 },
            },
          ],
          links: [],
          codeBlocks: [
            {
              id: "code_install",
              language: "bash",
              value: "pnpm add @example/sdk",
              sourceHeadingId: "heading_setup",
              extracted: {
                packages: ["@example/sdk"],
                imports: [],
                envVars: [],
                cliCommands: ["pnpm add @example/sdk"],
                httpRoutes: [],
              },
            },
          ],
          contentHash: hash(markdown),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
      ],
      chunks: [
        {
          id: "chunk_setup",
          pageId,
          headingPath: ["Setup"],
          text: markdown.trim(),
          tokenEstimate: 20,
          links: [],
          entityIds: ["package_fixture"],
          contentHash: hash(markdown.trim()),
        },
      ],
      entities: [
        {
          id: "package_fixture",
          type: "package",
          name: "@example/sdk",
          aliases: [],
          sourcePageIds: [pageId],
          evidence: [
            {
              source: "code_block",
              pageId,
              codeBlockId: "code_install",
              repoPath: "setup.md",
              quote: "pnpm add @example/sdk",
            },
          ],
        },
      ],
      edges: [],
      taskPacks: [],
    });

    const first = generateStaticArtifacts({
      agentMap,
      project: { name: "Example SDK", slug: "example-sdk", version: "v2" },
      rules: ["Prefer current SDK examples."],
    });
    const second = generateStaticArtifacts({
      agentMap,
      project: { name: "Example SDK", slug: "example-sdk", version: "v2" },
      rules: ["Prefer current SDK examples."],
    });

    expect(first).toEqual(second);
    expect(ManifestSchema.parse(first.manifest)).toEqual(first.manifest);
    for (const pack of first.taskPacks) {
      expect(TaskPackSchema.parse(pack)).toEqual(pack);
      expect(pack.evidence.length).toBeGreaterThan(0);
    }
    expect({
      agentsMd: first.agentsMd,
      llmsTxt: first.llmsTxt,
      taskPackMarkdown: first.taskPackMarkdown,
    }).toMatchSnapshot();
  });

  it("does not generate task packs from weak keyword-list mentions", () => {
    const markdown = "# Product plan\nTask families include authentication, webhooks, and pagination.";
    const weak = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [{
        id: "page_plan",
        sourceType: "local_markdown",
        repoPath: "plan.md",
        title: "Product plan",
        markdown,
        headings: [{ id: "heading_plan", depth: 1, text: "Product plan", slug: "product-plan", position: {} }],
        links: [],
        codeBlocks: [],
        contentHash: hash(markdown),
        discoveredAt: "1970-01-01T00:00:00.000Z",
        versionHints: [],
      }],
      chunks: [{
        id: "chunk_plan",
        pageId: "page_plan",
        headingPath: ["Product plan"],
        text: markdown,
        tokenEstimate: 10,
        links: [],
        entityIds: [],
        contentHash: hash(markdown),
      }],
      entities: [],
      edges: [],
      taskPacks: [],
    });

    const generated = generateStaticArtifacts({
      agentMap: weak,
      project: { name: "Weak Fixture", slug: "weak-fixture" },
    });

    expect(generated.taskPacks).toEqual([]);
  });

  it("does not select task families from keyword substrings", () => {
    const markdown = "# Prevention\n\nPrevent failures before production.\n";
    const pageId = "page_prevention";
    const generated = generateStaticArtifacts({
      project: { name: "Example", slug: "example" },
      agentMap: AgentMapSchema.parse({
        schemaVersion: "0.1.0",
        pages: [{
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "prevention.md",
          title: "Prevention",
          markdown,
          headings: [{
            id: "heading_prevention",
            depth: 1,
            text: "Prevention",
            slug: "prevention",
            position: { startLine: 1, endLine: 1 },
          }],
          links: [],
          codeBlocks: [],
          contentHash: hash(markdown),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        }],
        chunks: [{
          id: "chunk_prevention",
          pageId,
          headingPath: ["Prevention"],
          text: markdown.trim(),
          tokenEstimate: 10,
          links: [],
          entityIds: [],
          contentHash: hash(markdown.trim()),
        }],
        entities: [],
        edges: [],
        taskPacks: [],
      }),
    });

    expect(generated.taskPacks.some((pack) => pack.id === "webhooks")).toBe(false);
  });

  it("does not generate a webhook pack from generic event headings", () => {
    const markdown = "# Event handlers\n\nRegister a scheduled event handler.\n";
    const generated = generateStaticArtifacts({
      project: { name: "Events", slug: "events" },
      agentMap: singlePageMap("Event handlers", markdown),
    });

    expect(generated.taskPacks.some((pack) => pack.id === "webhooks")).toBe(false);
  });

  it("uses page titles to generate packs for frontmatter-titled pages", () => {
    const markdown = "Use the paginate method to retrieve all pages.";
    const generated = generateStaticArtifacts({
      project: { name: "SDK", slug: "sdk" },
      agentMap: singlePageMap("Pagination", markdown),
    });

    expect(generated.taskPacks.some((pack) => pack.id === "pagination")).toBe(true);
  });

  it("keeps domain-shaped route, invalidation, and schema packs out of defaults", () => {
    const maps = [
      singlePageMap("Route Handlers", "# Route Handlers\n\nCreate a POST route handler in the App Router."),
      singlePageMap("Query invalidation", "# Query invalidation\n\nInvalidate a query after a mutation."),
      singlePageMap("Schema validation", "# Schema validation\n\nBuild a route with JSON schema validation."),
    ];

    for (const [index, agentMap] of maps.entries()) {
      const generated = generateStaticArtifacts({
        project: { name: `Domain Fixture ${index}`, slug: `domain-fixture-${index}` },
        agentMap,
      });
      expect(generated.taskPacks.map((pack) => pack.id)).not.toContain("route-handlers");
      expect(generated.taskPacks.map((pack) => pack.id)).not.toContain("query-invalidation");
      expect(generated.taskPacks.map((pack) => pack.id)).not.toContain("schema-validation");
    }
  });

  it("routes generic HTTP, schema, and mutation evidence to API usage by default", () => {
    const generated = generateStaticArtifacts({
      project: { name: "Generic API Fixture", slug: "generic-api-fixture" },
      agentMap: singlePageMap(
        "API usage",
        "# API usage\n\nCreate a route, validate the request body schema, return a response, and invalidate cached data after a mutation.",
      ),
    });

    expect(generated.taskPacks.some((pack) => pack.id === "api-usage")).toBe(true);
  });

  it("preserves domain-shaped IDs when explicitly configured", () => {
    const markdown = "# Implementation guides\n\nCreate a route handler, validate request schema, and invalidate a query after a mutation.";
    const generated = generateStaticArtifacts({
      project: { name: "Configured Tasks", slug: "configured-tasks" },
      agentMap: singlePageMap("Route handlers query invalidation schema validation", markdown),
      tasks: [
        { id: "route-handlers", title: "Route handlers", queries: ["route handler", "route handlers"], requiredFacets: {} },
        { id: "query-invalidation", title: "Query invalidation", queries: ["query invalidation", "invalidate"], requiredFacets: {} },
        { id: "schema-validation", title: "Schema validation", queries: ["schema validation", "request schema"], requiredFacets: {} },
      ],
    });

    expect(generated.taskPacks.map((pack) => pack.id)).toEqual(expect.arrayContaining([
      "route-handlers",
      "query-invalidation",
      "schema-validation",
    ]));
  });

  it("does not advertise task-pack files when links are disabled", () => {
    const markdown = "# Setup\n\nInstall the SDK.\n";
    const pageId = "page_setup";
    const generated = generateStaticArtifacts({
      linkTaskPacks: false,
      project: { name: "Example", slug: "example" },
      agentMap: AgentMapSchema.parse({
        schemaVersion: "0.1.0",
        pages: [{
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "setup.md",
          title: "Setup",
          markdown,
          headings: [{
            id: "heading_setup",
            depth: 1,
            text: "Setup",
            slug: "setup",
            position: { startLine: 1, endLine: 1 },
          }],
          links: [],
          codeBlocks: [],
          contentHash: hash(markdown),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        }],
        chunks: [{
          id: "chunk_setup",
          pageId,
          headingPath: ["Setup"],
          text: markdown.trim(),
          tokenEstimate: 8,
          links: [],
          entityIds: [],
          contentHash: hash(markdown.trim()),
        }],
        entities: [],
        edges: [],
        taskPacks: [],
      }),
    });

    expect(generated.taskPacks.length).toBeGreaterThan(0);
    expect(generated.llmsTxt).not.toContain("task-packs/");
    expect(generated.agentsMd).not.toContain("task-packs/");
  });

  it("api-usage pack prefers route body schema over compiler customization", () => {
    const pageAId = "page_validation_overview";
    const pageBId = "page_compiler";
    const pageCId = "page_route";

    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageAId,
          sourceType: "local_markdown",
          repoPath: "validation.md",
          title: "Validation",
          markdown: "Broad conceptual chunk about schema validation.",
          headings: [{ id: "heading_validation", depth: 1, text: "Validation", slug: "validation", position: {} }],
          links: [],
          codeBlocks: [],
          contentHash: hash("Broad conceptual chunk about schema validation."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
        {
          id: pageBId,
          sourceType: "local_markdown",
          repoPath: "compiler.md",
          title: "Validator Compiler",
          markdown: "# Validator Compiler\nConfigure a custom validator compiler.",
          headings: [{ id: "heading_compiler", depth: 1, text: "Validator Compiler", slug: "validator-compiler", position: {} }],
          links: [],
          codeBlocks: [
            {
              id: "code_compiler",
              language: "javascript",
              value: "fastify.setValidatorCompiler(compiler);",
              sourceHeadingId: "heading_compiler",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: [] }
            }
          ],
          contentHash: hash("# Validator Compiler\nConfigure a custom validator compiler."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
        {
          id: pageCId,
          sourceType: "local_markdown",
          repoPath: "route.md",
          title: "Route Schema",
          markdown: "# Route Schema\nPOST route body schema validation example.",
          headings: [{ id: "heading_route", depth: 1, text: "Route Schema", slug: "route-schema", position: {} }],
          links: [],
          codeBlocks: [
            {
              id: "code_route",
              language: "javascript",
              value: "fastify.post('/submit', { schema: { body: schema } }, handler);",
              sourceHeadingId: "heading_route",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: ["POST /submit"] }
            }
          ],
          contentHash: hash("# Route Schema\nPOST route body schema validation example."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        }
      ],
      chunks: [
        {
          id: "chunk_validation",
          pageId: pageAId,
          headingPath: ["Validation"],
          text: "Broad conceptual chunk about schema validation.",
          tokenEstimate: 10,
          links: [],
          entityIds: [],
          contentHash: hash("Broad conceptual chunk about schema validation.")
        },
        {
          id: "chunk_compiler",
          pageId: pageBId,
          headingPath: ["Validator Compiler"],
          text: "Configure a custom validator compiler: fastify.setValidatorCompiler(compiler);",
          tokenEstimate: 20,
          links: [],
          entityIds: [],
          contentHash: hash("Configure a custom validator compiler: fastify.setValidatorCompiler(compiler);")
        },
        {
          id: "chunk_route",
          pageId: pageCId,
          headingPath: ["Route Schema"],
          text: "POST route body schema validation example: fastify.post('/submit', { schema: { body: schema } }, handler);",
          tokenEstimate: 25,
          links: [],
          entityIds: [],
          contentHash: hash("POST route body schema validation example: fastify.post('/submit', { schema: { body: schema } }, handler);")
        }
      ],
      entities: [],
      edges: [],
      taskPacks: []
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Schema Test", slug: "schema-test" }
    });

    const pack = generated.taskPacks.find((p) => p.id === "api-usage");
    expect(pack).toBeDefined();
    if (!pack) throw new Error("pack is undefined");
    expect(pack.requiredPages).toContain(pageCId);
    const example = pack.codeExamples[0];
    if (!example) throw new Error("example is undefined");
    expect(typeof example === "string" ? example : example.value).toContain("fastify.post('/submit'");
    expect(example).not.toContain("setValidatorCompiler");
  });

  it("confidence degrades without implementation-shaped evidence", () => {
    const pageId = "page_conceptual";
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "conceptual.md",
          title: "Schema validation",
          markdown: "This is a conceptual page explaining json schema and how to validate schema in general terms.",
          headings: [{ id: "heading_concept", depth: 1, text: "Schema validation", slug: "schema-validation", position: {} }],
          links: [],
          codeBlocks: [],
          contentHash: hash("This is a conceptual page explaining json schema and how to validate schema in general terms."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        }
      ],
      chunks: [
        {
          id: "chunk_conceptual",
          pageId,
          headingPath: ["Schema validation"],
          text: "This is a conceptual page explaining json schema and how to validate schema in general terms.",
          tokenEstimate: 20,
          links: [],
          entityIds: [],
          contentHash: hash("This is a conceptual page explaining json schema and how to validate schema in general terms.")
        }
      ],
      entities: [],
      edges: [],
      taskPacks: []
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Concept Test", slug: "concept-test" }
    });

    const pack = generated.taskPacks.find((p) => p.id === "api-usage");
    expect(pack).toBeDefined();
    expect(pack?.confidence).not.toBe("high");
  });

  it("associates implementation-shaped code with the chunk that contains it", () => {
    const pageId = "page_route_handlers";
    const prose = "Use request body schema validation for route handlers.";
    const code = "fastify.post('/submit', { schema: { body: submitSchema } }, handler)";
    const codeChunkText = `\`\`\`ts\n${code}\n\`\`\``;
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "routes.md",
          title: "Route handlers",
          markdown: `# Route handlers\n\n${prose}\n\n${codeChunkText}`,
          headings: [{ id: "heading_routes", depth: 1, text: "Route handlers", slug: "route-handlers", position: {} }],
          links: [],
          codeBlocks: [
            {
              id: "code_route",
              language: "ts",
              value: code,
              sourceHeadingId: "heading_routes",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: ["POST /submit"] },
            },
          ],
          contentHash: hash(` # Route handlers ${prose} ${codeChunkText}`),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
      ],
      chunks: [
        {
          id: "chunk_a_prose",
          pageId,
          headingPath: ["Route handlers"],
          text: prose,
          tokenEstimate: 12,
          links: [],
          entityIds: [],
          contentHash: hash(prose),
        },
        {
          id: "chunk_z_code",
          pageId,
          headingPath: ["Route handlers"],
          text: codeChunkText,
          tokenEstimate: 20,
          links: [],
          entityIds: [],
          contentHash: hash(codeChunkText),
        },
      ],
      entities: [],
      edges: [],
      taskPacks: [],
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Routes", slug: "routes" },
    });

    const pack = generated.taskPacks.find((p) => p.id === "api-usage");
    expect(pack).toBeDefined();
    expect(pack?.steps[0]?.evidence[0]?.quote).toContain("fastify.post");
    expect(generated.taskPackMarkdown["api-usage"]).toContain("## Diagnostics");
    expect(generated.taskPackMarkdown["api-usage"]).toContain("HTTP route or endpoint evidence");
  });

  it("does not include unrelated page code examples when ranked chunks do not contain them", () => {
    const pageId = "page_auth";
    const authText = "Authentication requires an API key token credential.";
    const unrelatedCode = "client.deleteEverything({ force: true });";
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "auth.md",
          title: "Authentication",
          markdown: `# Authentication\n\n${authText}\n\n## Cleanup\n\n\`\`\`ts\n${unrelatedCode}\n\`\`\``,
          headings: [
            { id: "heading_auth", depth: 1, text: "Authentication", slug: "authentication", position: {} },
            { id: "heading_cleanup", depth: 2, text: "Cleanup", slug: "cleanup", position: {} },
          ],
          links: [],
          codeBlocks: [
            {
              id: "code_cleanup",
              language: "ts",
              value: unrelatedCode,
              sourceHeadingId: "heading_cleanup",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: [] },
            },
          ],
          contentHash: hash(authText),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
      ],
      chunks: [
        {
          id: "chunk_auth",
          pageId,
          headingPath: ["Authentication"],
          text: authText,
          tokenEstimate: 12,
          links: [],
          entityIds: [],
          contentHash: hash(authText),
        },
      ],
      entities: [],
      edges: [],
      taskPacks: [],
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Auth", slug: "auth" },
    });

    const pack = generated.taskPacks.find((p) => p.id === "authentication");
    expect(pack).toBeDefined();
    expect(pack?.codeExamples).toEqual([]);
  });

  it("includes same-heading code examples when prose and code split into sibling chunks", () => {
    const pageId = "page_setup";
    const prose = "Install the package and create a client for authentication.";
    const code = "import { Client } from \"@acme/sdk\";\nconst client = new Client({ apiKey });";
    const codeChunkText = `\`\`\`ts\n${code}\n\`\`\``;
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "setup.md",
          title: "Setup",
          markdown: `# Setup\n\n${prose}\n\n${codeChunkText}`,
          headings: [
            { id: "heading_setup", depth: 1, text: "Setup", slug: "setup", position: {} },
          ],
          links: [],
          codeBlocks: [
            {
              id: "code_setup",
              language: "ts",
              value: code,
              sourceHeadingId: "heading_setup",
              extracted: { packages: [], imports: ["@acme/sdk"], envVars: [], cliCommands: [], httpRoutes: [] },
            },
          ],
          contentHash: hash(`${prose}\n${codeChunkText}`),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
      ],
      chunks: [
        {
          id: "chunk_setup_prose",
          pageId,
          headingPath: ["Setup"],
          text: prose,
          tokenEstimate: 12,
          links: [],
          entityIds: [],
          contentHash: hash(prose),
        },
        {
          id: "chunk_setup_code",
          pageId,
          headingPath: ["Setup"],
          text: codeChunkText,
          tokenEstimate: 20,
          links: [],
          entityIds: [],
          contentHash: hash(codeChunkText),
        },
      ],
      entities: [],
      edges: [],
      taskPacks: [],
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Setup", slug: "setup" },
    });

    const pack = generated.taskPacks.find((p) => p.id === "quickstart");
    expect(pack).toBeDefined();
    expect(typeof pack?.codeExamples[0] === "string" ? pack.codeExamples[0] : pack?.codeExamples[0]?.value).toContain("new Client");
  });

  it("filters unrelated same-heading sibling code examples", () => {
    const pageId = "page_setup";
    const prose = "Install the package and create a client for authentication.";
    const clientCode = "import { Client } from \"@acme/sdk\";\nconst client = new Client({ apiKey });";
    const cleanupCode = "client.deleteEverything({ force: true });";
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageId,
          sourceType: "local_markdown",
          repoPath: "setup.md",
          title: "Setup",
          markdown: `# Setup\n\n${prose}`,
          headings: [
            { id: "heading_setup", depth: 1, text: "Setup", slug: "setup", position: {} },
          ],
          links: [],
          codeBlocks: [
            {
              id: "code_client",
              language: "ts",
              value: clientCode,
              sourceHeadingId: "heading_setup",
              extracted: { packages: [], imports: ["@acme/sdk"], envVars: [], cliCommands: [], httpRoutes: [] },
            },
            {
              id: "code_cleanup",
              language: "ts",
              value: cleanupCode,
              sourceHeadingId: "heading_setup",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: [] },
            },
          ],
          contentHash: hash(prose),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
      ],
      chunks: [
        {
          id: "chunk_setup_prose",
          pageId,
          headingPath: ["Setup"],
          text: prose,
          tokenEstimate: 12,
          links: [],
          entityIds: [],
          contentHash: hash(prose),
        },
      ],
      entities: [],
      edges: [],
      taskPacks: [],
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Setup", slug: "setup" },
    });

    const pack = generated.taskPacks.find((p) => p.id === "quickstart");
    expect(pack).toBeDefined();
    expect(pack?.codeExamples.map((example) => typeof example === "string" ? example : example.value)).toEqual([clientCode]);
  });

  it("counts same-heading sibling code as implementation evidence for confidence", () => {
    const firstCode = "import { Client } from \"@acme/sdk\";\nconst client = new Client({ apiKey });";
    const secondCode = "const client = createClient({ token });";
    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: "page_quickstart",
          sourceType: "local_markdown",
          repoPath: "quickstart.md",
          title: "Quickstart",
          markdown: "# Setup\n\nQuickstart setup create a client for authentication.",
          headings: [{ id: "heading_quickstart", depth: 1, text: "Setup", slug: "setup", position: {} }],
          links: [],
          codeBlocks: [
            {
              id: "code_quickstart",
              language: "ts",
              value: firstCode,
              sourceHeadingId: "heading_quickstart",
              extracted: { packages: [], imports: ["@acme/sdk"], envVars: [], cliCommands: [], httpRoutes: [] },
            },
          ],
          contentHash: hash("Quickstart setup create a client for authentication."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
        {
          id: "page_getting_started",
          sourceType: "local_markdown",
          repoPath: "getting-started.md",
          title: "Getting started",
          markdown: "# Setup\n\nGetting started setup create a client.",
          headings: [{ id: "heading_getting_started", depth: 1, text: "Setup", slug: "setup", position: {} }],
          links: [],
          codeBlocks: [
            {
              id: "code_getting_started",
              language: "ts",
              value: secondCode,
              sourceHeadingId: "heading_getting_started",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: [] },
            },
          ],
          contentHash: hash("Getting started setup create a client."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
      ],
      chunks: [
        {
          id: "chunk_quickstart_prose",
          pageId: "page_quickstart",
          headingPath: ["Setup"],
          text: "Quickstart setup create a client for authentication.",
          tokenEstimate: 12,
          links: [],
          entityIds: [],
          contentHash: hash("Quickstart setup create a client for authentication."),
        },
        {
          id: "chunk_getting_started_prose",
          pageId: "page_getting_started",
          headingPath: ["Setup"],
          text: "Getting started setup create a client.",
          tokenEstimate: 12,
          links: [],
          entityIds: [],
          contentHash: hash("Getting started setup create a client."),
        },
      ],
      entities: [],
      edges: [],
      taskPacks: [],
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Setup", slug: "setup" },
    });

    const pack = generated.taskPacks.find((p) => p.id === "quickstart");
    expect(pack).toBeDefined();
    expect(pack?.confidence).toBe("high");
  });

  it("advanced heading chunks are deprioritized", () => {
    const pageAId = "page_basic";
    const pageBId = "page_advanced";

    const agentMap = AgentMapSchema.parse({
      schemaVersion: "0.1.0",
      pages: [
        {
          id: pageAId,
          sourceType: "local_markdown",
          repoPath: "basic.md",
          title: "Pagination Basics",
          markdown: "Use the loop pattern to retrieve all pages.",
          headings: [{ id: "heading_basic", depth: 1, text: "Pagination Basics", slug: "pagination-basics", position: {} }],
          links: [],
          codeBlocks: [
            {
              id: "code_basic",
              value: "for await (const page of paginator(client)) {}",
              sourceHeadingId: "heading_basic",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: [] }
            }
          ],
          contentHash: hash("Use the loop pattern to retrieve all pages."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        },
        {
          id: pageBId,
          sourceType: "local_markdown",
          repoPath: "advanced.md",
          title: "Advanced Custom Pagination Internals",
          markdown: "How the compiler custom page mechanism works internally.",
          headings: [{ id: "heading_advanced", depth: 1, text: "Advanced Custom Pagination Internals", slug: "advanced-custom-pagination-internals", position: {} }],
          links: [],
          codeBlocks: [
            {
              id: "code_advanced",
              value: "const cursor = internalCursorResolver();",
              sourceHeadingId: "heading_advanced",
              extracted: { packages: [], imports: [], envVars: [], cliCommands: [], httpRoutes: [] }
            }
          ],
          contentHash: hash("How the compiler custom page mechanism works internally."),
          discoveredAt: "1970-01-01T00:00:00.000Z",
          versionHints: [],
        }
      ],
      chunks: [
        {
          id: "chunk_basic",
          pageId: pageAId,
          headingPath: ["Pagination Basics"],
          text: "Use the loop pattern to retrieve all pages. for await (const page of paginator(client)) {}",
          tokenEstimate: 20,
          links: [],
          entityIds: [],
          contentHash: hash("Use the loop pattern to retrieve all pages. for await (const page of paginator(client)) {}")
        },
        {
          id: "chunk_advanced",
          pageId: pageBId,
          headingPath: ["Advanced Custom Pagination Internals"],
          text: "How the compiler custom page mechanism works internally. const cursor = internalCursorResolver();",
          tokenEstimate: 20,
          links: [],
          entityIds: [],
          contentHash: hash("How the compiler custom page mechanism works internally. const cursor = internalCursorResolver();")
        }
      ],
      entities: [],
      edges: [],
      taskPacks: []
    });

    const generated = generateStaticArtifacts({
      agentMap,
      project: { name: "Pagination Test", slug: "pagination-test" }
    });

    const pack = generated.taskPacks.find((p) => p.id === "pagination");
    expect(pack).toBeDefined();
    if (!pack) throw new Error("pack is undefined");
    const step = pack.steps[0];
    if (!step) throw new Error("step is undefined");
    expect(step.title).toBe("Pagination Basics");
    const example = pack.codeExamples[0];
    if (!example) throw new Error("example is undefined");
    expect(typeof example === "string" ? example : example.value).toContain("for await");
  });
});

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function singlePageMap(title: string, markdown: string) {
  const pageId = `page_${title.toLowerCase().replace(/\W+/g, "_")}`;
  return AgentMapSchema.parse({
    schemaVersion: "0.1.0",
    pages: [{
      id: pageId,
      sourceType: "local_markdown",
      repoPath: `${title.toLowerCase().replace(/\W+/g, "-")}.md`,
      title,
      markdown,
      headings: [],
      links: [],
      codeBlocks: [],
      contentHash: hash(markdown),
      discoveredAt: "1970-01-01T00:00:00.000Z",
      versionHints: [],
    }],
    chunks: [{
      id: `chunk_${pageId}`,
      pageId,
      headingPath: [title],
      text: markdown,
      tokenEstimate: 10,
      links: [],
      entityIds: [],
      contentHash: hash(markdown),
    }],
    entities: [],
    edges: [],
    taskPacks: [],
  });
}

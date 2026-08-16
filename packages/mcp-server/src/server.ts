import { createInterface } from "node:readline";

import type {
  BrowseDocsResponse,
  DocumentationMapRelationType,
  QueryDocsResponse,
  ReadPageResponse,
} from "@agentdocs/shared";

import { ArtifactService, McpArtifactError, type ArtifactServiceOptions } from "./artifacts.js";

export type McpServerOptions = ArtifactServiceOptions & {
  version?: string;
  allowedTools?: string[];
};

type JsonRpcId = number | string | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

const DOCUMENTATION_RELATIONS: DocumentationMapRelationType[] = [
  "contains",
  "precedes",
  "follows",
  "links_to",
  "mentions",
  "occurs_in",
  "context_for",
  "defines",
  "uses",
  "requires",
  "example_for",
  "error_for",
  "deprecated_by",
  "introduced_in",
  "versioned_as",
  "related_to",
];

const TOOLS = [
  tool("browse_docs", "Browse the compiled documentation ontology without a text query. Start at agentdocs://map, inspect bounded structural and semantic relations, then follow the refs that best fit your task. Use cursor to continue a large neighborhood.", {
    ref: stringProperty("Map, collection, page, section, block, entity, or task ref. Defaults to agentdocs://map."),
    cursor: stringProperty("Opaque continuation cursor returned by browse_docs for this ref."),
    limit: { type: "integer", minimum: 1, maximum: 50 },
    relations: {
      type: "array",
      items: { type: "string", enum: DOCUMENTATION_RELATIONS },
      minItems: 1,
    },
  }, []),
  tool("read_docs", "Read exact source content for a page, section, block, or code ref selected through browse_docs. Pass the ref unchanged.", {
    ref: stringProperty("Exact AgentDocs page reference, for example agentdocs://pages/page_id.md#target_id."),
  }, ["ref"]),
  tool("query_docs", "Start with this evidence-linked query, then refine it with scopeRefs or continue the returned navigationCursor when the context map is incomplete. Put the outcome in goal and any provider, adapter, framework, API, or constraint details in task. Task-pack matches are relevance hints only; the full corpus is searched. If readiness is INSPECT, read every follow-up marked requiredFor before writing; if STOP, resolve the missing evidence or conflict.", {
    goal: stringProperty(),
    task: stringProperty(),
    facets: { type: "object", additionalProperties: { type: "string" } },
    scopeRefs: {
      type: "array",
      items: stringProperty("A page or heading ref from the returned context map."),
      minItems: 1,
    },
    navigationCursor: stringProperty("Continue the context map from the cursor returned by query_docs."),
  }, ["goal"]),
  tool("read_page", "Read the exact source reference returned by query_docs. Pass its ref unchanged; required reads must be completed before implementation.", {
    ref: stringProperty("Exact AgentDocs reference, for example agentdocs://pages/page_id.md#chunk_id."),
  }, ["ref"]),
  tool("search_docs", "Search built documentation artifacts.", {
    query: stringProperty(),
    limit: integerProperty(),
    filters: {
      type: "object",
      properties: {
        task: stringProperty(),
        facets: { type: "object", additionalProperties: { type: "string" } },
      },
      additionalProperties: false,
    },
  }, ["query"]),
  tool("get_page", "Get a normalized documentation page by stable ID.", {
    pageId: stringProperty(),
  }, ["pageId"]),
  tool("get_task_pack", "Get an evidence-linked task pack.", {
    task: stringProperty(),
  }, ["task"]),
  tool("get_agent_start_context", "Get compact starting context for a goal.", {
    goal: stringProperty(),
    facets: { type: "object", additionalProperties: { type: "string" } },
  }, ["goal"]),
  tool("list_available_tasks", "List generated task packs and their warnings.", {}, []),
  tool("get_task_context", "Get an agent handoff bundle for a task goal.", {
    goal: stringProperty(),
    facets: { type: "object", additionalProperties: { type: "string" } },
  }, ["goal"]),
  tool("verify_task_context", "Check whether task context is fresh, consistent, and evidence-backed.", {
    task: stringProperty(),
    facets: { type: "object", additionalProperties: { type: "string" } },
  }, ["task"]),
  tool("explain_warning", "Explain an AgentDocs warning code.", {
    code: stringProperty(),
  }, ["code"]),
  tool("get_setup_commands", "Get documented installation/setup commands.", {}, []),
  tool("get_version_policy", "Get preferred version and version evidence.", {}, []),
  tool("get_code_examples", "Find source-linked code examples.", {
    query: stringProperty(),
    language: stringProperty(),
    limit: integerProperty(),
  }, ["query"]),
  tool("find_code_examples", "Find source-linked code examples.", {
    query: stringProperty(),
    language: stringProperty(),
    limit: integerProperty(),
  }, ["query"]),
  tool("get_related_pages", "Get pages connected by documented internal links.", {
    pageId: stringProperty(),
    limit: integerProperty(),
  }, ["pageId"]),
];

const RESOURCES = [
  resource("agentdocs://llms.txt", "text/plain"),
  resource("agentdocs://AGENTS.md", "text/markdown"),
  resource("agentdocs://manifest.json", "application/json"),
  resource("agentdocs://agent-map.json", "application/json"),
  resource("agentdocs://documentation-map.json", "application/json"),
];

const RESOURCE_TEMPLATES = [
  { uriTemplate: "agentdocs://task-packs/{task}.md", name: "task-packs", mimeType: "text/markdown" },
  { uriTemplate: "agentdocs://pages/{pageId}.md", name: "pages", mimeType: "text/markdown" },
];

export function createMcpRequestHandler(options: McpServerOptions, service = new ArtifactService(options)) {
  return async (request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> => {
    if (request.id === undefined) {
      return undefined;
    }
    try {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: await dispatch(service, request, options.version ?? "development", options),
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: protocolError(error),
      };
    }
  };
}

export async function serveAgentDocsMcp(options: McpServerOptions): Promise<void> {
  const artifacts = new ArtifactService(options);
  try {
    await artifacts.validateArtifacts();
    const handle = createMcpRequestHandler(options, artifacts);
    const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of input) {
      if (line.trim().length === 0) {
        continue;
      }
      let request: JsonRpcRequest;
      try {
        request = parseRequest(line);
      } catch (error) {
        process.stdout.write(`${JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: protocolError(error),
        })}\n`);
        continue;
      }
      const response = await handle(request);
      if (response !== undefined) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    }
  } finally {
    await artifacts.close();
  }
}

async function dispatch(
  service: ArtifactService,
  request: JsonRpcRequest,
  version: string,
  options?: McpServerOptions,
): Promise<unknown> {
  switch (request.method) {
    case "initialize":
      return {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "agentdocs", version },
      };
    case "ping":
      return {};
    case "tools/list": {
      const allowed = options?.allowedTools;
      const filteredTools = allowed
        ? TOOLS.filter(t => allowed.includes(t.name))
        : TOOLS;
      return { tools: filteredTools };
    }
    case "tools/call":
      return callTool(service, request.params, options?.allowedTools);
    case "resources/list":
      return { resources: RESOURCES };
    case "resources/templates/list":
      return { resourceTemplates: RESOURCE_TEMPLATES };
    case "resources/read":
      return readResource(service, request.params);
    default:
      throw new ProtocolError(-32601, `Method "${request.method}" was not found.`);
  }
}

async function callTool(
  service: ArtifactService,
  params?: Record<string, unknown>,
  allowedTools?: string[],
): Promise<unknown> {
  const name = requiredString(params?.name, "name");
  if (allowedTools !== undefined && !allowedTools.includes(name)) {
    return toolError({
      code: "TOOL_NOT_ALLOWED",
      message: `Tool "${name}" is not allowed by this MCP server configuration.`,
    });
  }
  const args = isRecord(params?.arguments) ? params.arguments : {};
  try {
    let result: unknown;
    switch (name) {
      case "browse_docs":
        result = await service.browseDocs({
          ref: optionalString(args.ref),
          cursor: optionalString(args.cursor),
          limit: optionalInteger(args.limit),
          relations: optionalRelations(args.relations),
        });
        break;
      case "read_docs":
        result = await service.readDocs(requiredString(args.ref, "ref"));
        break;
      case "search_docs":
        result = await service.searchDocs(
          requiredString(args.query, "query"),
          optionalInteger(args.limit),
          isRecord(args.filters) ? optionalString(args.filters.task) : undefined,
          isRecord(args.filters) && isRecord(args.filters.facets) ? stringRecord(args.filters.facets) : undefined,
        );
        break;
      case "query_docs":
        result = await service.queryDocs(
          requiredString(args.goal, "goal"),
          optionalString(args.task),
          isRecord(args.facets) ? stringRecord(args.facets) : undefined,
          {
            scopeRefs: optionalStringArray(args.scopeRefs, "scopeRefs"),
            navigationCursor: optionalString(args.navigationCursor),
          },
        );
        break;
      case "read_page":
        result = await service.readPage(requiredString(args.ref, "ref"));
        break;
      case "get_page": {
        const page = await service.getPage(requiredString(args.pageId, "pageId"));
        result = { 
          page: {
            id: page.id,
            title: page.title,
            sourceUrl: page.sourceUrl,
            repoPath: page.repoPath,
            markdown: page.markdown,
            versionHints: page.versionHints
          }
        };
        break;
      }
      case "get_task_pack":
        result = { taskPack: await service.getTaskPack(requiredString(args.task, "task")) };
        break;
      case "get_agent_start_context":
        result = await service.getAgentStartContext(
          requiredString(args.goal, "goal"),
          isRecord(args.facets) ? stringRecord(args.facets) : undefined,
        );
        break;
      case "list_available_tasks":
        result = await service.listAvailableTasks();
        break;
      case "get_task_context":
        result = await service.getTaskContext(
          requiredString(args.goal, "goal"),
          isRecord(args.facets) ? stringRecord(args.facets) : undefined,
        );
        break;
      case "verify_task_context":
        result = await service.verifyTaskContext(
          requiredString(args.task, "task"),
          isRecord(args.facets) ? stringRecord(args.facets) : undefined,
        );
        break;
      case "explain_warning":
        result = await service.explainWarning(requiredString(args.code, "code"));
        break;
      case "get_setup_commands":
        result = await service.getSetupCommands();
        break;
      case "get_version_policy":
        result = await service.getVersionPolicy();
        break;
      case "get_code_examples":
      case "find_code_examples":
        result = await service.getCodeExamples(
          requiredString(args.query, "query"),
          optionalString(args.language),
          optionalInteger(args.limit),
        );
        break;
      case "get_related_pages":
        result = await service.getRelatedPages(
          requiredString(args.pageId, "pageId"),
          optionalInteger(args.limit),
        );
        break;
      default:
        throw new ProtocolError(-32602, `Tool "${name}" was not found.`);
    }
    return toolResult(name, result);
  } catch (error) {
    const structured = artifactError(error);
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(structured) }],
      structuredContent: structured,
    };
  }
}

function toolError(structured: { code: string; message: string }) {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured,
  };
}

function toolResult(name: string, result: unknown) {
  return {
    content: [{ type: "text", text: formatToolText(name, result) }],
    structuredContent: result,
  };
}

function formatToolText(name: string, result: unknown): string {
  if (name === "browse_docs" && isBrowseDocsResponse(result)) {
    return formatBrowseDocs(result);
  }
  if (name === "query_docs" && isQueryDocsResponse(result)) {
    return formatQueryDocs(result);
  }
  if ((name === "read_docs" || name === "read_page") && isReadPageResponse(result)) {
    return formatReadPage(result, name);
  }
  return JSON.stringify(result);
}

function formatBrowseDocs(result: BrowseDocsResponse): string {
  const lines = [
    `${result.node.kind}: ${result.node.label}`,
    `Ref: ${result.node.ref}`,
    result.node.preview === undefined ? undefined : `Preview: ${result.node.preview}`,
  ].filter((line): line is string => line !== undefined);
  if (result.breadcrumbs.length > 0) {
    lines.push(`Path: ${result.breadcrumbs.map((node) => node.label).join(" > ")}`);
  }
  for (const relation of result.relations) {
    lines.push("", `${relation.direction} ${relation.type}:`);
    for (const node of relation.nodes) {
      const counts = [
        node.childCount > 0 ? `children=${node.childCount}` : undefined,
        node.evidenceCount > 0 ? `evidence=${node.evidenceCount}` : undefined,
      ].filter((value): value is string => value !== undefined);
      lines.push(`- ${node.label} (${node.kind}): ${node.ref}${counts.length === 0 ? "" : ` [${counts.join(", ")}]`}`);
      if (node.preview !== undefined) lines.push(`  ${node.preview}`);
    }
  }
  if (!result.complete && result.nextCursor !== undefined) {
    lines.push("", `More relations remain: browse_docs ref=${result.node.ref} cursor=${result.nextCursor}.`);
  }
  return lines.join("\n");
}

function formatQueryDocs(result: QueryDocsResponse): string {
  const lines = [
    `Answer: ${result.answer}`,
    `Confidence: ${result.confidence}`,
    `Readiness: ${result.readiness.recommendation.toUpperCase()} (${result.readiness.coverage} coverage)`,
  ];
  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((warning) => `- ${warning}`));
  }
  if (result.readiness.gaps.length > 0) {
    lines.push("", "Requirement gaps:", ...result.readiness.gaps.map((gap) =>
      `- ${gap.status}: ${gap.requirement}${gap.ref === undefined ? "" : ` [read: ${gap.ref}]`}`));
  }
  if (result.requirements.length > 0) {
    lines.push("", "Requirement coverage:", ...result.requirements.map((requirement) =>
      `- ${requirement.status}: ${requirement.value} (${requirement.source})`));
  }
  if (result.steps.length > 0) {
    lines.push("", "Steps:", ...result.steps.map((step, index) =>
      `${index + 1}. ${step.title}: ${step.text} ${evidenceLabel(step.evidence)}`));
  }
  if (result.codeExamples.length > 0) {
    lines.push("", "Code examples:");
    for (const example of result.codeExamples) {
      lines.push(`${example.language ?? "text"} ${evidenceLabel(example.evidence)}`, "```", example.value, "```");
    }
  }
  if (result.gotchas.length > 0) {
    lines.push("", "Gotchas:", ...result.gotchas.map((gotcha) =>
      `- ${gotcha.severity}: ${gotcha.text} ${evidenceLabel(gotcha.evidence)}`));
  }
  if (result.followUpRefs.length > 0) {
    const hasRequiredReads = result.followUpRefs.some((ref) => (ref.requiredFor?.length ?? 0) > 0);
    const followUpLabel = hasRequiredReads
      ? "Required source reads before implementation:"
      : result.readiness.recommendation === "inspect"
        ? "Read one cited source before implementation:"
      : "Read only if more source detail is needed:";
    lines.push("", followUpLabel, ...result.followUpRefs.map((ref) =>
      `- ${ref.title}: read_page ref=${ref.ref}${ref.requiredFor === undefined ? "" : ` (for: ${ref.requiredFor.join(", ")})`}`));
  }
  if (result.navigation.branches.length > 0) {
    lines.push("", "Context map:");
    for (const branch of result.navigation.branches) {
      const facetLabel = Object.entries(branch.facets)
        .map(([key, values]) => `${key}=${values.join("|")}`)
        .join(",");
      lines.push(`- ${branch.title}: ${branch.pageRef}${facetLabel.length === 0 ? "" : ` [facets=${facetLabel}]`}`);
      for (const heading of branch.headings) {
        const metadata = [
          `evidence=${heading.evidenceKinds.join("+") || "none"}`,
          `children=${heading.childHeadingCount}`,
          heading.matchedFor.length === 0 ? undefined : `matches=${heading.matchedFor.join("|")}`,
        ].filter((value): value is string => value !== undefined).join(";");
        lines.push(`  - ${heading.headingPath.join(" > ")} (${heading.ref}) [${metadata}]`);
      }
    }
  }
  if (result.navigation.externalReferences.length > 0) {
    lines.push("", "Unresolved external references:", ...result.navigation.externalReferences.map((reference) =>
      `- ${reference.label}: ${reference.url} (from ${reference.sourceRef}; not ingested)`));
  }
  if (!result.navigation.complete && result.navigation.nextCursor !== undefined) {
    lines.push("", `More context map remains: query_docs navigationCursor=${result.navigation.nextCursor}.`);
  }
  if (result.citations.length > 0) {
    lines.push("", "Citations:", ...result.citations.map((citation) => {
      const location = citation.repoPath ?? citation.sourceUrl ?? citation.pageId ?? citation.id;
      return `- ${citation.id}: ${location}`;
    }));
  }
  return lines.join("\n");
}

function formatReadPage(result: ReadPageResponse, toolName: string): string {
  const location = result.section.repoPath ?? result.section.sourceUrl ?? result.section.pageId;
  const heading = result.section.headingPath.length > 0
    ? ` (${result.section.headingPath.join(" > ")})`
    : "";
  return [
    `Source: ${result.section.title}${heading}`,
    `Location: ${location}`,
    result.section.complete ? undefined : `More source remains: call ${toolName} with ref=${result.section.nextRef}.`,
    "",
    result.section.text,
  ].filter((line): line is string => line !== undefined).join("\n");
}

function isBrowseDocsResponse(value: unknown): value is BrowseDocsResponse {
  return isRecord(value)
    && isRecord(value.node)
    && typeof value.node.ref === "string"
    && Array.isArray(value.breadcrumbs)
    && Array.isArray(value.relations)
    && typeof value.complete === "boolean";
}

function evidenceLabel(evidence: QueryDocsResponse["steps"][number]["evidence"]): string {
  const refs = evidence
    .map((item) => item.codeBlockId ?? item.chunkId ?? item.headingId ?? item.pageId ?? item.repoPath ?? item.url)
    .filter((item): item is string => item !== undefined);
  return refs.length === 0 ? "[source]" : `[source: ${refs.slice(0, 2).join(", ")}]`;
}

function isQueryDocsResponse(value: unknown): value is QueryDocsResponse {
  return isRecord(value)
    && typeof value.answer === "string"
    && typeof value.confidence === "string"
    && Array.isArray(value.steps)
    && Array.isArray(value.codeExamples)
    && Array.isArray(value.gotchas)
    && Array.isArray(value.citations)
    && Array.isArray(value.followUpRefs)
    && Array.isArray(value.warnings);
}

function isReadPageResponse(value: unknown): value is ReadPageResponse {
  return isRecord(value)
    && isRecord(value.section)
    && typeof value.section.title === "string"
    && typeof value.section.text === "string";
}

async function readResource(
  service: ArtifactService,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const uri = requiredString(params?.uri, "uri");
  const content = await service.readResource(uri);
  return { contents: [{ uri, ...content }] };
}

function parseRequest(line: string): JsonRpcRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new ProtocolError(-32700, "Invalid JSON.");
  }
  if (
    !isRecord(parsed)
    || parsed.jsonrpc !== "2.0"
    || typeof parsed.method !== "string"
  ) {
    throw new ProtocolError(-32600, "Invalid JSON-RPC request.");
  }
  return parsed as JsonRpcRequest;
}

function protocolError(error: unknown): JsonRpcResponse["error"] {
  if (error instanceof ProtocolError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof McpArtifactError) {
    return { code: -32002, message: error.message, data: { code: error.code } };
  }
  return {
    code: -32603,
    message: error instanceof Error ? error.message : String(error),
  };
}

function artifactError(error: unknown): { code: string; message: string } {
  return error instanceof McpArtifactError
    ? { code: error.code, message: error.message }
    : { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) };
}

class ProtocolError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

function resource(uri: string, mimeType: string) {
  return { uri, name: uri, mimeType };
}

function stringProperty(description?: string) {
  return { type: "string", ...(description ? { description } : {}) };
}

function integerProperty() {
  return { type: "integer", minimum: 1, maximum: 100 };
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new ProtocolError(-32602, `${name} must be a string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredString(value, "value");
}

function optionalStringArray(value: unknown, name: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ProtocolError(-32602, `${name} must be an array of strings.`);
  return value.map((item) => requiredString(item, name));
}

function optionalRelations(value: unknown): DocumentationMapRelationType[] | undefined {
  const relations = optionalStringArray(value, "relations");
  if (relations === undefined) return undefined;
  for (const relation of relations) {
    if (!DOCUMENTATION_RELATIONS.includes(relation as DocumentationMapRelationType)) {
      throw new ProtocolError(-32602, `Unknown documentation relation "${relation}".`);
    }
  }
  return relations as DocumentationMapRelationType[];
}

function optionalInteger(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value)) {
    throw new ProtocolError(-32602, "limit must be an integer.");
  }
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    requiredString(item, `facets.${key}`),
  ]));
}

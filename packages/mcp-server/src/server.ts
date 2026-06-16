import { createInterface } from "node:readline";

import { ArtifactService, McpArtifactError, type ArtifactServiceOptions } from "./artifacts.js";

export type McpServerOptions = ArtifactServiceOptions & {
  version?: string;
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

const TOOLS = [
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
];

const RESOURCE_TEMPLATES = [
  { uriTemplate: "agentdocs://task-packs/{task}.md", name: "task-packs", mimeType: "text/markdown" },
  { uriTemplate: "agentdocs://pages/{pageId}.md", name: "pages", mimeType: "text/markdown" },
];

export function createMcpRequestHandler(options: McpServerOptions) {
  const service = new ArtifactService(options);
  return async (request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> => {
    if (request.id === undefined) {
      return undefined;
    }
    try {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: await dispatch(service, request, options.version ?? "development"),
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
  await artifacts.validateArtifacts();
  const handle = createMcpRequestHandler(options);
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
}

async function dispatch(
  service: ArtifactService,
  request: JsonRpcRequest,
  version: string,
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
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call":
      return callTool(service, request.params);
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
): Promise<unknown> {
  const name = requiredString(params?.name, "name");
  const args = isRecord(params?.arguments) ? params.arguments : {};
  try {
    let result: unknown;
    switch (name) {
      case "search_docs":
        result = await service.searchDocs(
          requiredString(args.query, "query"),
          optionalInteger(args.limit),
          isRecord(args.filters) ? optionalString(args.filters.task) : undefined,
          isRecord(args.filters) && isRecord(args.filters.facets) ? stringRecord(args.filters.facets) : undefined,
        );
        break;
      case "get_page":
        result = { page: await service.getPage(requiredString(args.pageId, "pageId")) };
        break;
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
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    const structured = artifactError(error);
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(structured) }],
      structuredContent: structured,
    };
  }
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

function stringProperty() {
  return { type: "string" };
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

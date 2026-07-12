import { spawn, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rm, cp, mkdtemp, readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const GENERATED_ARTIFACT_NAMES = new Set([
  ".agentdocs",
  "llms.txt",
  "AGENTS.md",
  "agent-map.json",
  "chunks.jsonl",
]);
const PROTECTED_WORKSPACE_FILE_NAMES = new Set([
  "task.md",
  "test.mjs",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
]);
const DOCS_DIR_NAME = "docs";
const MAX_TOOL_RESULT_CHARS = 30000;

class McpClient {
  constructor(cwd, allowedTools = null) {
    this.cwd = cwd;
    this.allowedTools = allowedTools;
    this.child = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async start() {
    const cliPath = path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js");
    const args = ["--cwd", this.cwd, "serve-mcp"];
    if (this.allowedTools) {
      args.push("--tools", this.allowedTools);
    }
    this.child = spawn(process.execPath, [cliPath, ...args], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    const rl = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const response = JSON.parse(line);
        const resolve = this.pendingRequests.get(response.id);
        if (resolve) {
          this.pendingRequests.delete(response.id);
          resolve(response);
        }
      } catch (err) {
        console.error("MCP Client Parse Error:", err);
      }
    });

    await delay(1000);
    return this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "eval-runner", version: "2.0.0" },
    });
  }

  async request(method, params = {}) {
    const id = ++this.requestId;
    const requestPayload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP Request timeout: ${method}`));
      }, 5000);
      this.pendingRequests.set(id, (res) => {
        clearTimeout(timeout);
        resolve(res);
      });
      this.child.stdin.write(`${JSON.stringify(requestPayload)}\n`);
    });
  }

  async listTools() {
    const res = await this.request("tools/list");
    return res.result?.tools || [];
  }

  async callTool(name, args = {}) {
    const res = await this.request("tools/call", { name, arguments: args });
    return res.result;
  }

  async stop() {
    if (this.child) {
      this.child.kill();
    }
  }
}

class RawDocsCorpus {
  constructor(root, mode) {
    this.root = root;
    this.mode = mode;
    this.files = [];
  }

  async load() {
    this.files = await collectTextFiles(this.root);
  }

  search(query, limit = 5) {
    const normalized = normalizeQuery(query);
    const terms = tokenize(normalized);
    const results = this.files
      .map((file) => {
        const title = titleFor(file);
        const haystack = `${title}\n${file.content}`.toLowerCase();
        const score = scoreText(haystack, terms, normalized);
        const snippet = snippetFor(file.content, terms);
        return { file, title, score, snippet };
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.file.relativePath.localeCompare(right.file.relativePath))
      .slice(0, limit);

    if (results.length === 0) {
      return `No raw documentation results found for query: "${query}"`;
    }

    if (this.mode === "web") {
      return results.map((result, index) => [
        `${index + 1}. ${result.title}`,
        `   URL: ${urlFor(result.file.relativePath)}`,
        `   Snippet: ${result.snippet}`,
      ].join("\n")).join("\n\n");
    }

    return results.map((result, index) => [
      `${index + 1}. ${result.title}`,
      `   Path: ${toPosix(result.file.relativePath)}`,
      `   Snippet: ${result.snippet}`,
    ].join("\n")).join("\n\n");
  }

  readRawDoc(relativePath, maxChars = 12000) {
    const safePath = normalizeRelativePath(relativePath);
    const file = this.files.find((candidate) => toPosix(candidate.relativePath) === safePath);
    if (!file) {
      return `Raw documentation file not found: ${relativePath}`;
    }
    return truncate(file.content, maxChars, `raw documentation file ${safePath}`);
  }

  fetchWebpage(url) {
    const parsed = parseDocsExampleUrl(url);
    if (parsed === undefined) {
      return `Webpage fetch error: URL is outside the deterministic docs corpus: ${url}`;
    }
    const file = this.files.find((candidate) => toPosix(candidate.relativePath) === parsed);
    if (!file) {
      return `Error 404: Webpage not found at URL: ${url}`;
    }
    const body = file.extension === ".html" ? cleanRawHtmlToText(file.content) : file.content;
    const noisy = addWebScraperBoilerplate(body, titleFor(file));
    return truncate(noisy, MAX_TOOL_RESULT_CHARS, `webpage ${url}`);
  }
}

async function callAnthropic(messages, tools, system) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      system,
      messages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema || t.input_schema,
      })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API Error (${response.status}): ${text}`);
  }

  return response.json();
}

async function callOpenAI(messages, tools, system, modelName = "gpt-4o") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const openAiMessages = [
    { role: "system", content: system },
    ...messages.map((message) => ({
      role: message.role,
      content: typeof message.content === "string"
        ? message.content
        : message.content.map((part) => part.text || "").join("\n"),
      tool_calls: message.tool_calls,
      name: message.name,
      tool_call_id: message.tool_call_id,
    })),
  ];

  const body = JSON.stringify({
    model: modelName,
    messages: openAiMessages,
    tools: tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema || t.input_schema,
      },
    })),
    seed: globalThis.__agentdocsEvalSeed,
  });

  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    if (response.ok) {
      return response.json();
    }

    const text = await response.text();
    if (response.status === 429 && attempt < 4) {
      const waitSeconds = retryAfterSeconds(response, text) ?? Math.min(30, attempt * 5);
      console.warn(`OpenAI rate limit hit. Retrying in ${waitSeconds}s (attempt ${attempt + 1}/4).`);
      await delay(waitSeconds * 1000);
      continue;
    }

    throw new Error(`OpenAI API Error (${response.status}): ${text}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const taskName = getArg(args, "--task") || "dummy-sdk";
  const seed = Number(getArg(args, "--seed") || "1");
  const provider = getArg(args, "--provider") || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const modelName = getArg(args, "--model") || (provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-20241022");
  const maxCost = parseFloat(getArg(args, "--max-cost") || "1.00");
  const requestedGroup = resolveGroup(args);
  const mcpToolsArg = getArg(args, "--mcp-tools")
    || (requestedGroup === "experimental-agentdocs" ? "query_docs,read_page" : null);
  const keepSandbox = args.includes("--keep-sandbox");
  const dryRun = args.includes("--dry-run");
  globalThis.__agentdocsEvalSeed = seed;

  console.log(`Starting eval run. Task: ${taskName}, Group: ${requestedGroup}, Provider: ${provider}, Model: ${modelName}, Seed: ${seed}, Max Cost: $${maxCost}`);

  const taskDir = path.join(repositoryRoot, "fixtures", "eval-tasks", taskName);
  const sandboxRoot = await mkdtemp(path.join(os.tmpdir(), `agentdocs-eval-${taskName}-${requestedGroup}-`));
  const workspaceDir = path.join(sandboxRoot, "workspace");
  const corpusDir = path.join(sandboxRoot, "raw-docs-corpus");
  const buildDir = path.join(sandboxRoot, "agentdocs-build");
  console.log(`Sandbox root: ${sandboxRoot}`);

  let mcpClient = null;
  let mcpTools = [];
  let cleanupHandled = false;
  const docsTelemetry = { docsBytesReturned: 0, retrievalPayloadTokenEstimate: 0, byTool: {} };

  try {
    await prepareSandbox({ taskDir, workspaceDir, corpusDir, buildDir, group: requestedGroup });
    const contaminationBefore = await checkContamination(workspaceDir, requestedGroup);
    if (!contaminationBefore.passed) {
      throw new Error(`Workspace contamination before run: ${contaminationBefore.violations.join("; ")}`);
    }

    if (!dryRun) {
      installDependencies(workspaceDir);
    }
    const protectedFilesBefore = await snapshotProtectedFiles(workspaceDir, requestedGroup);

    let rawCorpus = null;
    if (requestedGroup === "control-local-raw" || requestedGroup === "control-web-raw") {
      rawCorpus = new RawDocsCorpus(corpusDir, requestedGroup === "control-web-raw" ? "web" : "local");
      await rawCorpus.load();
      console.log(`Loaded ${rawCorpus.files.length} raw documentation file(s).`);
    }

    let agentdocsBuildHash = null;
    if (requestedGroup === "experimental-agentdocs") {
      agentdocsBuildHash = await buildAgentDocs(buildDir);
      console.log(`Experimental Group: Starting MCP server with tools: ${mcpToolsArg || "all"}...`);
      mcpClient = new McpClient(buildDir, mcpToolsArg);
      await mcpClient.start();
      mcpTools = await mcpClient.listTools();
      console.log(`Loaded ${mcpTools.length} MCP tools.`);
    }

    const baseTools = workspaceTools();
    const corpusTools = requestedGroup === "control-local-raw"
      ? rawLocalTools()
      : requestedGroup === "control-web-raw"
        ? rawWebTools()
        : [];
    const allTools = [...baseTools, ...corpusTools, ...mcpTools];
    const toolSchemaMetrics = toolSchemaMetricsFor({ baseTools, corpusTools, mcpTools });
    const toolSchemaTokenEstimate = toolSchemaMetrics.totalToolSchemaTokenEstimate;
    const taskDesc = await readFile(path.join(workspaceDir, "task.md"), "utf8");
    const systemPrompt = systemPromptFor(requestedGroup);
    const messages = [
      {
        role: "user",
        content: `Here is your task:\n\n${taskDesc}\n\nPlease implement the solution now.`,
      },
    ];

    if (dryRun) {
      const result = await finishRun({
        taskName,
        group: requestedGroup,
        provider,
        modelName,
        seed,
        passed: false,
        turns: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        startTime: performance.now(),
        mcpTools,
        toolCallCounts: {},
        turnsList: [],
        testOutput: "Dry run completed without calling an LLM.",
        workspaceDir,
        sandboxRoot,
        corpusDir,
        buildDir,
        toolSchemaTokenEstimate,
        toolSchemaMetrics,
        docsTelemetry,
        protectedFilesBefore,
        agentdocsBuildHash,
        contaminationBefore,
        dryRun,
        keepSandbox,
      });
      cleanupHandled = true;
      console.log(result);
      return;
    }

    const runState = await runAgentLoop({
      provider,
      modelName,
      messages,
      allTools,
      systemPrompt,
      maxCost,
      workspaceDir,
      corpus: rawCorpus,
      mcpClient,
      docsTelemetry,
      group: requestedGroup,
    });

    const { passed, testOutput } = runFinalVerification(workspaceDir);
    const result = await finishRun({
      taskName,
      group: requestedGroup,
      provider,
      modelName,
      seed,
      passed,
      turns: runState.turns,
      totalInputTokens: runState.totalInputTokens,
      totalOutputTokens: runState.totalOutputTokens,
      finishReason: runState.finishReason,
      finalResponse: runState.finalResponse,
      startTime: runState.startTime,
      mcpTools,
      toolCallCounts: runState.toolCallCounts,
      turnsList: runState.turnsList,
      testOutput,
      workspaceDir,
      sandboxRoot,
      corpusDir,
      buildDir,
      toolSchemaTokenEstimate,
      toolSchemaMetrics,
      docsTelemetry,
      protectedFilesBefore,
      agentdocsBuildHash,
      contaminationBefore,
      dryRun,
      keepSandbox,
    });
    cleanupHandled = true;

    console.log("\nEvaluation complete!");
    console.log(result);
  } finally {
    if (mcpClient) {
      await mcpClient.stop();
    }
    if (!keepSandbox && !cleanupHandled) {
      await rm(sandboxRoot, { recursive: true, force: true });
    }
  }
}

async function runAgentLoop({
  provider,
  modelName,
  messages,
  allTools,
  systemPrompt,
  maxCost,
  workspaceDir,
  corpus,
  mcpClient,
  docsTelemetry,
  group,
}) {
  let turns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const startTime = performance.now();
  let done = false;
  let finishReason = "turn_limit";
  let finalResponse = "";
  const turnsList = [];
  const toolCallCounts = {};

  while (!done && turns < 10) {
    turns++;
    console.log(`\n--- Turn ${turns} ---`);
    const turnStartTime = performance.now();
    let turnInputTokens = 0;
    let turnOutputTokens = 0;
    let response;

    try {
      if (provider === "anthropic") {
        const rawRes = await callAnthropic(messages, allTools, systemPrompt);
        turnInputTokens = rawRes.usage.input_tokens;
        turnOutputTokens = rawRes.usage.output_tokens;
        response = {
          content: rawRes.content.filter((c) => c.type === "text").map((c) => c.text).join("\n"),
          tool_calls: rawRes.content.filter((c) => c.type === "tool_use").map((c) => ({
            id: c.id,
            name: c.name,
            arguments: c.input,
          })),
        };
      } else {
        const rawRes = await callOpenAI(messages, allTools, systemPrompt, modelName);
        turnInputTokens = rawRes.usage.prompt_tokens;
        turnOutputTokens = rawRes.usage.completion_tokens;
        const choice = rawRes.choices[0];
        response = {
          content: choice.message.content || "",
          tool_calls: choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })) || [],
        };
      }
    } catch (err) {
      console.error("LLM call failed:", err);
      throw err;
    }

    totalInputTokens += turnInputTokens;
    totalOutputTokens += turnOutputTokens;
    finalResponse = response.content;
    const estimatedCost = estimateCost(totalInputTokens, totalOutputTokens);
    console.log(`Token Usage: ${totalInputTokens} input, ${totalOutputTokens} output. Estimated Cost: $${estimatedCost.toFixed(4)}`);

    for (const tc of response.tool_calls) {
      toolCallCounts[tc.name] = (toolCallCounts[tc.name] || 0) + 1;
    }

    const turnDuration = Math.round(performance.now() - turnStartTime);
    turnsList.push({
      turn: turns,
      inputTokens: turnInputTokens,
      outputTokens: turnOutputTokens,
      durationMs: turnDuration,
      toolCalls: response.tool_calls.map((tc) => ({ name: tc.name, args: tc.arguments })),
    });

    if (estimatedCost > maxCost) {
      console.log(`Cost limit of $${maxCost} exceeded. Aborting to save budget.`);
      finishReason = "cost_limit";
      break;
    }

    if (response.content) {
      console.log(`Agent: ${response.content}`);
    }

    pushAssistantMessage(provider, messages, response);

    if (response.tool_calls.length === 0) {
      console.log("Agent finished (no more tool calls).");
      done = true;
      finishReason = "no_tool_calls";
      break;
    }

    for (const tc of response.tool_calls) {
      console.log(`Tool Call: ${tc.name}(${JSON.stringify(tc.arguments)})`);
      const resultText = await executeToolCall({
        toolCall: tc,
        workspaceDir,
        corpus,
        mcpClient,
        docsTelemetry,
        group,
      });
      console.log(`Tool Result: ${resultText.slice(0, 100)}...`);
      pushToolResult(provider, messages, tc, resultText);
    }
  }

  return { turns, totalInputTokens, totalOutputTokens, startTime, turnsList, toolCallCounts, finishReason, finalResponse };
}

async function executeToolCall({ toolCall, workspaceDir, corpus, mcpClient, docsTelemetry, group }) {
  try {
    let resultText = "";
    const args = toolCall.arguments;
    if (toolCall.name === "write_file") {
      const filePath = resolveInside(workspaceDir, requiredString(args.path, "path"));
      assertWritableWorkspacePath(workspaceDir, filePath, group);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, requiredString(args.content, "content"), "utf8");
      resultText = `Successfully wrote to ${args.path}`;
    } else if (toolCall.name === "read_file") {
      const filePath = resolveInside(workspaceDir, requiredString(args.path, "path"));
      const content = await readFile(filePath, "utf8");
      resultText = truncate(content, 30000, `file ${args.path}`);
    } else if (toolCall.name === "run_command") {
      resultText = runWorkspaceCommand(workspaceDir, requiredString(args.command, "command"), group);
    } else if (toolCall.name === "search_raw_docs") {
      resultText = corpus.search(requiredString(args.query, "query"), optionalLimit(args.limit, 5));
      recordDocsPayload(docsTelemetry, toolCall.name, resultText);
    } else if (toolCall.name === "read_raw_doc") {
      resultText = corpus.readRawDoc(requiredString(args.path, "path"), optionalLimit(args.maxChars, 12000));
      recordDocsPayload(docsTelemetry, toolCall.name, resultText);
    } else if (toolCall.name === "web_search") {
      resultText = corpus.search(requiredString(args.query, "query"), optionalLimit(args.limit, 5));
      recordDocsPayload(docsTelemetry, toolCall.name, resultText);
    } else if (toolCall.name === "fetch_webpage") {
      resultText = corpus.fetchWebpage(requiredString(args.url, "url"));
      recordDocsPayload(docsTelemetry, toolCall.name, resultText);
    } else {
      const mcpResult = await mcpClient.callTool(toolCall.name, args);
      resultText = mcpResult.content.map((c) => c.text).join("\n");
      recordDocsPayload(docsTelemetry, toolCall.name, resultText);
    }
    return resultText;
  } catch (err) {
    return `Tool call execution error: ${err.message}`;
  }
}

async function prepareSandbox({ taskDir, workspaceDir, corpusDir, buildDir, group }) {
  await mkdir(path.dirname(workspaceDir), { recursive: true });
  await cp(taskDir, workspaceDir, { recursive: true });
  await cp(taskDir, buildDir, { recursive: true });
  const docsPath = path.join(taskDir, DOCS_DIR_NAME);
  if (fs.existsSync(docsPath)) {
    await cp(docsPath, corpusDir, { recursive: true });
  } else {
    await mkdir(corpusDir, { recursive: true });
  }
  const keepDocs = group === "experimental-agentdocs-local-coldstart";
  await stripDocsAndGeneratedArtifacts(workspaceDir, keepDocs);
  if (group !== "experimental-agentdocs") {
    await stripDocsAndGeneratedArtifacts(buildDir, group === "experimental-agentdocs-local-coldstart");
  }
}

async function stripDocsAndGeneratedArtifacts(root, keepDocs = false) {
  if (!keepDocs) {
    await rm(path.join(root, DOCS_DIR_NAME), { recursive: true, force: true });
  }
  await rm(path.join(root, ".agentdocs"), { recursive: true, force: true });
  await rm(path.join(root, "llms.txt"), { force: true });
  await rm(path.join(root, "AGENTS.md"), { force: true });
}

function installDependencies(workspaceDir) {
  try {
    console.log("Installing workspace dependencies...");
    execSync("npm install", { cwd: workspaceDir, stdio: "inherit" });
  } catch (err) {
    console.warn("Failed to install workspace dependencies:", err.message);
  }
}

async function buildAgentDocs(buildDir) {
  const cliPath = path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js");
  console.log("Building AgentDocs artifacts in hidden build workspace...");
  execSync(`"${process.execPath}" "${cliPath}" --cwd "${buildDir}" build`, { stdio: "inherit" });
  return hashPath(path.join(buildDir, ".agentdocs"));
}

function runFinalVerification(workspaceDir) {
  let passed = false;
  let testOutput = "";
  try {
    const out = execSync("node test.mjs", { cwd: workspaceDir, encoding: "utf8", stdio: "pipe" });
    passed = true;
    testOutput = out;
  } catch (err) {
    console.log("CI check failed.");
    testOutput = `Test failed:\nStdout: ${err.stdout}\nStderr: ${err.stderr}`;
  }
  return { passed, testOutput };
}

async function finishRun({
  taskName,
  group,
  provider,
  modelName,
  seed,
  passed,
  turns,
  totalInputTokens,
  totalOutputTokens,
  finishReason,
  finalResponse,
  startTime,
  mcpTools,
  toolCallCounts,
  turnsList,
  testOutput,
  workspaceDir,
  sandboxRoot,
  corpusDir,
  buildDir,
  toolSchemaTokenEstimate,
  toolSchemaMetrics,
  docsTelemetry,
  protectedFilesBefore,
  agentdocsBuildHash,
  contaminationBefore,
  dryRun = false,
  keepSandbox,
}) {
  const duration = Math.round(performance.now() - startTime);
  const contaminationAfter = await checkContamination(workspaceDir, group);
  const protectedFilesAfter = await checkProtectedFileMutations(workspaceDir, protectedFilesBefore, group);
  const finalCodeHash = await hashWorkspaceCode(workspaceDir);
  const corpusHash = await hashPath(corpusDir);
  const result = {
    schemaVersion: 2,
    task: taskName,
    group,
    control: group !== "experimental-agentdocs",
    web: group === "control-web-raw",
    provider,
    model: modelName,
    seed,
    dryRun,
    passed,
    turns,
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
    },
    toolSchemaTokenEstimate,
    toolSchemaMetrics,
    hotTokenEstimates: hotTokenEstimatesFor({
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      turns,
      docsToolSchemaTokenEstimate: toolSchemaMetrics.docsToolSchemaTokenEstimate,
    }),
    retrievalPayloadTokenEstimate: docsTelemetry.retrievalPayloadTokenEstimate,
    docsBytesReturned: docsTelemetry.docsBytesReturned,
    retrievalPayloadByTool: docsTelemetry.byTool,
    durationMs: duration,
    mcpToolsLoaded: mcpTools.map((t) => t.name),
    toolCalls: toolCallCounts,
    turnsBreakdown: turnsList,
    completion: {
      finishReason,
      finalResponse,
      wroteFiles: (toolCallCounts.write_file ?? 0) > 0,
      ranTestCommand: turnsList.some((turn) => turn.toolCalls.some((call) =>
        call.name === "run_command" && isTestCommand(call.args.command))),
    },
    finalCodeHash,
    corpusHash,
    agentdocsBuildHash,
    contaminationChecks: {
      before: contaminationBefore,
      after: contaminationAfter,
      protectedFiles: protectedFilesAfter,
      passed: contaminationBefore.passed && contaminationAfter.passed && protectedFilesAfter.passed,
    },
    testOutput,
  };

  const resultsDir = path.join(repositoryRoot, ".dogfood");
  await mkdir(resultsDir, { recursive: true });
  const outPath = path.join(resultsDir, `eval-result-${taskName}-${group}-seed-${seed}.json`);
  await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Saved result to ${outPath}`);

  if (!keepSandbox) {
    await rm(sandboxRoot, { recursive: true, force: true });
  } else {
    console.log(`Kept sandbox at ${sandboxRoot}`);
  }
  return result;
}

async function checkContamination(workspaceDir, group) {
  const violations = [];
  const entries = await collectEntries(workspaceDir);
  for (const entry of entries) {
    const base = path.basename(entry);
    const relative = toPosix(path.relative(workspaceDir, entry));
    if (group === "experimental-agentdocs-local-coldstart") {
      // In local coldstart, the docs/ and generated .agentdocs/ are expected
      continue;
    }
    if (base === DOCS_DIR_NAME || GENERATED_ARTIFACT_NAMES.has(base) || relative.startsWith(".agentdocs/")) {
      violations.push(relative);
    }
    if (group !== "experimental-agentdocs" && /(?:^|\/)task-packs(?:\/|$)/.test(relative)) {
      violations.push(relative);
    }
  }
  return {
    passed: violations.length === 0,
    violations: [...new Set(violations)].sort(),
  };
}

async function collectEntries(root) {
  const results = [];
  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      results.push(full);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
        await visit(full);
      }
    }
  }
  await visit(root);
  return results;
}

function workspaceTools() {
  return [
    {
      name: "write_file",
      description: "Write content to a file in the implementation workspace.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path in the implementation workspace" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    {
      name: "read_file",
      description: "Read a file's content from the implementation workspace. Raw docs and AgentDocs artifacts are not in this workspace.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path in the implementation workspace" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "run_command",
      description: "Run a test or build command in the implementation workspace. Commands must stay inside the workspace.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to execute" },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  ];
}

function rawLocalTools() {
  return [
    {
      name: "search_raw_docs",
      description: "Search raw local documentation files. Results are uncompiled and not generated by AgentDocs.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "integer", minimum: 1, maximum: 20, description: "Maximum results" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "read_raw_doc",
      description: "Read a raw local documentation file by path returned from search_raw_docs.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative raw docs path" },
          maxChars: { type: "integer", minimum: 1000, maximum: 30000, description: "Maximum characters to return" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  ];
}

function rawWebTools() {
  return [
    {
      name: "web_search",
      description: "Search the deterministic raw documentation web corpus. Results are not generated by AgentDocs.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "integer", minimum: 1, maximum: 20, description: "Maximum results" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "fetch_webpage",
      description: "Fetch a raw webpage by URL returned from web_search.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL of the webpage to fetch" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  ];
}

function toolSchemaMetricsFor({ baseTools, corpusTools, mcpTools }) {
  const toolSchemaByTool = Object.fromEntries(
    [...baseTools, ...corpusTools, ...mcpTools]
      .map((tool) => [tool.name, estimateTokens(JSON.stringify(tool))])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const baseToolSchemaTokenEstimate = sumToolSchemaTokens(baseTools, toolSchemaByTool);
  const rawDocsToolSchemaTokenEstimate = sumToolSchemaTokens(corpusTools, toolSchemaByTool);
  const docsToolSchemaTokenEstimate = sumToolSchemaTokens(mcpTools, toolSchemaByTool);
  return {
    baseToolSchemaTokenEstimate,
    rawDocsToolSchemaTokenEstimate,
    docsToolSchemaTokenEstimate,
    totalToolSchemaTokenEstimate: baseToolSchemaTokenEstimate + rawDocsToolSchemaTokenEstimate + docsToolSchemaTokenEstimate,
    toolSchemaByTool,
  };
}

function sumToolSchemaTokens(tools, toolSchemaByTool) {
  return tools.reduce((sum, tool) => sum + (toolSchemaByTool[tool.name] ?? 0), 0);
}

function hotTokenEstimatesFor({ inputTokens, outputTokens, turns, docsToolSchemaTokenEstimate }) {
  const docsSchemaRepeatedTaxEstimate = docsToolSchemaTokenEstimate * turns;
  return {
    coldTotalTokens: inputTokens + outputTokens,
    docsSchemaRepeatedTaxEstimate,
    hotAdjustedInputTokensEstimate: Math.max(0, inputTokens - docsSchemaRepeatedTaxEstimate),
    hotAdjustedTotalTokensEstimate: Math.max(0, inputTokens + outputTokens - docsSchemaRepeatedTaxEstimate),
    note: "Analytical estimate: subtracts repeated AgentDocs MCP tool-schema tokens from cold API token totals to approximate a hot session where docs tools are already loaded.",
  };
}

function systemPromptFor(group) {
  const cliPath = path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js");
  const docsInstruction = group === "experimental-agentdocs"
    ? "You have access to AgentDocs MCP documentation tools backed by prebuilt local artifacts. Use those documentation tools for implementation context before coding."
    : group === "experimental-agentdocs-local-coldstart"
      ? `CRITICAL REQUIREMENT: The AgentDocs context layer is NOT compiled yet. You MUST compile it in Turn 1 before doing anything else.
To do this, you MUST immediately call run_command in Turn 1 with the following commands:
1. "node ${toPosix(cliPath)} ingest ./docs" to ingest the raw documentation.
2. "node ${toPosix(cliPath)} build" to build the context layer.

Do NOT try to read the .agentdocs/ folder or implement any code until you have successfully run these two compilation commands. Once compiled, use read_file to inspect the generated ".agentdocs/llms.txt" and ".agentdocs/AGENTS.md" to guide your implementation. Note that task pack links in llms.txt are relative to the ".agentdocs" directory (e.g. read them as ".agentdocs/task-packs/schema-validation.md").`
      : group === "control-web-raw"
        ? "You have access to web_search and fetch_webpage over a raw documentation corpus. Use those web tools to find documentation before coding. The documentation home page URL is: https://docs.example.com/"
        : "You have access to search_raw_docs and read_raw_doc over raw local documentation files. Use those tools to find documentation before coding.";

  return `You are a professional software engineer agent.
Your objective is to complete the task defined in task.md.
You have access to file-system tools and command-running tools.
Write the requested implementation files with the file-system tools; do not finish by only describing code.
Always run a project test command to verify that your implementation is correct before finishing.
${docsInstruction}`;
}

function isTestCommand(command) {
  return typeof command === "string" && /(?:^|\s)(?:npm\s+(?:run\s+)?test|pnpm\s+(?:run\s+)?test|yarn\s+test|bun\s+test|node\s+test\.mjs|vitest|jest|pytest|cargo\s+test|go\s+test)(?:\s|$)/i.test(command);
}

async function collectTextFiles(root) {
  const files = [];
  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", ".agentdocs", "dist", ".vitepress"].includes(entry.name)) {
          continue;
        }
        await visit(fullPath);
      } else if (entry.isFile() && isTextLike(fullPath)) {
        try {
          const content = await readFile(fullPath, "utf8");
          files.push({
            absolutePath: fullPath,
            relativePath: path.relative(root, fullPath),
            extension: path.extname(fullPath).toLowerCase(),
            content,
          });
        } catch {
          // Skip unreadable files.
        }
      }
    }
  }
  await visit(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isTextLike(filePath) {
  return [
    ".md",
    ".mdx",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".html",
    ".htm",
    ".txt",
    ".yaml",
    ".yml",
    ".json",
  ].includes(path.extname(filePath).toLowerCase());
}

function scoreText(value, terms, query) {
  if (terms.length === 0) return 0;
  let score = value.includes(query.trim()) ? 50 : 0;
  for (const term of terms) {
    const matches = value.split(term).length - 1;
    score += matches;
    if (value.includes(`# ${term}`)) score += 10;
  }
  return score;
}

function snippetFor(content, terms) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (terms.length === 0) return truncate(compact, 240, "snippet");
  const lower = compact.toLowerCase();
  const index = terms
    .map((term) => lower.indexOf(term))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, index - 90);
  return truncate(compact.slice(start, start + 260), 260, "snippet");
}

function titleFor(file) {
  const heading = /^#\s+(.+)$/m.exec(file.content)?.[1];
  if (heading) return heading.trim();
  return path.basename(file.relativePath, path.extname(file.relativePath)).replace(/[_-]+/g, " ");
}

function cleanRawHtmlToText(html) {
  let clean = html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
  clean = clean
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  clean = clean.replace(/<[^>]+>/g, " ");
  clean = clean.replace(/[ \t]+/g, " ");
  return clean.replace(/\n\s*\n+/g, "\n\n").trim();
}

function addWebScraperBoilerplate(markdown, pageTitle) {
  const header = `[Web Search Scraper] Document: ${pageTitle || "Untitled Page"}
Navigation Menu:
- Home | Guides | Reference | API | GitHub | Community
- Sidebar: Getting Started, Configuration, Installation, API Reference, Advanced Topics, Troubleshooting, Support
--------------------------------------------------------------------------------`;
  const footer = `--------------------------------------------------------------------------------
Footer: Copyright 2026 Documentation Hub.
Related Links:
- Support Channel | GitHub Issues | Package Registry`;
  return `${header}\n\n${markdown}\n\n${footer}`;
}

function runWorkspaceCommand(workspaceDir, command, group) {
  assertWorkspaceCommand(command, group);
  try {
    const out = execSync(command, { cwd: workspaceDir, encoding: "utf8", stdio: "pipe" });
    return out || "Command executed with no output.";
  } catch (execErr) {
    return `Command failed:\nExit Code: ${execErr.status}\nStdout: ${execErr.stdout}\nStderr: ${execErr.stderr}`;
  }
}

function assertWorkspaceCommand(command, group) {
  const lower = command.toLowerCase();
  const forbidden = group === "experimental-agentdocs-local-coldstart"
    ? ["..", "raw-docs-corpus", "agentdocs-build"]
    : ["..", ".agentdocs", "raw-docs-corpus", "agentdocs-build", "agent-map.json", "chunks.jsonl", "task-packs"];
  const hit = forbidden.find((item) => lower.includes(item));
  if (hit) {
    throw new Error(`Command rejected because it references forbidden path/context marker: ${hit}`);
  }
}

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes implementation workspace: ${relativePath}`);
  }
  return resolved;
}

function assertWritableWorkspacePath(workspaceDir, filePath, group) {
  const relative = toPosix(path.relative(workspaceDir, filePath));
  if (isProtectedWorkspacePath(relative, group)) {
    throw new Error(`write_file rejected protected benchmark path: ${relative}`);
  }
}

function isProtectedWorkspacePath(relativePath, group) {
  const normalized = toPosix(relativePath).replace(/^\.\//, "");
  const base = path.posix.basename(normalized);
  if (PROTECTED_WORKSPACE_FILE_NAMES.has(base)) {
    return true;
  }
  if (group === "experimental-agentdocs-local-coldstart") {
    return false;
  }
  return GENERATED_ARTIFACT_NAMES.has(base)
    || normalized === DOCS_DIR_NAME
    || normalized.startsWith(`${DOCS_DIR_NAME}/`)
    || normalized === ".agentdocs"
    || normalized.startsWith(".agentdocs/");
}

function normalizeRelativePath(value) {
  const normalized = toPosix(path.normalize(value));
  if (normalized.startsWith("../") || normalized === ".." || path.isAbsolute(value)) {
    throw new Error(`Path escapes raw docs corpus: ${value}`);
  }
  return normalized.replace(/^\.\//, "");
}

function urlFor(relativePath) {
  return `https://docs.example.com/${encodeURI(toPosix(relativePath))}`;
}

function parseDocsExampleUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== "https://docs.example.com") return undefined;
    return decodeURI(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return undefined;
  }
}

function pushAssistantMessage(provider, messages, response) {
  if (provider === "anthropic") {
    messages.push({
      role: "assistant",
      content: [
        ...(response.content ? [{ type: "text", text: response.content }] : []),
        ...response.tool_calls.map((tc) => ({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        })),
      ],
    });
  } else {
    messages.push({
      role: "assistant",
      content: response.content,
      tool_calls: response.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    });
  }
}

function pushToolResult(provider, messages, toolCall, resultText) {
  if (provider === "anthropic") {
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: resultText,
        },
      ],
    });
  } else {
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: resultText,
    });
  }
}

function resolveGroup(args) {
  const explicit = getArg(args, "--group");
  if (explicit) {
    if (!["experimental-agentdocs", "experimental-agentdocs-local-coldstart", "control-local-raw", "control-web-raw"].includes(explicit)) {
      throw new Error("--group must be experimental-agentdocs, experimental-agentdocs-local-coldstart, control-local-raw, or control-web-raw");
    }
    return explicit;
  }
  if (args.includes("--control") && args.includes("--web")) return "control-web-raw";
  if (args.includes("--control")) return "control-local-raw";
  return "experimental-agentdocs";
}

function getArg(args, key) {
  const idx = args.indexOf(key);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return null;
}

function requiredString(value, name) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }
  return value;
}

function optionalLimit(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, 30000)) : fallback;
}

function normalizeQuery(query) {
  return query.toLowerCase().replace(/site:\S+/g, "").replace(/[^a-z0-9\s./:@-]/g, " ").trim();
}

function tokenize(value) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9_./:@-]*/g) ?? [])]
    .filter((term) => term.length > 1);
}

function truncate(value, maxChars, label) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[... ${label} truncated by eval harness ...]`;
}

function recordDocsPayload(telemetry, toolName, text) {
  const bytes = Buffer.byteLength(text, "utf8");
  const tokens = estimateTokens(text);
  telemetry.docsBytesReturned += bytes;
  telemetry.retrievalPayloadTokenEstimate += tokens;
  telemetry.byTool[toolName] ??= { calls: 0, docsBytesReturned: 0, retrievalPayloadTokenEstimate: 0 };
  telemetry.byTool[toolName].calls += 1;
  telemetry.byTool[toolName].docsBytesReturned += bytes;
  telemetry.byTool[toolName].retrievalPayloadTokenEstimate += tokens;
}

function estimateTokens(value) {
  return Math.ceil(value.length / 4);
}

function estimateCost(inputTokens, outputTokens) {
  return (inputTokens / 1000000) * 3.0 + (outputTokens / 1500000) * 15.0;
}

function retryAfterSeconds(response, text) {
  const header = response.headers.get("retry-after");
  if (header !== null) {
    const parsed = Number(header);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed);
    }
  }
  const match = /try again in ([0-9.]+)s/i.exec(text);
  if (match !== null) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed) + 1;
    }
  }
  return undefined;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function snapshotProtectedFiles(workspaceDir, group) {
  const entries = await collectEntries(workspaceDir);
  const snapshot = {};
  for (const entry of entries) {
    let itemStat;
    try {
      itemStat = await stat(entry);
    } catch {
      continue;
    }
    if (!itemStat.isFile()) continue;
    const relative = toPosix(path.relative(workspaceDir, entry));
    if (isProtectedWorkspacePath(relative, group)) {
      snapshot[relative] = await hashFile(entry);
    }
  }
  return snapshot;
}

async function checkProtectedFileMutations(workspaceDir, before, group) {
  const after = await snapshotProtectedFiles(workspaceDir, group);
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const violations = paths.filter((relative) => before[relative] !== after[relative]);
  return {
    passed: violations.length === 0,
    violations,
  };
}

async function hashWorkspaceCode(workspaceDir) {
  const files = (await collectTextFiles(workspaceDir))
    .filter((file) => !file.relativePath.startsWith("node_modules"));
  const hash = createHash("sha256");
  for (const file of files) {
    if (["task.md", "package-lock.json"].includes(path.basename(file.relativePath))) continue;
    hash.update(toPosix(file.relativePath));
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function hashFile(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function hashPath(root) {
  const hash = createHash("sha256");
  async function visit(itemPath) {
    let itemStat;
    try {
      itemStat = await stat(itemPath);
    } catch {
      return;
    }
    if (itemStat.isDirectory()) {
      const entries = (await readdir(itemPath)).sort();
      for (const entry of entries) {
        if (entry === "node_modules" || entry === ".git") continue;
        await visit(path.join(itemPath, entry));
      }
      return;
    }
    if (!itemStat.isFile()) return;
    const relative = toPosix(path.relative(root, itemPath));
    hash.update(relative);
    hash.update("\0");
    hash.update(await readFile(itemPath));
    hash.update("\0");
  }
  await visit(root);
  return hash.digest("hex");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

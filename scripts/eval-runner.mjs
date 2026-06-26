import { spawn, execSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm, cp, mkdtemp } from "node:fs/promises";
import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

function recursiveGrep(dir, pattern, baseDir) {
  let results = [];
  let files;
  try {
    files = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return results;
  }
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      if (file.name === "node_modules" || file.name === ".agentdocs" || file.name === "dist" || file.name === ".vitepress" || file.name === ".git") continue;
      results = results.concat(recursiveGrep(fullPath, pattern, baseDir));
    } else if (file.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(pattern.toLowerCase())) {
            const relPath = path.relative(baseDir, fullPath);
            results.push(`${relPath}:${index + 1}: ${line.trim()}`);
          }
        });
      } catch (err) {
        // Skip files that cannot be read
      }
    }
  }
  return results;
}

function performMockSearch(query, agentMap) {
  if (!agentMap) return "No search index available.";
  
  // Clean query and split into keywords/terms, ignoring empty terms
  // Filter out site: constraints if any
  const cleanQuery = query.toLowerCase()
    .replace(/site:\S+/g, "") // remove site: constraints
    .replace(/[^a-z0-9\s]/g, " "); // keep alphanumeric and space
  
  const terms = cleanQuery.split(/\s+/).filter(t => t.length > 1);
  if (terms.length === 0) {
    return `No search results found for query: "${query}"`;
  }

  const matchedPages = new Map();

  for (const page of agentMap.pages) {
    let score = 0;
    const titleLower = page.title.toLowerCase();
    const markdownLower = page.markdown.toLowerCase();
    
    // Check term matches
    let matchedTermsCount = 0;
    for (const term of terms) {
      let termMatched = false;
      if (titleLower.includes(term)) {
        score += 15;
        termMatched = true;
      }
      if (markdownLower.includes(term)) {
        score += 3;
        termMatched = true;
      }
      if (termMatched) {
        matchedTermsCount++;
      }
    }
    
    // Bonus for matching more terms
    if (matchedTermsCount > 0) {
      score += matchedTermsCount * 10;
      // Additional big bonus if all terms matched
      if (matchedTermsCount === terms.length) {
        score += 50;
      }
      
      matchedPages.set(page.id, {
        title: page.title,
        url: page.canonicalUrl || page.sourceUrl || `https://docs.example.com/${page.id}`,
        score
      });
    }
  }

  for (const chunk of agentMap.chunks) {
    const chunkTextLower = chunk.text.toLowerCase();
    let matchedTermsCount = 0;
    let chunkScore = 0;
    
    for (const term of terms) {
      if (chunkTextLower.includes(term)) {
        chunkScore += 2;
        matchedTermsCount++;
      }
    }
    
    if (matchedTermsCount > 0) {
      const pageId = chunk.pageId;
      const pageInfo = matchedPages.get(pageId) || {
        title: agentMap.pages.find(p => p.id === pageId)?.title || "Untitled",
        url: agentMap.pages.find(p => p.id === pageId)?.canonicalUrl || `https://docs.example.com/${pageId}`,
        score: 0
      };
      
      pageInfo.score += chunkScore;
      if (matchedTermsCount === terms.length) {
        pageInfo.score += 20; // bonus for all terms matching in the chunk
      }
      matchedPages.set(pageId, pageInfo);
    }
  }

  const results = Array.from(matchedPages.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (results.length === 0) {
    return `No search results found for query: "${query}"`;
  }
  return results.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}`).join("\n\n");
}

async function resolveRawHtml(targetPagesDir, page) {
  let files;
  try {
    files = await fs.promises.readdir(targetPagesDir);
  } catch (err) {
    return null;
  }

  const jsonFiles = files.filter(f => f.endsWith(".json"));

  for (const jsonFile of jsonFiles) {
    try {
      const metadataPath = path.join(targetPagesDir, jsonFile);
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, "utf8"));
      
      if (
        metadata.title && page.title && 
        metadata.title.toLowerCase().trim() === page.title.toLowerCase().trim()
      ) {
        const htmlFile = jsonFile.replace(".json", ".raw.html");
        const htmlPath = path.join(targetPagesDir, htmlFile);
        if (fs.existsSync(htmlPath)) {
          return htmlPath;
        }
      }
      
      if (
        metadata.sourceUrl && page.sourceUrl &&
        metadata.sourceUrl.replace(/\/$/, "") === page.sourceUrl.replace(/\/$/, "")
      ) {
        const htmlFile = jsonFile.replace(".json", ".raw.html");
        const htmlPath = path.join(targetPagesDir, htmlFile);
        if (fs.existsSync(htmlPath)) {
          return htmlPath;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Fuzzy fallback match by title
  for (const jsonFile of jsonFiles) {
    try {
      const metadataPath = path.join(targetPagesDir, jsonFile);
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, "utf8"));
      
      if (
        metadata.title && page.title && 
        (metadata.title.toLowerCase().includes(page.title.toLowerCase()) || 
         page.title.toLowerCase().includes(metadata.title.toLowerCase()))
      ) {
        const htmlFile = jsonFile.replace(".json", ".raw.html");
        const htmlPath = path.join(targetPagesDir, htmlFile);
        if (fs.existsSync(htmlPath)) {
          return htmlPath;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

function cleanRawHtmlToText(html) {
  // Strip head, scripts, styles, svgs
  let clean = html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
  
  // Convert basic HTML elements to markdown-like linebreaks
  clean = clean
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");

  // Strip all other HTML tags
  clean = clean.replace(/<[^>]+>/g, " ");
  // Collapse whitespace
  clean = clean.replace(/[ \t]+/g, " ");
  clean = clean.replace(/\n\s*\n+/g, "\n\n").trim();
  
  // Limit length to ~30k chars (around 8k tokens) to prevent rate limit/context crashes
  if (clean.length > 30000) {
    clean = clean.slice(0, 30000) + "\n\n[... content truncated by web fetch scraper ...]";
  }
  return clean;
}

// Add simulated web scraper navigation noise to markdown fallbacks
function addWebScraperBoilerplate(markdown, pageTitle) {
  const header = `[Web Search Scraper] Document: ${pageTitle || "Untitled Page"}
Navigation Menu:
- Home | Guides | Reference | API | Github | Community
- Sidebar: Getting Started, Configuration, Installation, API Reference, Advanced Topics, Troubleshooting, Support
--------------------------------------------------------------------------------`;
  const footer = `--------------------------------------------------------------------------------
Footer: © 2026 Documentation Hub. Built with Docusaurus/VitePress.
Related Links:
- Support Channel | Discord | GitHub Issues | NPM Package`;
  return `${header}\n\n${markdown}\n\n${footer}`;
}

async function performMockFetch(url, agentMap, taskName, repositoryRoot) {
  if (!agentMap) return "Webpage fetch error: documentation map not loaded.";
  const page = agentMap.pages.find(p => p.canonicalUrl === url || p.sourceUrl === url || `https://docs.example.com/${p.id}` === url);
  if (!page) {
    return `Error 404: Webpage not found at URL: ${url}`;
  }

  let targetFolder = taskName;
  if (taskName === "fastify-validation") {
    targetFolder = "fastify-crawl";
  } else if (taskName === "nextjs-app-router") {
    targetFolder = "nextjs-crawl";
  }

  const targetPagesDir = path.join(repositoryRoot, ".dogfood", targetFolder, "sources", "pages");
  
  // Try direct page ID file first
  const dogfoodHtmlPath = path.join(targetPagesDir, `${page.id}.raw.html`);
  try {
    if (fs.existsSync(dogfoodHtmlPath)) {
      const htmlContent = await fs.promises.readFile(dogfoodHtmlPath, "utf8");
      return cleanRawHtmlToText(htmlContent);
    }
  } catch (err) {
    // fallback
  }

  // Resolve by scanning metadata JSON files
  const resolvedPath = await resolveRawHtml(targetPagesDir, page);
  if (resolvedPath) {
    try {
      const htmlContent = await fs.promises.readFile(resolvedPath, "utf8");
      return cleanRawHtmlToText(htmlContent);
    } catch (err) {
      // ignore
    }
  }

  return addWebScraperBoilerplate(page.markdown, page.title);
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");

// Simple MCP Client Implementation
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

    // Wait a bit for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send initialize request
    const initResponse = await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "eval-runner", version: "1.0.0" }
    });
    return initResponse;
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
      
      this.child.stdin.write(JSON.stringify(requestPayload) + "\n");
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

// LLM Clients
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
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema || t.input_schema
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
    ...messages.map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : m.content.map(c => c.text || "").join("\n"),
      tool_calls: m.tool_calls,
      name: m.name,
      tool_call_id: m.tool_call_id
    }))
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: openAiMessages,
      tools: tools.map(t => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema || t.input_schema
        }
      })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API Error (${response.status}): ${text}`);
  }

  return response.json();
}

// Runner
async function main() {
  const args = process.argv.slice(2);
  const taskName = getArg(args, "--task") || "dummy-sdk";
  const control = args.includes("--control");
  const provider = getArg(args, "--provider") || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const modelName = getArg(args, "--model") || (provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-20241022");
  const maxCost = parseFloat(getArg(args, "--max-cost") || "1.00");

  const useWebSearch = args.includes("--web");
  const mcpToolsArg = getArg(args, "--mcp-tools");

  console.log(`Starting eval run. Task: ${taskName}, Control Group: ${control}, Web Search harness: ${useWebSearch}, Provider: ${provider}, Model: ${modelName}, Max Cost: $${maxCost}`);

  const taskDir = path.join(repositoryRoot, "fixtures", "eval-tasks", taskName);
  const sandboxDir = await mkdtemp(path.join(os.tmpdir(), `agentdocs-eval-sandbox-${taskName}-`));
  console.log(`Sandbox directory: ${sandboxDir}`);

  // Copy task files to sandbox
  await cp(taskDir, sandboxDir, { recursive: true });

  // Install dependencies in sandbox
  try {
    console.log("Installing sandbox dependencies...");
    execSync("npm install", { cwd: sandboxDir, stdio: "inherit" });
  } catch (err) {
    console.warn("Failed to install sandbox dependencies:", err.message);
  }

  let mcpClient = null;
  let mcpTools = [];

  // Generate agent-map.json by building first (so we can use it to map URLs and search mock pages)
  console.log("Pre-building AgentDocs to generate documentation index...");
  const cliPath = path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js");
  try {
    execSync(`"${process.execPath}" "${cliPath}" --cwd "${sandboxDir}" build`, { stdio: "inherit" });
  } catch (err) {
    console.warn("Pre-build failed, mock index might be missing:", err.message);
  }

  let agentMap = null;
  try {
    agentMap = JSON.parse(await readFile(path.join(sandboxDir, ".agentdocs", "agent-map.json"), "utf8"));
  } catch (err) {
    console.warn("Could not load agent-map.json for web simulation:", err.message);
  }

  if (!control) {
    console.log(`Experimental Group: Starting MCP server with tools: ${mcpToolsArg || "all"}...`);
    mcpClient = new McpClient(sandboxDir, mcpToolsArg);
    await mcpClient.start();
    mcpTools = await mcpClient.listTools();
    console.log(`Loaded ${mcpTools.length} MCP tools.`);
  } else {
    console.log(`Control Group: Skipping AgentDocs MCP context. Web Search harness: ${useWebSearch}`);
    if (useWebSearch) {
      // Remove local documentation folder and generated artifacts from workspace so agent MUST use web search
      await rm(path.join(sandboxDir, "docs"), { recursive: true, force: true }).catch(() => {});
      await rm(path.join(sandboxDir, ".agentdocs"), { recursive: true, force: true }).catch(() => {});
    }
  }

  // Base sandbox tools
  const baseTools = [
    {
      name: "write_file",
      description: "Write content to a file in the workspace.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path in sandbox" },
          content: { type: "string", description: "File content" }
        },
        required: ["path", "content"]
      }
    },
    {
      name: "read_file",
      description: "Read a file's content from the workspace.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path in sandbox" }
        },
        required: ["path"]
      }
    },
    {
      name: "run_command",
      description: "Run a shell command in the workspace to test your code. Use this to verify your changes.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to execute" }
        },
        required: ["command"]
      }
    }
  ];

  const searchTools = [];
  if (useWebSearch) {
    searchTools.push(
      {
        name: "web_search",
        description: "Search the web for documentation pages related to a query. Returns a list of URLs and page titles.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" }
          },
          required: ["query"]
        }
      },
      {
        name: "fetch_webpage",
        description: "Fetch and download the raw contents of a webpage by URL.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The full URL of the webpage to fetch" }
          },
          required: ["url"]
        }
      }
    );
  } else if (control) {
    searchTools.push({
      name: "grep",
      description: "Search for a text pattern recursively in the workspace files, returning matching lines and filenames.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "The text pattern or keyword to search for" }
        },
        required: ["pattern"]
      }
    });
  }

  const sandboxTools = [...baseTools, ...searchTools];
  const allTools = [...sandboxTools, ...mcpTools];

  // Load task description
  const taskDesc = await readFile(path.join(sandboxDir, "task.md"), "utf8");

  let docInstruction = "";
  if (!control) {
    if (useWebSearch) {
      docInstruction = `You have access to two sets of documentation tools:
1. Standard web tools: 'web_search' and 'fetch_webpage' (fetching raw page content).
2. AgentDocs MCP tools: 'search_docs' and 'get_page' (fetching clean, normalized doc chunks).
Using the AgentDocs MCP tools is highly recommended for documentation retrieval because they provide optimized, pre-summarized context that consumes significantly fewer tokens compared to standard raw web page fetching. Use the MCP tools whenever possible to keep token cost low.`;
    } else {
      docInstruction = "You also have access to local documentation tools. Use them to read about how to implement the task correctly.";
    }
  } else if (useWebSearch) {
    docInstruction = "You also have access to web search and webpage fetching tools. Use them to find documentation on the web about how to implement the task correctly. The documentation home page URL is: https://docs.example.com/";
  } else {
    docInstruction = "You also have access to a local grep tool to search through the files in the workspace.";
  }

  const systemPrompt = `You are a professional software engineer agent.
Your objective is to complete the task defined in task.md.
You have access to file-system tools and command-running tools.
Always run tests to verify that your implementation is correct before finishing.
${docInstruction}`;

  const messages = [
    {
      role: "user",
      content: `Here is your task:\n\n${taskDesc}\n\nPlease implement the solution now.`
    }
  ];

  let turns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const startTime = performance.now();
  let done = false;

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
        totalInputTokens += turnInputTokens;
        totalOutputTokens += turnOutputTokens;
        
        response = {
          content: rawRes.content.filter(c => c.type === "text").map(c => c.text).join("\n"),
          tool_calls: rawRes.content.filter(c => c.type === "tool_use").map(c => ({
            id: c.id,
            name: c.name,
            arguments: c.input
          }))
        };
      } else {
        const rawRes = await callOpenAI(messages, allTools, systemPrompt, modelName);
        turnInputTokens = rawRes.usage.prompt_tokens;
        turnOutputTokens = rawRes.usage.completion_tokens;
        totalInputTokens += turnInputTokens;
        totalOutputTokens += turnOutputTokens;

        const choice = rawRes.choices[0];
        response = {
          content: choice.message.content || "",
          tool_calls: choice.message.tool_calls?.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          })) || []
        };
      }
    } catch (err) {
      console.error("LLM Call failed:", err);
      break;
    }

    const estimatedCost = (totalInputTokens / 1000000) * 3.0 + (totalOutputTokens / 1500000) * 15.0; // Approximation for Anthropic/OpenAI/Gemini blended average
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
      toolCalls: response.tool_calls.map(tc => ({ name: tc.name, args: tc.arguments }))
    });

    if (estimatedCost > maxCost) {
      console.log(`Cost limit of $${maxCost} exceeded. Aborting to save budget.`);
      break;
    }

    if (response.content) {
      console.log(`Agent: ${response.content}`);
    }

    // Add assistant's response to history
    if (provider === "anthropic") {
      messages.push({
        role: "assistant",
        content: [
          ...(response.content ? [{ type: "text", text: response.content }] : []),
          ...response.tool_calls.map(tc => ({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments
          }))
        ]
      });
    } else {
      messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls.map(tc => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        }))
      });
    }

    if (response.tool_calls.length === 0) {
      console.log("Agent finished (no more tool calls).");
      done = true;
      break;
    }

    // Execute tool calls
    for (const tc of response.tool_calls) {
      console.log(`Tool Call: ${tc.name}(${JSON.stringify(tc.arguments)})`);
      let resultText = "";
      try {
        if (tc.name === "write_file") {
          const filePath = path.join(sandboxDir, tc.arguments.path);
          await mkdir(path.dirname(filePath), { recursive: true });
          await writeFile(filePath, tc.arguments.content, "utf8");
          resultText = `Successfully wrote to ${tc.arguments.path}`;
        } else if (tc.name === "read_file") {
          const filePath = path.join(sandboxDir, tc.arguments.path);
          resultText = await readFile(filePath, "utf8");
        } else if (tc.name === "run_command") {
          try {
            const out = execSync(tc.arguments.command, { cwd: sandboxDir, encoding: "utf8", stdio: "pipe" });
            resultText = out || "Command executed with no output.";
          } catch (execErr) {
            resultText = `Command failed:\nExit Code: ${execErr.status}\nStdout: ${execErr.stdout}\nStderr: ${execErr.stderr}`;
          }
        } else if (tc.name === "web_search") {
          const query = tc.arguments.query;
          resultText = performMockSearch(query, agentMap);
        } else if (tc.name === "fetch_webpage") {
          const url = tc.arguments.url;
          resultText = await performMockFetch(url, agentMap, taskName, repositoryRoot);
        } else if (tc.name === "grep") {
          const pattern = tc.arguments.pattern;
          const matches = recursiveGrep(sandboxDir, pattern, sandboxDir);
          if (matches.length === 0) {
            resultText = "No matches found.";
          } else {
            resultText = matches.slice(0, 100).join("\n");
            if (matches.length > 100) {
              resultText += `\n... truncated. Found ${matches.length} matches total.`;
            }
          }
        } else {
          // MCP tool call
          const mcpResult = await mcpClient.callTool(tc.name, tc.arguments);
          resultText = mcpResult.content.map(c => c.text).join("\n");
        }
      } catch (err) {
        resultText = `Tool call execution error: ${err.message}`;
      }

      console.log(`Tool Result: ${resultText.slice(0, 100)}...`);

      if (provider === "anthropic") {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: tc.id,
              content: resultText
            }
          ]
        });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.name,
          content: resultText
        });
      }
    }
  }

  // Run final CI verification
  let passed = false;
  let testOutput = "";
  try {
    const out = execSync("node test.mjs", { cwd: sandboxDir, encoding: "utf8", stdio: "pipe" });
    passed = true;
    testOutput = out;
  } catch (err) {
    console.log("CI check failed.");
    testOutput = `Test failed:\nStdout: ${err.stdout}\nStderr: ${err.stderr}`;
  }

  const duration = Math.round(performance.now() - startTime);

  // Clean up
  if (mcpClient) {
    await mcpClient.stop();
  }
  await rm(sandboxDir, { recursive: true, force: true });

  const groupName = control ? (useWebSearch ? "control-web" : "control") : "experimental";

  const result = {
    task: taskName,
    control,
    web: useWebSearch,
    passed,
    turns,
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens
    },
    durationMs: duration,
    mcpToolsLoaded: mcpTools.map(t => t.name),
    toolCalls: toolCallCounts,
    turnsBreakdown: turnsList,
    testOutput
  };

  const resultsDir = path.join(repositoryRoot, ".dogfood");
  await mkdir(resultsDir, { recursive: true });
  const outPath = path.join(resultsDir, `eval-result-${taskName}-${groupName}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log(`\nEvaluation complete! Saved to ${outPath}`);
  console.log(result);
}

function getArg(args, key) {
  const idx = args.indexOf(key);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return null;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

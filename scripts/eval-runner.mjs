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

const repositoryRoot = path.resolve(import.meta.dirname, "..");

// Simple MCP Client Implementation
class McpClient {
  constructor(cwd) {
    this.cwd = cwd;
    this.child = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async start() {
    const cliPath = path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js");
    this.child = spawn(process.execPath, [cliPath, "--cwd", this.cwd, "serve-mcp"], {
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

  console.log(`Starting eval run. Task: ${taskName}, Control Group: ${control}, Provider: ${provider}, Model: ${modelName}, Max Cost: $${maxCost}`);

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

  if (!control) {
    console.log("Experimental Group: Building AgentDocs and starting MCP server...");
    // 1. Build AgentDocs inside sandbox
    const cliPath = path.join(repositoryRoot, "packages", "cli", "dist", "agentdocs.js");
    execSync(`"${process.execPath}" "${cliPath}" --cwd "${sandboxDir}" build`, { stdio: "inherit" });

    // 2. Start MCP server
    mcpClient = new McpClient(sandboxDir);
    await mcpClient.start();
    mcpTools = await mcpClient.listTools();
    console.log(`Loaded ${mcpTools.length} MCP tools.`);
  } else {
    console.log("Control Group: Skipping AgentDocs MCP context.");
  }

  // Base sandbox tools
  const sandboxTools = [
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
    },
    {
      name: "grep",
      description: "Search for a text pattern recursively in the workspace files, returning matching lines and filenames.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "The text pattern or keyword to search for" }
        },
        required: ["pattern"]
      }
    }
  ];

  const allTools = [...sandboxTools, ...mcpTools];

  // Load task description
  const taskDesc = await readFile(path.join(sandboxDir, "task.md"), "utf8");

  const systemPrompt = `You are a professional software engineer agent.
Your objective is to complete the task defined in task.md.
You have access to file-system tools and command-running tools.
Always run tests to verify that your implementation is correct before finishing.
${!control ? "You also have access to documentation tools. Use them to read about how to implement the task correctly." : ""}`;

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

  while (!done && turns < 10) {
    turns++;
    console.log(`\n--- Turn ${turns} ---`);

    let response;
    try {
      if (provider === "anthropic") {
        const rawRes = await callAnthropic(messages, allTools, systemPrompt);
        totalInputTokens += rawRes.usage.input_tokens;
        totalOutputTokens += rawRes.usage.output_tokens;
        
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
        totalInputTokens += rawRes.usage.prompt_tokens;
        totalOutputTokens += rawRes.usage.completion_tokens;

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
  try {
    execSync("node test.mjs", { cwd: sandboxDir, stdio: "inherit" });
    passed = true;
  } catch (err) {
    console.log("CI check failed.");
  }

  const duration = Math.round(performance.now() - startTime);

  // Clean up
  if (mcpClient) {
    await mcpClient.stop();
  }
  await rm(sandboxDir, { recursive: true, force: true });

  const result = {
    task: taskName,
    control,
    passed,
    turns,
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens
    },
    durationMs: duration
  };

  const resultsDir = path.join(repositoryRoot, ".dogfood");
  await mkdir(resultsDir, { recursive: true });
  const outPath = path.join(resultsDir, `eval-result-${taskName}-${control ? "control" : "experimental"}.json`);
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

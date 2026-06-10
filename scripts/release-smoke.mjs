import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(root, "packages", "cli", "package.json"), "utf8"));
const command = process.argv[2];
const commandPrefix = process.argv.slice(3);
if (command === undefined) {
  throw new Error("Usage: node scripts/release-smoke.mjs <command> [...prefix args]");
}

const cwd = await mkdtemp(path.join(os.tmpdir(), "agentdocs-release-smoke-"));
await cp(path.join(root, "fixtures", "basic-docs"), path.join(cwd, "docs"), { recursive: true });

const version = (await run(["--version"])).trim();
if (version !== packageJson.version) {
  throw new Error(`Expected version ${packageJson.version}, received ${version}.`);
}
await run(["--cwd", cwd, "init"]);
await run(["--cwd", cwd, "build"]);
await run(["--cwd", cwd, "doctor", "--min-score", "0"]);
await run(["--cwd", cwd, "search", "EXAMPLE_API_KEY", "--json"]);

const firstHashes = await artifactHashes(path.join(cwd, ".agentdocs"));
await run(["--cwd", cwd, "build"]);
const secondHashes = await artifactHashes(path.join(cwd, ".agentdocs"));
if (JSON.stringify(firstHashes) !== JSON.stringify(secondHashes)) {
  throw new Error("Repeated builds produced different artifact hashes.");
}

const mcp = await mcpSmoke(cwd);
if (mcp.version !== version) {
  throw new Error(`Expected MCP version ${version}, received ${mcp.version}.`);
}
const index = await readFile(path.join(cwd, ".agentdocs", "index.sqlite"));
const backend = index.subarray(0, 16).toString("utf8").startsWith("SQLite format 3")
  ? "sqlite-fts5"
  : "lexical";
const nodeMajor = Number(process.versions.node.split(".")[0]);
if ((nodeMajor >= 22 && backend !== "sqlite-fts5") || (nodeMajor < 22 && backend !== "lexical")) {
  throw new Error(`Unexpected ${backend} search backend on Node ${process.versions.node}.`);
}
process.stdout.write(
  `Release smoke passed: ${version}, ${backend}, ${Object.keys(firstHashes).length} deterministic artifacts, ${mcp.tools} MCP tools, search and resource reads available.\n`,
);

async function run(args) {
  const child = spawn(command, [...commandPrefix, ...args], {
    cwd: root,
    shell: process.platform === "win32" && command !== process.execPath && command !== "node",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (code !== 0) {
    throw new Error(`Command failed (${args.join(" ")}):\n${stdout}${stderr}`);
  }
  return stdout;
}

async function artifactHashes(directory) {
  const files = await listFiles(directory);
  return Object.fromEntries(await Promise.all(files
    .filter((file) => !file.includes("/sources/"))
    .map(async (file) => [
      file,
      createHash("sha256").update(await readFile(path.join(directory, file))).digest("hex"),
    ])));
}

async function listFiles(directory, relative = "") {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(directory, child));
    } else {
      files.push(child);
    }
  }
  return files;
}

async function mcpSmoke(projectCwd) {
  const child = spawn(command, [...commandPrefix, "--cwd", projectCwd, "serve-mcp"], {
    cwd: root,
    shell: process.platform === "win32" && command !== process.execPath && command !== "node",
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "";
  const pending = new Map();
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  const request = (id, method, params = {}) => new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`, (error) => {
      if (error) reject(error);
    });
  });
  try {
    const initialized = await request(1, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "release-smoke", version: "1" },
    });
    const tools = await request(2, "tools/list");
    const search = await request(3, "tools/call", {
      name: "search_docs",
      arguments: { query: "EXAMPLE_API_KEY", limit: 1 },
    });
    const resource = await request(4, "resources/read", { uri: "agentdocs://llms.txt" });
    if (search.result.structuredContent.results.length !== 1 || resource.result.contents[0].text.length === 0) {
      throw new Error("MCP search or resource smoke failed.");
    }
    return {
      tools: tools.result.tools.length,
      version: initialized.result.serverInfo.version,
    };
  } finally {
    child.kill();
  }
}

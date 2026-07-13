import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workspace = path.resolve(process.argv[2] ?? "");
const indexFile = path.join(workspace, "index.js");
assert.ok(existsSync(indexFile), "missing index.js");
const source = readFileSync(indexFile, "utf8");

assert.match(source, /@langchain\/openai/);
assert.match(source, /ChatOpenAI/);
assert.match(source, /new\s+ChatOpenAI\s*\(/);
assert.match(source, /\.invoke\s*\(/);
assert.match(source, /export\s+(?:async\s+)?function/);
assert.doesNotMatch(source, /new\s+LLMChain|from\s+["']langchain\/prompts["']/);

console.log("PASS: LangChain hidden oracle.");

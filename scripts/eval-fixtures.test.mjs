import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateFixtureSnapshot } from "./eval-fixtures.mjs";

const root = path.resolve("fixtures", "eval-tasks");

test("the Auth.js dense fixture is reproducible and evidence-complete", async () => {
  const result = await validateFixtureSnapshot(path.join(root, "authjs-v5"));
  assert.equal(result.valid, true, result.issues.join("; "));
  assert.equal(result.pageCount, 100);
});

test("the Stripe fixture contains evidence for its App Router contract", async () => {
  const result = await validateFixtureSnapshot(path.join(root, "stripe-webhooks"));
  assert.equal(result.valid, true, result.issues.join("; "));
  assert.equal(result.pageCount, 102);
  assert.deepEqual(result.missingEvidence, []);
});

test("the validator blocks a corpus that cannot support its task", async () => {
  const taskDir = await mkdtemp(path.join(".dogfood", "fixture-validator-"));
  try {
    await mkdir(path.join(taskDir, "docs"), { recursive: true });
    await mkdir(path.join(taskDir, "evaluation"), { recursive: true });
    const content = Buffer.from("# unrelated docs\n");
    const hash = createHash("sha256").update("page.md").update("\0").update(content).update("\0").digest("hex");
    await writeFile(path.join(taskDir, "docs", "page.md"), content);
    await writeFile(path.join(taskDir, "task.md"), "task");
    await writeFile(path.join(taskDir, "test.mjs"), "test");
    await writeFile(path.join(taskDir, "package.json"), JSON.stringify({ dependencies: {} }));
    await writeFile(path.join(taskDir, "evaluation", "private-test.mjs"), "test");
    await writeFile(path.join(taskDir, "fixture.manifest.json"), JSON.stringify({
      task: "invalid",
      source: { format: "markdown", pageCount: 1, byteCount: content.length, corpusHash: hash },
      evaluation: { requiredEvidence: ["missing evidence"] },
    }));
    const result = await validateFixtureSnapshot(taskDir);
    assert.equal(result.valid, false);
    assert.deepEqual(result.missingEvidence, ["missing evidence"]);
  } finally {
    await rm(taskDir, { recursive: true, force: true });
  }
});

test("raw evaluation preserves the full text-like fixture corpus", async () => {
  const runId = `fixture-filter-${process.pid}`;
  const resultsDir = path.join(".dogfood", "evals", runId);
  const resultPath = path.join(resultsDir, "eval-result-authjs-v5-control-local-raw-seed-1.json");
  const expectedRawCorpusFiles = await countTextLikeFiles(path.join(root, "authjs-v5", "docs"));
  try {
    execFileSync(process.execPath, [
      "scripts/eval-runner.mjs",
      "--task", "authjs-v5",
      "--group", "control-local-raw",
      "--seed", "1",
      "--dry-run",
      "--run-id", runId,
      "--results-dir", resultsDir,
    ], { stdio: "pipe" });
    const result = JSON.parse(await readFile(resultPath, "utf8"));
    assert.equal(result.schemaVersion, 5);
    assert.equal(result.rawCorpusFilesLoaded, expectedRawCorpusFiles);
    assert.ok(result.rawCorpusFilesLoaded >= 100);
  } finally {
    await rm(resultsDir, { recursive: true, force: true });
  }
});

async function countTextLikeFiles(rootDir) {
  const extensions = new Set([".md", ".mdx", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".html", ".htm", ".txt", ".yaml", ".yml", ".json"]);
  let count = 0;
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (extensions.has(path.extname(entry.name).toLowerCase())) count += 1;
    }
  }
  await visit(rootDir);
  return count;
}

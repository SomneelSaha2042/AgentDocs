import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateFixtureSnapshot } from "./eval-fixtures.mjs";

const root = path.resolve("fixtures", "eval-tasks");

test("the Auth.js dense fixture is reproducible and evidence-complete", async () => {
  const result = await validateFixtureSnapshot(path.join(root, "authjs-v5"));
  assert.equal(result.valid, true, result.issues.join("; "));
  assert.equal(result.pageCount, 100);
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

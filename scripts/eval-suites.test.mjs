import test from "node:test";
import assert from "node:assert/strict";
import {
  CLEAN_EVAL_GROUPS,
  NORTH_STAR_SUITE,
  parseSeedList,
  plannedRuns,
  resultDirectoryFor,
} from "./eval-suites.mjs";

test("north-star suite declares the matched dense-doc matrix", () => {
  assert.deepEqual(NORTH_STAR_SUITE.tasks, [
    "authjs-v5",
    "stripe-webhooks",
    "langchain-js",
  ]);
  assert.deepEqual(NORTH_STAR_SUITE.groups, CLEAN_EVAL_GROUPS);
  assert.deepEqual(NORTH_STAR_SUITE.seeds, [1, 2, 3]);
  assert.equal(NORTH_STAR_SUITE.model, "gpt-4o");
  assert.equal(NORTH_STAR_SUITE.maxCost, 1);
  assert.equal(NORTH_STAR_SUITE.maxInputTokens, 24000);
  assert.equal(NORTH_STAR_SUITE.maxOutputTokens, 2000);
  assert.equal(NORTH_STAR_SUITE.mcpTools, "query_docs,read_page");
});

test("seed parsing is strict and deterministic", () => {
  assert.deepEqual(parseSeedList("3,1,2,2"), [1, 2, 3]);
  assert.throws(() => parseSeedList("1,nope"), /positive integer/);
  assert.throws(() => parseSeedList("0"), /positive integer/);
});

test("result directories are isolated by run id", () => {
  assert.equal(
    resultDirectoryFor("north-star-v1", "20260713-120000"),
    ".dogfood/evals/20260713-120000-north-star-v1",
  );
});

test("the north-star pilot has 27 paired runs", () => {
  const runs = plannedRuns(NORTH_STAR_SUITE);
  assert.equal(runs.length, 27);
  assert.deepEqual(runs[0], {
    task: "authjs-v5",
    group: "experimental-agentdocs",
    seed: 1,
  });
  assert.deepEqual(runs.at(-1), {
    task: "langchain-js",
    group: "control-web-raw",
    seed: 3,
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateContextResponse } from "./eval-context-gate.mjs";

const validQuery = {
  estimatedTokens: 100,
  steps: [],
  codeExamples: [],
  gotchas: [],
  citations: [],
  requirements: [],
  followUpRefs: [{ ref: "agentdocs://pages/page.md#chunk" }],
};

test("context gate accepts a compact response with exact page refs", () => {
  const result = evaluateContextResponse(validQuery, { maxInputTokens: 1000 });
  assert.equal(result.passed, true);
  assert.equal(result.threshold, 250);
});

test("context gate rejects oversized first responses without changing them", () => {
  const result = evaluateContextResponse({
    ...validQuery,
    estimatedTokens: 251,
  }, { maxInputTokens: 1000 });
  assert.equal(result.passed, false);
  assert.match(result.errors[0], /offline gate threshold is 250/);
});

test("context gate rejects refs that cannot be passed to read_page", () => {
  const result = evaluateContextResponse({
    ...validQuery,
    followUpRefs: [{ ref: "file:///private/docs.md" }],
  }, { maxInputTokens: 1000 });
  assert.equal(result.passed, false);
  assert.match(result.errors[0], /readable agentdocs page ref/);
});

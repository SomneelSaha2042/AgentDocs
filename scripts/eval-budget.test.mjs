import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRequestBudget,
  classifyProviderFailure,
  estimateRequestTokens,
} from "./eval-budget.mjs";

test("request budget estimates the full prompt envelope", () => {
  const estimate = estimateRequestTokens({
    system: "system instructions",
    messages: [{ role: "user", content: "task context" }],
    tools: [{ name: "read", description: "read evidence" }],
  });

  assert.ok(estimate > 0);
  assert.doesNotThrow(() => assertRequestBudget({
    system: "system instructions",
    messages: [{ role: "user", content: "task context" }],
    tools: [{ name: "read", description: "read evidence" }],
    maxInputTokens: estimate,
  }));
});

test("request budget rejects an oversized context before provider submission", () => {
  assert.throws(() => assertRequestBudget({
    system: "system",
    messages: [{ role: "user", content: "a context that is too large" }],
    tools: [],
    maxInputTokens: 1,
  }), (error) => error.code === "context_budget_exceeded"
    && error.details.requestedTokens > error.details.limitTokens);
});

test("provider token-limit errors are classified separately from retryable rate limits", () => {
  const oversized = classifyProviderFailure(429, "Request too large for gpt-4o. Limit 30000, Requested 31429.");
  assert.deepEqual(oversized, {
    code: "provider_tpm_limit",
    retryable: false,
    limitTokens: 30000,
    requestedTokens: 31429,
  });

  const rolling = classifyProviderFailure(429, "Rate limit reached. Please try again later.");
  assert.deepEqual(rolling, {
    code: "provider_rate_limit",
    retryable: true,
  });
});

test("malformed tool-call payloads are classified as evaluator protocol failures", () => {
  assert.deepEqual(
    classifyProviderFailure(400, "Invalid messages[14].tool_calls: empty array. Expected minimum length 1."),
    { code: "provider_protocol_error", retryable: false },
  );
});

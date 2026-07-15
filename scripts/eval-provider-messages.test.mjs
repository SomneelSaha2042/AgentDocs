import test from "node:test";
import assert from "node:assert/strict";
import { assistantMessageFor } from "./eval-provider-messages.mjs";

test("OpenAI assistant messages omit empty tool_calls", () => {
  const message = assistantMessageFor("openai", { content: "done", tool_calls: [] });
  assert.deepEqual(message, { role: "assistant", content: "done" });
  assert.equal(Object.hasOwn(message, "tool_calls"), false);
});

test("OpenAI assistant messages preserve real tool calls", () => {
  const message = assistantMessageFor("openai", {
    content: "",
    tool_calls: [{ id: "call_1", name: "read_page", arguments: { chunkId: "chunk_1" } }],
  });
  assert.equal(message.tool_calls.length, 1);
  assert.equal(message.tool_calls[0].function.name, "read_page");
});

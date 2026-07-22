import test from "node:test";
import assert from "node:assert/strict";
import { createEvidenceProtocol } from "./eval-evidence-protocol.mjs";

const inspectResponse = {
  readiness: { recommendation: "inspect", coverage: "partial", issueCodes: ["missing_task_requirement_evidence"] },
  citations: [{ id: "code_current", codeBlockId: "code_current" }],
  followUpRefs: [{ type: "chunk", ref: "agentdocs://pages/page_1.md#chunk_1", pageId: "page_1", chunkId: "chunk_1", title: "Current example" }],
};

test("inspect readiness blocks writing until cited evidence is read", () => {
  const protocol = createEvidenceProtocol();
  protocol.observeQuery({ turn: 1, response: inspectResponse });
  assert.equal(protocol.beforeWrite({ turn: 2 }).code, "inspection_required");
  protocol.observeReadPage({ turn: 3, args: { ref: "agentdocs://pages/page_1.md#chunk_1" }, result: { section: { complete: true } } });
  assert.deepEqual(protocol.beforeWrite({ turn: 4 }), { allowed: true });
  assert.equal(protocol.snapshot().status, "ready");
});

test("an uncited or failed page read does not satisfy inspection", () => {
  const protocol = createEvidenceProtocol();
  protocol.observeQuery({ turn: 1, response: inspectResponse });
  protocol.observeReadPage({ turn: 2, args: { ref: "agentdocs://pages/page_1.md#wrong_chunk" }, result: { section: { complete: true } } });
  assert.equal(protocol.beforeWrite({ turn: 3 }).code, "inspection_required");
  protocol.observeReadPage({ turn: 4, args: { ref: "agentdocs://pages/page_1.md#chunk_1" }, result: { isError: true } });
  assert.equal(protocol.beforeWrite({ turn: 5 }).code, "inspection_required");
});

test("stop readiness remains blocked and missing query is reported", () => {
  const noQuery = createEvidenceProtocol();
  assert.equal(noQuery.beforeWrite({ turn: 1 }).code, "missing_query_docs");

  const stopped = createEvidenceProtocol();
  stopped.observeQuery({
    turn: 1,
    response: { readiness: { recommendation: "stop", coverage: "partial", issueCodes: ["preferred_context_mismatch"] } },
  });
  assert.equal(stopped.beforeWrite({ turn: 2 }).code, "readiness_stop");
});

test("implement readiness permits writing without an extra documentation call", () => {
  const protocol = createEvidenceProtocol();
  protocol.observeQuery({
    turn: 1,
    response: { readiness: { recommendation: "implement", coverage: "complete", issueCodes: [] } },
  });
  assert.deepEqual(protocol.beforeWrite({ turn: 2 }), { allowed: true });
});

test("inspect readiness requires every explicitly required source", () => {
  const protocol = createEvidenceProtocol();
  protocol.observeQuery({
    turn: 1,
    response: {
      readiness: { recommendation: "inspect", coverage: "partial", issueCodes: ["missing_task_requirement_evidence"] },
      followUpRefs: [
        { type: "chunk", ref: "agentdocs://pages/page_1.md#chunk_1", pageId: "page_1", chunkId: "chunk_1", title: "Provider", requiredFor: ["provider"] },
        { type: "chunk", ref: "agentdocs://pages/page_2.md#chunk_2", pageId: "page_2", chunkId: "chunk_2", title: "Adapter", requiredFor: ["adapter"] },
      ],
    },
  });
  protocol.observeReadPage({ turn: 2, args: { ref: "agentdocs://pages/page_1.md#chunk_1" }, result: { section: { complete: true } } });
  assert.equal(protocol.beforeWrite({ turn: 3 }).code, "inspection_required");
  protocol.observeReadPage({ turn: 4, args: { ref: "agentdocs://pages/page_2.md#chunk_2" }, result: { section: { complete: true } } });
  assert.deepEqual(protocol.beforeWrite({ turn: 5 }), { allowed: true });
});

test("a required paginated source is complete only after its final continuation", () => {
  const protocol = createEvidenceProtocol();
  protocol.observeQuery({
    turn: 1,
    response: {
      readiness: { recommendation: "inspect", coverage: "partial", issueCodes: ["missing_task_requirement_evidence"] },
      followUpRefs: [{ type: "chunk", ref: "agentdocs://pages/page_1.md#chunk_1", title: "Provider", requiredFor: ["provider"] }],
    },
  });
  protocol.observeReadPage({
    turn: 2,
    args: { ref: "agentdocs://pages/page_1.md#chunk_1" },
    result: { section: { complete: false, nextRef: "agentdocs://pages/page_1.md?part=2#chunk_1" } },
  });
  assert.equal(protocol.beforeWrite({ turn: 3 }).code, "inspection_required");
  protocol.observeReadPage({
    turn: 4,
    args: { ref: "agentdocs://pages/page_1.md?part=2#chunk_1" },
    result: { section: { complete: true } },
  });
  assert.deepEqual(protocol.beforeWrite({ turn: 5 }), { allowed: true });
});

const PROTOCOL_CODES = Object.freeze({
  missingQuery: "missing_query_docs",
  missingReadiness: "missing_query_readiness",
  inspectionRequired: "inspection_required",
  stopped: "readiness_stop",
});

/**
 * Tracks the generic evidence-use protocol for experimental evaluations.
 * It contains no package, task, or benchmark-specific knowledge.
 */
export function createEvidenceProtocol({ enabled = true } = {}) {
  const state = {
    enabled,
    queries: [],
    reads: [],
    blockedWrites: [],
    firstWriteAttemptTurn: null,
    firstAllowedWriteTurn: null,
  };

  function observeQuery({ turn, response }) {
    if (!state.enabled) return;
    const readiness = response?.readiness;
    const recommendation = readiness?.recommendation ?? null;
    const referenceIds = referenceIdsFor(response);
    state.queries.push({
      turn,
      recommendation,
      coverage: readiness?.coverage ?? null,
      issueCodes: Array.isArray(readiness?.issueCodes) ? readiness.issueCodes : [],
      referenceIds,
      inspectedReferenceIds: [],
    });
  }

  function observeReadPage({ turn, args, result }) {
    if (!state.enabled) return;
    const referenceId = readReferenceId(args);
    const latest = state.queries.at(-1);
    const readable = result?.section && typeof result.section === "object";
    const matched = Boolean(readable && latest?.referenceIds.includes(referenceId));
    const read = { turn, referenceId, matched };
    state.reads.push(read);
    if (matched && latest) {
      latest.inspectedReferenceIds.push(referenceId);
    }
  }

  function beforeWrite({ turn }) {
    if (!state.enabled) return { allowed: true };
    state.firstWriteAttemptTurn ??= turn;
    const latest = state.queries.at(-1);
    let code;
    if (latest === undefined) {
      code = PROTOCOL_CODES.missingQuery;
    } else if (latest.recommendation === null) {
      code = PROTOCOL_CODES.missingReadiness;
    } else if (latest.recommendation === "stop") {
      code = PROTOCOL_CODES.stopped;
    } else if (
      latest.recommendation === "inspect"
      && latest.inspectedReferenceIds.length === 0
    ) {
      code = PROTOCOL_CODES.inspectionRequired;
    }
    if (code === undefined) {
      state.firstAllowedWriteTurn ??= turn;
      return { allowed: true };
    }
    state.blockedWrites.push({ turn, code });
    return {
      allowed: false,
      code,
      message: protocolMessage(code),
    };
  }

  function snapshot() {
    if (!state.enabled) {
      return { enabled: false };
    }
    const latest = state.queries.at(-1);
    let status = "missing_query_docs";
    if (latest?.recommendation === "stop") status = "readiness_stop";
    else if (latest?.recommendation === "inspect" && latest.inspectedReferenceIds.length === 0) {
      status = "inspection_required";
    } else if (latest?.recommendation === "implement" || latest?.inspectedReferenceIds.length > 0) {
      status = "ready";
    } else if (latest?.recommendation === null) {
      status = "missing_query_readiness";
    }
    return {
      enabled: true,
      status,
      queryCount: state.queries.length,
      queries: state.queries,
      reads: state.reads,
      firstWriteAttemptTurn: state.firstWriteAttemptTurn,
      firstAllowedWriteTurn: state.firstAllowedWriteTurn,
      blockedWriteAttempts: state.blockedWrites,
    };
  }

  return { observeQuery, observeReadPage, beforeWrite, snapshot };
}

function referenceIdsFor(response) {
  const ids = [];
  for (const citation of response?.citations ?? []) {
    for (const value of [citation.id, citation.pageId, citation.headingId, citation.codeBlockId]) {
      if (typeof value === "string" && value.length > 0) ids.push(value);
    }
  }
  for (const reference of response?.followUpRefs ?? []) {
    for (const value of [reference.ref, reference.pageId, reference.chunkId]) {
      if (typeof value === "string" && value.length > 0) ids.push(value);
    }
  }
  return [...new Set(ids)];
}

function readReferenceId(args = {}) {
  return args.chunkId ?? args.pageId ?? args.heading ?? "";
}

function protocolMessage(code) {
  if (code === PROTOCOL_CODES.missingQuery) {
    return "Call query_docs for implementation context before writing files.";
  }
  if (code === PROTOCOL_CODES.missingReadiness) {
    return "The documentation response did not include readiness. Query the cited documentation again before writing files.";
  }
  if (code === PROTOCOL_CODES.stopped) {
    return "Documentation readiness is STOP. Resolve the conflict or missing evidence before writing implementation files.";
  }
  return "Documentation readiness is INSPECT. Call read_page using one cited page, chunk, heading, or code-block ID before writing files.";
}

export { PROTOCOL_CODES };

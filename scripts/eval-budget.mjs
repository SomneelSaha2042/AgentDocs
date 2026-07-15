const TOKEN_PATTERN = /(?:limit|requested)\s+([\d,]+)/gi;

export const DEFAULT_MAX_INPUT_TOKENS = 24000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 2000;

export class EvaluationOperationalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "EvaluationOperationalError";
    this.code = code;
    this.details = details;
  }
}

export function estimateRequestTokens({ system, messages, tools }) {
  return estimateTokens(JSON.stringify({ system, messages, tools }));
}

export function estimateTokens(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(text.length / 4);
}

export function assertRequestBudget({ system, messages, tools, maxInputTokens }) {
  const requestedTokens = estimateRequestTokens({ system, messages, tools });
  const limitTokens = Number(maxInputTokens);
  if (!Number.isFinite(limitTokens) || limitTokens <= 0) {
    throw new Error("maxInputTokens must be a positive number");
  }
  if (requestedTokens > limitTokens) {
    throw new EvaluationOperationalError(
      "context_budget_exceeded",
      `Estimated request context of ${requestedTokens} tokens exceeds the ${limitTokens}-token evaluation budget.`,
      { requestedTokens, limitTokens },
    );
  }
  return requestedTokens;
}

export function classifyProviderFailure(status, text = "") {
  const normalized = String(text);
  if (status === 400 && /tool[_ ]calls?.*(empty array|minimum length)/i.test(normalized)) {
    return { code: "provider_protocol_error", retryable: false };
  }
  if (status === 429) {
    const tokenLimit = parseTokenLimit(normalized);
    const lower = normalized.toLowerCase();
    if (tokenLimit || lower.includes("tokens per minute") || lower.includes("request too large")) {
      return {
        code: "provider_tpm_limit",
        retryable: false,
        ...(tokenLimit ?? {}),
      };
    }
    return { code: "provider_rate_limit", retryable: true };
  }
  return { code: "provider_api_error", retryable: false };
}

export function providerFailureError(status, text) {
  const classification = classifyProviderFailure(status, text);
  const details = {
    providerStatus: status,
    ...classification,
  };
  return new EvaluationOperationalError(
    classification.code,
    `Provider request failed with HTTP ${status}: ${text}`,
    details,
  );
}

function parseTokenLimit(text) {
  const values = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    values.push(Number(match[1].replaceAll(",", "")));
  }
  if (values.length < 2) return null;
  const limitTokens = values[0];
  const requestedTokens = values[1];
  if (!Number.isFinite(limitTokens) || !Number.isFinite(requestedTokens)) return null;
  return { limitTokens, requestedTokens };
}

/**
 * Build provider-native assistant messages from the runner's normalized
 * response shape. Keeping this pure makes provider serialization testable
 * without making an API request.
 */
export function assistantMessageFor(provider, response) {
  if (provider === "anthropic") {
    return {
      role: "assistant",
      content: [
        ...(response.content ? [{ type: "text", text: response.content }] : []),
        ...response.tool_calls.map((toolCall) => ({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.arguments,
        })),
      ],
    };
  }

  const message = {
    role: "assistant",
    content: response.content,
  };
  const toolCalls = response.tool_calls.map((toolCall) => ({
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.arguments),
    },
  }));
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }
  return message;
}

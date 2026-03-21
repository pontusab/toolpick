import type { ModelMessage, StepResult, ToolSet } from "ai";

/**
 * Extracts the best search query from conversation context for tool selection.
 *
 * - Step 0: uses the original user prompt
 * - Step N with assistant text: uses the assistant's last text (contains next-action intent)
 * - Step N without text: combines original prompt with completed tool names for context shift
 */
export function extractQuery(
  messages: ModelMessage[],
  steps: ReadonlyArray<StepResult<ToolSet>>,
  stepNumber: number,
): string {
  if (stepNumber === 0 || steps.length === 0) {
    return getLastUserMessage(messages);
  }

  const lastStep = steps[steps.length - 1];

  // If the model produced text, it likely describes its next intent
  // e.g. "Ticket created. Now I'll notify the team on Slack."
  if (lastStep.text && lastStep.text.trim().length > 0) {
    return lastStep.text;
  }

  // If only tool calls happened, combine original prompt with
  // what already executed to shift context
  if (lastStep.toolCalls.length > 0) {
    const completedTools = lastStep.toolCalls.map((tc) => tc.toolName).join(" ");
    const originalQuery = getLastUserMessage(messages);
    return `${originalQuery} — ${completedTools}`;
  }

  return getLastUserMessage(messages);
}

function getLastUserMessage(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        return msg.content;
      }
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text);
        if (textParts.length > 0) return textParts.join(" ");
      }
    }
  }
  return "";
}

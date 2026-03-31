import type { ModelMessage, StepResult, ToolSet } from "ai";

const RECENT_WINDOW = 3;

/**
 * Extracts the best search query from conversation context for tool selection.
 *
 * Uses an anchor-plus-context strategy: the longest user message (typically
 * the original intent) is always included so keywords like "invoice", "deploy",
 * "refund" survive even when the most recent message is just "Yes" or "Ok".
 * The last few messages are appended for recency and topic-shift awareness.
 *
 * - Step 0: anchor + recent conversation context
 * - Step N with assistant text: uses the assistant's last text (contains next-action intent)
 * - Step N without text: combines conversation context with completed tool names
 */
export function extractQuery<TOOLS extends ToolSet>(
  messages: ModelMessage[],
  steps: ReadonlyArray<StepResult<TOOLS>>,
  stepNumber: number,
): string {
  if (stepNumber === 0 || steps.length === 0) {
    return buildConversationQuery(messages);
  }

  const lastStep = steps[steps.length - 1];

  if (lastStep.text && lastStep.text.trim().length > 0) {
    return lastStep.text;
  }

  if (lastStep.toolCalls.length > 0) {
    const completedTools = lastStep.toolCalls.map((tc) => tc.toolName).join(" ");
    const originalQuery = buildConversationQuery(messages);
    return `${originalQuery} — ${completedTools}`;
  }

  return buildConversationQuery(messages);
}

/**
 * Builds a search query by anchoring on the most substantive user message
 * and enriching with recent conversation context.
 *
 * The anchor is the longest user message across the entire conversation —
 * in agent flows this is almost always the original intent ("Create an
 * invoice for Acme, 5 hours consulting at $150/hr"). Recent messages
 * (last RECENT_WINDOW with text) are appended so topic shifts and
 * refinements are captured too.
 */
function buildConversationQuery(messages: ModelMessage[]): string {
  let anchor = "";
  for (const msg of messages) {
    if (msg.role === "user") {
      const text = extractTextContent(msg);
      if (text.length > anchor.length) {
        anchor = text;
      }
    }
  }

  const recent: string[] = [];
  let collected = 0;
  for (let i = messages.length - 1; i >= 0 && collected < RECENT_WINDOW; i--) {
    const text = extractTextContent(messages[i]);
    if (text) {
      recent.unshift(text);
      collected++;
    }
  }

  if (!anchor || recent.includes(anchor)) {
    return recent.join(" ");
  }

  return [anchor, ...recent].join(" ");
}

function extractTextContent(msg: ModelMessage): string {
  if (msg.role === "user" || msg.role === "assistant") {
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ");
    }
  }
  return "";
}

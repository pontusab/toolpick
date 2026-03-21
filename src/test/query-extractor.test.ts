import { describe, it, expect } from "bun:test";
import { extractQuery } from "../query-extractor";

const makeStep = (overrides: Record<string, unknown> = {}) => ({
  toolCalls: [],
  toolResults: [],
  text: "",
  finishReason: "stop",
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  warnings: [],
  request: {},
  response: { messages: [] },
  ...overrides,
});

describe("extractQuery", () => {
  it("returns last user message at step 0", () => {
    const messages = [
      { role: "user" as const, content: "deploy the app" },
    ];
    expect(extractQuery(messages, [], 0)).toBe("deploy the app");
  });

  it("returns last user message when multiple exist", () => {
    const messages = [
      { role: "user" as const, content: "first message" },
      { role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }] },
      { role: "user" as const, content: "second message" },
    ];
    expect(extractQuery(messages, [], 0)).toBe("second message");
  });

  it("extracts text from multipart user content", () => {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "please " },
          { type: "text" as const, text: "deploy" },
        ],
      },
    ];
    expect(extractQuery(messages, [], 0)).toBe("please  deploy");
  });

  it("uses assistant text from last step when available", () => {
    const messages = [{ role: "user" as const, content: "do the thing" }];
    const steps = [
      makeStep({ text: "Issue created. Now I'll notify on Slack." }),
    ];
    expect(extractQuery(messages, steps as any, 1)).toBe(
      "Issue created. Now I'll notify on Slack.",
    );
  });

  it("combines user query with tool names when step has tool calls but no text", () => {
    const messages = [{ role: "user" as const, content: "handle the bug" }];
    const steps = [
      makeStep({
        toolCalls: [
          { toolName: "createIssue", toolCallId: "1", args: {} },
          { toolName: "sendSlack", toolCallId: "2", args: {} },
        ],
      }),
    ];
    const result = extractQuery(messages, steps as any, 1);
    expect(result).toContain("handle the bug");
    expect(result).toContain("createIssue");
    expect(result).toContain("sendSlack");
  });

  it("falls back to user message when step has no text and no tool calls", () => {
    const messages = [{ role: "user" as const, content: "do something" }];
    const steps = [makeStep()];
    expect(extractQuery(messages, steps as any, 1)).toBe("do something");
  });

  it("returns empty string when no user messages exist", () => {
    const messages = [
      { role: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
    ];
    expect(extractQuery(messages, [], 0)).toBe("");
  });

  it("ignores whitespace-only assistant text and falls back", () => {
    const messages = [{ role: "user" as const, content: "original query" }];
    const steps = [makeStep({ text: "   " })];
    expect(extractQuery(messages, steps as any, 1)).toBe("original query");
  });
});

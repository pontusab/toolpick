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
  it("returns single user message at step 0", () => {
    const messages = [
      { role: "user" as const, content: "deploy the app" },
    ];
    expect(extractQuery(messages, [], 0)).toBe("deploy the app");
  });

  it("combines recent context when multiple messages exist", () => {
    const messages = [
      { role: "user" as const, content: "first message" },
      { role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }] },
      { role: "user" as const, content: "second message" },
    ];
    const result = extractQuery(messages, [], 0);
    expect(result).toContain("first message");
    expect(result).toContain("ok");
    expect(result).toContain("second message");
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

  it("combines conversation context with tool names when step has tool calls but no text", () => {
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

  it("falls back to conversation context when step has no text and no tool calls", () => {
    const messages = [{ role: "user" as const, content: "do something" }];
    const steps = [makeStep()];
    expect(extractQuery(messages, steps as any, 1)).toBe("do something");
  });

  it("returns empty string when no extractable text exists", () => {
    const messages = [
      { role: "tool" as const, content: [{ type: "tool-result" as const, toolCallId: "1", toolName: "foo", result: {} }] },
    ] as any;
    expect(extractQuery(messages, [], 0)).toBe("");
  });

  it("ignores whitespace-only assistant text and falls back", () => {
    const messages = [{ role: "user" as const, content: "original query" }];
    const steps = [makeStep({ text: "   " })];
    expect(extractQuery(messages, steps as any, 1)).toBe("original query");
  });
});

describe("extractQuery — anchor + context strategy", () => {
  it("carries original intent through multi-turn 'Yes' flow", () => {
    const messages = [
      { role: "user" as const, content: "Create an invoice for Acme, 5 hours consulting at $150/hr" },
      { role: "assistant" as const, content: [{ type: "text" as const, text: "I found Acme Corp. Shall I use that customer?" }] },
      { role: "user" as const, content: "Yes" },
    ];
    const result = extractQuery(messages, [], 0);
    expect(result).toContain("invoice");
    expect(result).toContain("Acme");
    expect(result).toContain("Yes");
  });

  it("preserves anchor when original intent has scrolled past the recent window", () => {
    const messages = [
      { role: "user" as const, content: "Create an invoice for Acme, 5 hours consulting at $150/hr" },
      { role: "assistant" as const, content: "Sure, looking up Acme..." },
      { role: "user" as const, content: "Ok" },
      { role: "assistant" as const, content: "Found Acme Corp." },
      { role: "user" as const, content: "That one" },
      { role: "assistant" as const, content: "Using Acme Corp. Confirm?" },
      { role: "user" as const, content: "Yes" },
      { role: "assistant" as const, content: "Rate is $150/hr?" },
      { role: "user" as const, content: "Correct" },
      { role: "assistant" as const, content: "Creating invoice..." },
      { role: "user" as const, content: "Do it" },
    ];
    const result = extractQuery(messages, [], 0);
    expect(result).toContain("invoice");
    expect(result).toContain("Acme");
    expect(result).toContain("Do it");
  });

  it("does not duplicate anchor when it is within the recent window", () => {
    const messages = [
      { role: "user" as const, content: "Deploy the marketing site to production" },
    ];
    const result = extractQuery(messages, [], 0);
    const occurrences = result.split("Deploy the marketing site to production").length - 1;
    expect(occurrences).toBe(1);
  });

  it("excludes tool-role messages from the query", () => {
    const messages = [
      { role: "user" as const, content: "find customer Acme" },
      { role: "assistant" as const, content: [
        { type: "tool-call" as const, toolCallId: "1", toolName: "searchCustomers", args: { q: "Acme" } },
      ] },
      { role: "tool" as const, content: [
        { type: "tool-result" as const, toolCallId: "1", toolName: "searchCustomers", result: { id: "123", name: "Acme Corp" } },
      ] },
      { role: "user" as const, content: "Yes, that one" },
    ];
    const result = extractQuery(messages, [], 0);
    expect(result).toContain("find customer Acme");
    expect(result).toContain("Yes, that one");
    expect(result).not.toContain("searchCustomers");
    expect(result).not.toContain("123");
  });

  it("handles topic switch — anchor is longest message, recent context has new topic", () => {
    const messages = [
      { role: "user" as const, content: "Create an invoice for Acme Corporation, 5 hours of consulting at $150/hr with net-30 terms" },
      { role: "assistant" as const, content: "Done! Invoice created." },
      { role: "user" as const, content: "Now check my bank balance" },
    ];
    const result = extractQuery(messages, [], 0);
    expect(result).toContain("invoice");
    expect(result).toContain("bank balance");
  });

  it("uses conversation context in step N tool-call fallback", () => {
    const messages = [
      { role: "user" as const, content: "Create an invoice for Acme, 5 hours at $150/hr" },
      { role: "assistant" as const, content: "Looking up customer..." },
      { role: "user" as const, content: "Yes" },
    ];
    const steps = [
      makeStep({
        toolCalls: [
          { toolName: "searchCustomers", toolCallId: "1", args: {} },
        ],
      }),
    ];
    const result = extractQuery(messages, steps as any, 1);
    expect(result).toContain("invoice");
    expect(result).toContain("searchCustomers");
  });

  it("uses conversation context in step N empty fallback", () => {
    const messages = [
      { role: "user" as const, content: "Create an invoice for Acme, 5 hours at $150/hr" },
      { role: "assistant" as const, content: "Confirming details..." },
      { role: "user" as const, content: "Yes" },
    ];
    const steps = [makeStep()];
    const result = extractQuery(messages, steps as any, 1);
    expect(result).toContain("invoice");
    expect(result).toContain("Acme");
  });
});

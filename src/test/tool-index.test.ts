import { describe, it, expect } from "bun:test";
import { createToolIndex } from "../tool-index";
import { tool, jsonSchema } from "ai";

const allTools = {
  createIssue: tool({
    description: "Create a new issue in the project tracker with title and priority",
    inputSchema: jsonSchema<{ title: string; priority: string }>({
      type: "object",
      properties: {
        title: { type: "string", description: "Issue title" },
        priority: { type: "string", description: "Priority level" },
      },
      required: ["title"],
    }),
    execute: async () => ({ id: "1" }),
  }),
  closeIssue: tool({
    description: "Close an existing issue by marking it as done",
    inputSchema: jsonSchema<{ issueId: string }>({
      type: "object",
      properties: { issueId: { type: "string" } },
      required: ["issueId"],
    }),
    execute: async () => ({ success: true }),
  }),
  sendMessage: tool({
    description: "Send a chat message to a Slack channel or user",
    inputSchema: jsonSchema<{ channel: string; text: string }>({
      type: "object",
      properties: {
        channel: { type: "string" },
        text: { type: "string" },
      },
      required: ["channel", "text"],
    }),
    execute: async () => ({ ok: true }),
  }),
  sendEmail: tool({
    description: "Send an email to a recipient with subject and body",
    inputSchema: jsonSchema<{ to: string; subject: string; body: string }>({
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    }),
    execute: async () => ({ sent: true }),
  }),
  deployApp: tool({
    description: "Deploy the application to production environment",
    inputSchema: jsonSchema<{ branch: string }>({
      type: "object",
      properties: { branch: { type: "string" } },
      required: ["branch"],
    }),
    execute: async () => ({ url: "https://example.com" }),
  }),
  queryDatabase: tool({
    description: "Execute a SQL query against the PostgreSQL database",
    inputSchema: jsonSchema<{ sql: string }>({
      type: "object",
      properties: { sql: { type: "string" } },
      required: ["sql"],
    }),
    execute: async () => ({ rows: [] }),
  }),
  translateText: tool({
    description: "Translate text from one language to another",
    inputSchema: jsonSchema<{ text: string; targetLanguage: string }>({
      type: "object",
      properties: {
        text: { type: "string" },
        targetLanguage: { type: "string" },
      },
      required: ["text", "targetLanguage"],
    }),
    execute: async () => ({ translated: "" }),
  }),
  uploadFile: tool({
    description: "Upload a file to cloud storage with a given path",
    inputSchema: jsonSchema<{ path: string; content: string }>({
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    }),
    execute: async () => ({ url: "" }),
  }),
  createInvoice: tool({
    description: "Create a Stripe invoice for a customer with line items",
    inputSchema: jsonSchema<{ customerId: string; amount: number }>({
      type: "object",
      properties: {
        customerId: { type: "string" },
        amount: { type: "number" },
      },
      required: ["customerId", "amount"],
    }),
    execute: async () => ({ invoiceId: "" }),
  }),
  getWeather: tool({
    description: "Get current weather forecast for a city or location",
    inputSchema: jsonSchema<{ city: string }>({
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    }),
    execute: async () => ({ temp: 20 }),
  }),
  summarizeText: tool({
    description: "Summarize a long document into key points using AI",
    inputSchema: jsonSchema<{ text: string }>({
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    }),
    execute: async () => ({ summary: "" }),
  }),
  resizeImage: tool({
    description: "Resize and optimize an image to specified dimensions",
    inputSchema: jsonSchema<{ url: string; width: number; height: number }>({
      type: "object",
      properties: {
        url: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["url", "width", "height"],
    }),
    execute: async () => ({ url: "" }),
  }),
};

describe("createToolIndex end-to-end", () => {
  const index = createToolIndex(allTools);

  it("exposes all tool names", () => {
    expect(index.toolNames).toHaveLength(12);
    expect(index.toolNames).toContain("createIssue");
    expect(index.toolNames).toContain("sendEmail");
  });

  it("select() returns relevant tools", async () => {
    const selected = await index.select("create a bug report", { maxTools: 3 });
    expect(selected).toContain("createIssue");
    expect(selected.length).toBeLessThanOrEqual(3);
  });

  it("select() with alwaysActive includes pinned tools", async () => {
    const selected = await index.select("translate this", {
      maxTools: 3,
      alwaysActive: ["getWeather"],
    });
    expect(selected).toContain("translateText");
    expect(selected).toContain("getWeather");
  });

  it("select() with threshold filters low-score results", async () => {
    const all = await index.select("deploy", { maxTools: 12, threshold: 0 });
    const filtered = await index.select("deploy", { maxTools: 12, threshold: 0.5 });
    expect(filtered.length).toBeLessThanOrEqual(all.length);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("select() returns only names that exist in ToolSet", async () => {
    const selected = await index.select("anything", {
      maxTools: 5,
      alwaysActive: ["nonExistentTool", "deployApp"],
    });
    expect(selected).not.toContain("nonExistentTool");
    expect(selected).toContain("deployApp");
  });

  it("searchTool() returns a tool with execute", () => {
    const st = index.searchTool();
    expect(st.execute).toBeDefined();
    expect(st.description).toBeDefined();
  });

  it("searchTool() execute returns relevant tools", async () => {
    const st = index.searchTool();
    const raw = await st.execute!({ query: "send a message" }, {
      messages: [],
      toolCallId: "test",
    } as any);
    const result = raw as { tools: Array<{ name: string }> };
    expect(result.tools.length).toBeGreaterThan(0);
    expect(result.tools.some((t) => t.name === "sendMessage")).toBe(true);
  });

  it("prepareStep() returns a function", () => {
    const fn = index.prepareStep({ maxTools: 5 });
    expect(typeof fn).toBe("function");
  });

  it("middleware() returns object with transformParams", () => {
    const mw = index.middleware({ maxTools: 5 });
    expect(mw.transformParams).toBeDefined();
  });

  it("warmUp() resolves without error", async () => {
    await index.warmUp();
  });

  it("select() with adaptive returns fewer results on score gap", async () => {
    const adaptive = await index.select("deploy the app", { maxTools: 10, adaptive: true });
    const fixed = await index.select("deploy the app", { maxTools: 10, adaptive: false });
    expect(adaptive.length).toBeLessThanOrEqual(fixed.length);
    expect(adaptive).toContain("deployApp");
  });

  it("select() adaptive still returns at least the top matches", async () => {
    const results = await index.select("send a slack message", { maxTools: 8, adaptive: true });
    expect(results).toContain("sendMessage");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

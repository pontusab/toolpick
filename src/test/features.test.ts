import { describe, it, expect, afterAll } from "bun:test";
import { fileCache } from "../cache";
import { createPrepareStep } from "../integrations/prepare-step";
import { HybridSearch } from "../search/hybrid";
import type { ToolDescription } from "../search/types";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const TOOLS: ToolDescription[] = [
  { name: "deployApp", text: "Deploy the application to production" },
  { name: "sendSlack", text: "Send a message to Slack" },
  { name: "queryDB", text: "Query the database" },
  { name: "sendEmail", text: "Send an email" },
  { name: "createIssue", text: "Create a new issue" },
];

describe("fileCache", () => {
  const cachePath = join(tmpdir(), `toolpick-test-${Date.now()}.json`);

  afterAll(async () => {
    await rm(cachePath, { force: true });
  });

  it("load returns null when file does not exist", async () => {
    const cache = fileCache(cachePath);
    const result = await cache.load();
    expect(result).toBeNull();
  });

  it("save then load round-trips embeddings", async () => {
    const cache = fileCache(cachePath);
    const embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
    await cache.save(embeddings);
    const loaded = await cache.load();
    expect(loaded).toEqual(embeddings);
  });

  it("load returns null for invalid JSON", async () => {
    const badPath = join(tmpdir(), `toolpick-bad-${Date.now()}.json`);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(badPath, "not json", "utf-8");
    const cache = fileCache(badPath);
    const result = await cache.load();
    expect(result).toBeNull();
    await rm(badPath, { force: true });
  });
});

describe("prepareStep escalation", () => {
  const engine = new HybridSearch(TOOLS);
  const toolNames = TOOLS.map(t => t.name);

  it("normal step returns limited tools", async () => {
    const fn = createPrepareStep(engine, toolNames, { maxTools: 2 });

    const result = await fn({
      messages: [{ role: "user" as const, content: "deploy the app" }],
      steps: [],
      stepNumber: 0,
    } as any);

    expect(result?.activeTools?.length).toBeLessThanOrEqual(2);
  });

  it("shifts to next page of tools after one failed step", async () => {
    const fn = createPrepareStep(engine, toolNames, { maxTools: 2 });

    const failedStep = {
      toolCalls: [],
      toolResults: [],
      text: "",
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      warnings: [],
      request: {},
      response: { messages: [] },
    };

    const firstPage = await fn({
      messages: [{ role: "user" as const, content: "send a message or email" }],
      steps: [],
      stepNumber: 0,
    } as any);

    const secondPage = await fn({
      messages: [{ role: "user" as const, content: "send a message or email" }],
      steps: [failedStep],
      stepNumber: 1,
    } as any);

    const firstSet = new Set(firstPage!.activeTools!);
    const secondSet = new Set(secondPage!.activeTools!);
    const overlap = [...secondSet].filter(t => firstSet.has(t));
    expect(overlap.length).toBeLessThan(firstSet.size);
  });

  it("returns all tools after two consecutive failed steps", async () => {
    const fn = createPrepareStep(engine, toolNames, { maxTools: 2 });

    const failedStep = {
      toolCalls: [],
      toolResults: [],
      text: "",
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      warnings: [],
      request: {},
      response: { messages: [] },
    };

    const result = await fn({
      messages: [{ role: "user" as const, content: "deploy the app" }],
      steps: [failedStep, failedStep],
      stepNumber: 2,
    } as any);

    expect(result?.activeTools).toEqual(expect.arrayContaining(toolNames));
    expect(result?.activeTools?.length).toBe(toolNames.length);
  });

  it("resets after a successful step", async () => {
    const fn = createPrepareStep(engine, toolNames, { maxTools: 2 });

    const successStep = {
      toolCalls: [{ toolName: "deployApp", toolCallId: "1", args: {} }],
      toolResults: [],
      text: "",
      finishReason: "tool-calls",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      warnings: [],
      request: {},
      response: { messages: [] },
    };

    const result = await fn({
      messages: [{ role: "user" as const, content: "now send a slack message" }],
      steps: [successStep],
      stepNumber: 1,
    } as any);

    expect(result?.activeTools?.length).toBeLessThanOrEqual(2);
  });
});

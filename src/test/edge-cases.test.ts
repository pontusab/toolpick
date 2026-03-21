import { describe, it, expect } from "bun:test";
import { createToolIndex } from "../tool-index";
import { HybridSearch } from "../search/hybrid";
import type { ToolDescription } from "../search/types";
import { tool, jsonSchema } from "ai";

function makeTool(description: string) {
  return tool({
    description,
    inputSchema: jsonSchema<{ input: string }>({
      type: "object",
      properties: { input: { type: "string" } },
      required: ["input"],
    }),
    execute: async () => ({ ok: true }),
  });
}

describe("edge cases", () => {
  describe("single tool", () => {
    const tools = { onlyTool: makeTool("The only tool that exists") };
    const index = createToolIndex(tools);

    it("select returns the tool when query has matching tokens", async () => {
      const selected = await index.select("find the tool that exists");
      expect(selected).toContain("onlyTool");
    });

    it("select returns empty for completely unrelated query", async () => {
      const selected = await index.select("xyzzy foobar blargh");
      expect(selected).toEqual([]);
    });

    it("toolNames has exactly one entry", () => {
      expect(index.toolNames).toEqual(["onlyTool"]);
    });
  });

  describe("empty query", () => {
    const tools = {
      a: makeTool("First tool"),
      b: makeTool("Second tool"),
    };
    const index = createToolIndex(tools);

    it("select with empty string returns results without crashing", async () => {
      const selected = await index.select("");
      expect(Array.isArray(selected)).toBe(true);
    });
  });

  describe("special characters in query", () => {
    const tools = {
      deploy: makeTool("Deploy the app"),
      query: makeTool("Query the database"),
    };
    const index = createToolIndex(tools);

    it("handles emoji in query", async () => {
      const selected = await index.select("🚀 deploy");
      expect(selected).toContain("deploy");
    });

    it("handles punctuation-heavy query", async () => {
      const selected = await index.select("deploy!!! the app???");
      expect(selected).toContain("deploy");
    });

    it("handles unicode query", async () => {
      const selected = await index.select("データベースクエリ");
      expect(Array.isArray(selected)).toBe(true);
    });
  });

  describe("duplicate tool names in alwaysActive", () => {
    const tools = {
      a: makeTool("Tool A"),
      b: makeTool("Tool B"),
      c: makeTool("Tool C"),
    };
    const index = createToolIndex(tools);

    it("deduplicates alwaysActive entries", async () => {
      const selected = await index.select("anything", {
        maxTools: 5,
        alwaysActive: ["a", "a", "b"],
      });
      const counts = selected.reduce((acc, name) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      for (const count of Object.values(counts)) {
        expect(count).toBe(1);
      }
    });
  });

  describe("maxTools larger than tool count", () => {
    const tools = {
      a: makeTool("Tool A"),
      b: makeTool("Tool B"),
    };
    const index = createToolIndex(tools);

    it("returns at most the number of tools available", async () => {
      const selected = await index.select("tool", { maxTools: 100 });
      expect(selected.length).toBeLessThanOrEqual(2);
    });
  });

  describe("threshold filters everything", () => {
    const tools = {
      a: makeTool("Tool A for deploying"),
      b: makeTool("Tool B for messaging"),
    };
    const index = createToolIndex(tools);

    it("returns empty when threshold is impossibly high", async () => {
      const selected = await index.select("deploy", {
        maxTools: 5,
        threshold: 999,
      });
      expect(selected).toEqual([]);
    });
  });

  describe("HybridSearch with identical descriptions", () => {
    const tools: ToolDescription[] = [
      { name: "tool1", text: "Send a message to the team" },
      { name: "tool2", text: "Send a message to the team" },
    ];
    const search = new HybridSearch(tools);

    it("returns both tools with equal scores", () => {
      const results = search.search("send a message", 10);
      expect(results.length).toBe(2);
      expect(results[0].score).toBeCloseTo(results[1].score, 3);
    });
  });

  describe("HybridSearch with no matching tokens", () => {
    const tools: ToolDescription[] = [
      { name: "deploy", text: "Deploy application to production" },
    ];
    const search = new HybridSearch(tools);

    it("returns empty for completely unrelated query", () => {
      const results = search.search("xyzzy foobar blargh", 10);
      expect(results).toEqual([]);
    });
  });

  describe("adaptive with maxTools=1", () => {
    const tools = {
      deploy: makeTool("Deploy the application"),
      query: makeTool("Query the database"),
      send: makeTool("Send a message"),
    };
    const index = createToolIndex(tools);

    it("returns exactly 1 tool", async () => {
      const selected = await index.select("deploy", { maxTools: 1, adaptive: true });
      expect(selected.length).toBe(1);
      expect(selected[0]).toBe("deploy");
    });
  });

  describe("prepareStep with empty messages", () => {
    const tools = {
      a: makeTool("Tool A"),
    };
    const index = createToolIndex(tools);

    it("returns undefined or alwaysActive when no query extractable", async () => {
      const fn = index.prepareStep({ maxTools: 5 });
      const result = await fn({
        messages: [],
        steps: [],
        stepNumber: 0,
      } as any);
      expect(result).toBeUndefined();
    });
  });

  describe("strategy fallback", () => {
    it("defaults to hybrid when no embeddingModel provided", () => {
      const tools = { a: makeTool("Tool A") };
      const index = createToolIndex(tools);
      expect(index.toolNames).toEqual(["a"]);
    });

    it("throws when combined strategy used without embeddingModel", () => {
      const tools = { a: makeTool("Tool A") };
      expect(() => createToolIndex(tools, { strategy: "combined" })).toThrow();
    });

    it("throws when semantic strategy used without embeddingModel", () => {
      const tools = { a: makeTool("Tool A") };
      expect(() => createToolIndex(tools, { strategy: "semantic" })).toThrow();
    });
  });
});

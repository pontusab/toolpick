import { tool, zodSchema } from "ai";
import { z } from "zod";
import type { SearchEngine, ToolDescription } from "../search/types";

const SEARCH_RESULTS = 5;

/**
 * Creates a meta-tool that agents can call to discover tools
 * not in the current activeTools selection.
 *
 * When the agent can't find a tool it needs, it calls search_tools
 * to discover relevant tools by name and description.
 */
export function createSearchTool(
  engine: SearchEngine,
  toolDescriptions: ToolDescription[],
) {
  const descriptionMap = new Map(
    toolDescriptions.map((t) => [t.name, t.text]),
  );

  return tool({
    description:
      "Search for available tools by describing what you need. " +
      "Use this when you need a capability that isn't in your current tools.",
    inputSchema: zodSchema(
      z.object({
        query: z.string().describe("Natural language description of the tool you need"),
      }),
    ),
    execute: async ({ query }) => {
      const results = await engine.search(query, SEARCH_RESULTS);

      const tools = results.map((r) => ({
        name: r.name,
        description: descriptionMap.get(r.name) ?? "",
        relevance: Math.round(r.score * 100) / 100,
      }));

      return {
        tools,
        hint: "The tools listed above are available. Call the one that best matches your need.",
      };
    },
  });
}

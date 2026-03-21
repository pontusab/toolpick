import type { LanguageModelMiddleware } from "ai";
import type { SearchEngine, SelectOptions } from "../search/types";

/**
 * Creates a LanguageModelMiddleware that filters tools via transformParams.
 *
 * Secondary integration path. Operates at the provider level where the prompt
 * is in internal format, making query extraction less precise than prepareStep.
 * Best for single-step generateText/streamText calls.
 */
export function createMiddleware(
  engine: SearchEngine,
  toolNames: string[],
  options: SelectOptions = {},
): LanguageModelMiddleware {
  const { maxTools = 5, alwaysActive = [] } = options;

  return {
    specificationVersion: "v3" as const,
    transformParams: async ({ params }) => {
      const query = extractQueryFromPrompt(params.prompt);

      if (!query || !params.tools || params.tools.length === 0) {
        return params;
      }

      const results = await engine.search(query, maxTools);
      const selected = new Set([
        ...results.map((r) => r.name),
        ...alwaysActive,
      ]);

      const filteredTools = params.tools.filter((t) => {
        const name = "name" in t ? (t as { name: string }).name : undefined;
        return name ? selected.has(name) : true;
      });

      return { ...params, tools: filteredTools };
    },
  };
}

/**
 * Extracts user query from provider-level prompt format.
 * This is messier than extracting from ModelMessage[] because
 * the prompt is in LanguageModelV4Prompt format.
 */
function extractQueryFromPrompt(prompt: unknown): string {
  if (!Array.isArray(prompt)) return "";

  for (let i = prompt.length - 1; i >= 0; i--) {
    const msg = prompt[i];
    if (msg && typeof msg === "object" && "role" in msg && msg.role === "user") {
      if ("content" in msg) {
        const content = msg.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          const texts = content
            .filter((p: unknown) => {
              return p && typeof p === "object" && "type" in p && (p as { type: string }).type === "text";
            })
            .map((p: unknown) => (p as { text: string }).text);
          if (texts.length > 0) return texts.join(" ");
        }
      }
    }
  }

  return "";
}

import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { SearchResult, ToolDescription } from "./search/types.ts";

const RERANK_TOOL_LIMIT = 50;

/**
 * Re-ranks tools using a cheap LLM. When there are <=50 tools,
 * the LLM sees all of them (not just pre-filtered candidates).
 * This adds reasoning that pure embedding similarity can't do.
 */
export async function rerank(
  model: LanguageModel,
  query: string,
  candidates: SearchResult[],
  descriptions: Map<string, string>,
  maxResults: number,
): Promise<SearchResult[]> {
  if (candidates.length <= maxResults) return candidates;

  const allNames = Array.from(descriptions.keys());
  const useFullSet = allNames.length <= RERANK_TOOL_LIMIT;

  const toolList = useFullSet
    ? allNames.map((n) => `- ${n}: ${descriptions.get(n) ?? ""}`).join("\n")
    : candidates.map((c) => `- ${c.name}: ${descriptions.get(c.name) ?? ""}`).join("\n");

  const validNames = new Set(useFullSet ? allNames : candidates.map((c) => c.name));

  try {
    const result = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          tools: z.array(z.string()).describe("Tool names ranked by relevance, most relevant first"),
        }),
      }),
      prompt: `A user said: "${query}"

This may be informal, slang, or abbreviated. Pick the ${maxResults} tools most likely to fulfill what the user actually wants, ranked best-first:

${toolList}

Return ONLY tool names from the list above. Think about what the user means, not just keyword matches.`,
    });

    const ranked: SearchResult[] = [];
    const seen = new Set<string>();

    for (const name of result.output.tools) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (validNames.has(name)) {
        ranked.push({ name, score: 1 - ranked.length * 0.1 });
      }
      if (ranked.length >= maxResults) break;
    }

    return ranked;
  } catch (err) {
    if (process.env.TOOLPICK_DEBUG) {
      console.error("[toolpick rerank] LLM re-ranking failed, falling back to search results:", err);
    }
    return candidates.slice(0, maxResults);
  }
}

/**
 * Enriches tool descriptions with synonyms and common phrasings
 * using a cheap LLM. Called once during warmUp, results are cached.
 */
export async function enrichDescriptions(
  model: LanguageModel,
  descriptions: ToolDescription[],
): Promise<ToolDescription[]> {
  const toolList = descriptions
    .map((d) => `- ${d.name}: ${d.text}`)
    .join("\n");

  try {
    const result = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          tools: z.array(z.object({
            name: z.string(),
            text: z.string(),
          })),
        }),
      }),
      prompt: `For each tool below, expand the description by adding common synonyms, slang, and alternative phrasings that users might say when they want this tool. Keep the original description and append the alternatives. Be concise — just add key synonyms, not full sentences.

${toolList}

Return every tool with its expanded description.`,
    });

    const enriched = new Map(result.output.tools.map((t) => [t.name, t.text]));

    return descriptions.map((d) => ({
      name: d.name,
      text: enriched.get(d.name) ?? d.text,
    }));
  } catch (err) {
    if (process.env.TOOLPICK_DEBUG) {
      console.error("[toolpick enrich] Description enrichment failed, using originals:", err);
    }
    return descriptions;
  }
}

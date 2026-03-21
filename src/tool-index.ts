import type { ToolSet, LanguageModelMiddleware } from "ai";
import type {
  SearchEngine,
  SearchResult,
  SelectOptions,
  ToolDescription,
  ToolIndexOptions,
} from "./search/types";
import { HybridSearch } from "./search/hybrid";
import { SemanticSearch } from "./search/semantic";
import { CombinedSearch } from "./search/combined";
import { createPrepareStep } from "./integrations/prepare-step";
import { createMiddleware } from "./integrations/middleware";
import { createSearchTool } from "./integrations/search-tool";
import { rerank, enrichDescriptions } from "./reranker";

function extractParamNames(toolDef: unknown): string[] {
  if (!toolDef || typeof toolDef !== "object") return [];
  const def = toolDef as Record<string, unknown>;

  const inputSchema = def.inputSchema;
  if (!inputSchema || typeof inputSchema !== "object") return [];

  const schema = inputSchema as Record<string, unknown>;

  if (schema.properties && typeof schema.properties === "object") {
    return Object.keys(schema.properties as Record<string, unknown>);
  }

  if (schema.jsonSchema && typeof schema.jsonSchema === "object" &&
      !(schema.jsonSchema instanceof Promise)) {
    const resolved = schema.jsonSchema as Record<string, unknown>;
    if (resolved.properties && typeof resolved.properties === "object") {
      return Object.keys(resolved.properties as Record<string, unknown>);
    }
  }

  if ("shape" in schema && schema.shape && typeof schema.shape === "object") {
    return Object.keys(schema.shape as Record<string, unknown>);
  }

  return [];
}

export interface ToolIndex {
  /** Pre-compute embeddings eagerly so the first select() is fast. */
  warmUp(): Promise<void>;

  /** Select the most relevant tool names for a query. Returns string[] for activeTools. */
  select(query: string, options?: SelectOptions): Promise<string[]>;

  /** Returns a prepareStep function for ToolLoopAgent / generateText / streamText. */
  prepareStep(options?: SelectOptions): ReturnType<typeof createPrepareStep>;

  /** Returns a LanguageModelMiddleware for transparent integration via wrapLanguageModel. */
  middleware(options?: SelectOptions): LanguageModelMiddleware;

  /** Returns a meta-tool agents can call to discover tools outside the current selection. */
  searchTool(): ReturnType<typeof createSearchTool>;

  /** The tool names in this index. */
  readonly toolNames: string[];
}

const GAP_RATIO = 0.4;
const MIN_ADAPTIVE = 2;

/**
 * Finds the natural cutoff point in ranked results.
 * Looks for the largest relative score drop — if result[i+1] drops
 * by more than GAP_RATIO relative to result[0], cut there.
 */
function findElbow(results: SearchResult[], max: number): SearchResult[] {
  if (results.length <= MIN_ADAPTIVE) return results.slice(0, max);

  const topScore = results[0].score;
  if (topScore <= 0) return results.slice(0, max);

  for (let i = 0; i < results.length - 1 && i < max - 1; i++) {
    const drop = results[i].score - results[i + 1].score;
    if (drop / topScore >= GAP_RATIO && i + 1 >= MIN_ADAPTIVE) {
      return results.slice(0, i + 1);
    }
  }

  return results.slice(0, max);
}

function buildToolDescription(name: string, toolDef: ToolSet[string]): string {
  const parts: string[] = [];

  if (toolDef.description) {
    parts.push(toolDef.description);
  }

  const paramNames = extractParamNames(toolDef);
  if (paramNames.length > 0) {
    parts.push(paramNames.join(" "));
  }

  return parts.join(" ");
}

/**
 * Creates a tool index for dynamic tool selection.
 *
 * When an embeddingModel is provided, defaults to "combined" strategy
 * (hybrid keyword + semantic embeddings) for the best accuracy at minimal cost.
 * Falls back to "hybrid" (free, no API calls) when no model is given.
 *
 * @param tools - A ToolSet (Record<string, Tool>) to index
 * @param options - Strategy configuration
 *
 * @example
 * ```ts
 * import { createToolIndex } from "toolpick";
 * import { openai } from "@ai-sdk/openai";
 *
 * const index = createToolIndex(allTools, {
 *   embeddingModel: openai.embeddingModel("text-embedding-3-small"),
 * });
 * const activeTools = await index.select("ship it to prod", { maxTools: 5 });
 * ```
 */
export function createToolIndex(
  tools: ToolSet,
  options: ToolIndexOptions = {},
): ToolIndex {
  const {
    embeddingModel,
    embeddingCache,
    rerankerModel,
    enrichDescriptions: shouldEnrich = false,
  } = options;

  const strategy = options.strategy
    ?? (embeddingModel ? "combined" : "hybrid");

  const toolNames = Object.keys(tools);
  const toolNameSet = new Set(toolNames);

  let descriptions: ToolDescription[] = toolNames.map((name) => ({
    name,
    text: buildToolDescription(name, tools[name]),
  }));

  const descriptionMap = new Map<string, string>();
  for (const d of descriptions) {
    descriptionMap.set(d.name, d.text);
  }

  let engine: SearchEngine;
  let enriched = false;

  function buildEngine(descs: ToolDescription[]): SearchEngine {
    if (strategy === "combined") {
      if (!embeddingModel) {
        throw new Error(
          'toolpick: embeddingModel is required when using strategy "combined". ' +
          'Example: createToolIndex(tools, { embeddingModel: openai.embeddingModel("text-embedding-3-small") })',
        );
      }
      return new CombinedSearch(descs, embeddingModel, embeddingCache);
    } else if (strategy === "semantic") {
      if (!embeddingModel) {
        throw new Error(
          'toolpick: embeddingModel is required when using strategy "semantic". ' +
          'Example: createToolIndex(tools, { strategy: "semantic", embeddingModel: openai.embeddingModel("text-embedding-3-small") })',
        );
      }
      return new SemanticSearch(descs, embeddingModel, embeddingCache);
    }
    return new HybridSearch(descs);
  }

  engine = buildEngine(descriptions);

  return {
    toolNames,

    async warmUp(): Promise<void> {
      if (shouldEnrich && rerankerModel && !enriched) {
        descriptions = await enrichDescriptions(rerankerModel, descriptions);
        for (const d of descriptions) {
          descriptionMap.set(d.name, d.text);
        }
        engine = buildEngine(descriptions);
        enriched = true;
      }

      if (engine.init) await engine.init();
    },

    async select(query: string, selectOptions: SelectOptions = {}): Promise<string[]> {
      const { maxTools = 5, alwaysActive = [], threshold, adaptive = true } = selectOptions;

      const fetchCount = rerankerModel ? maxTools * 3 : maxTools;
      let results = await engine.search(query, fetchCount);

      if (threshold !== undefined) {
        results = results.filter((r) => r.score >= threshold);
      }

      if (rerankerModel) {
        results = await rerank(
          rerankerModel, query, results, descriptionMap, maxTools,
        );
      }

      if (adaptive) {
        results = findElbow(results, maxTools);
      }

      const selected = results.map((r) => r.name);
      const merged = [...new Set([...selected, ...alwaysActive])];

      return merged.filter((name) => toolNameSet.has(name));
    },

    prepareStep(stepOptions?: SelectOptions) {
      return createPrepareStep(engine, toolNames, stepOptions);
    },

    middleware(mwOptions?: SelectOptions): LanguageModelMiddleware {
      return createMiddleware(engine, toolNames, mwOptions);
    },

    searchTool() {
      return createSearchTool(engine, descriptions);
    },
  };
}

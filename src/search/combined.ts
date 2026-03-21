import type {
  EmbeddingCacheOptions,
  SearchEngine,
  ToolDescription,
} from "./types";
import { HybridSearch } from "./hybrid";
import { SemanticSearch } from "./semantic";
import { fuseResults } from "./fusion";
import type { EmbeddingModel } from "ai";

const SEMANTIC_WEIGHT = 0.7;
const HYBRID_WEIGHT = 0.3;

export class CombinedSearch implements SearchEngine {
  private hybrid: HybridSearch;
  private semantic: SemanticSearch;

  constructor(
    tools: ToolDescription[],
    model: EmbeddingModel,
    cache?: EmbeddingCacheOptions,
  ) {
    this.hybrid = new HybridSearch(tools);
    this.semantic = new SemanticSearch(tools, model, cache);
  }

  async init(): Promise<void> {
    await this.semantic.init();
  }

  async search(query: string, maxResults: number) {
    try {
      const [hybridResults, semanticResults] = await Promise.all([
        this.hybrid.search(query, maxResults * 3),
        this.semantic.search(query, maxResults * 3),
      ]);
      return fuseResults(hybridResults, semanticResults, HYBRID_WEIGHT, SEMANTIC_WEIGHT, maxResults);
    } catch {
      return this.hybrid.search(query, maxResults);
    }
  }
}

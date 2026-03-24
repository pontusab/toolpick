import { embed, embedMany, cosineSimilarity } from "ai";
import type { EmbeddingModel } from "ai";
import type {
  EmbeddingCacheOptions,
  SearchEngine,
  SearchResult,
  ToolDescription,
} from "./types.ts";

export class SemanticSearch implements SearchEngine {
  private embeddings: number[][] = [];
  private toolNames: string[] = [];
  private model: EmbeddingModel;
  private cache?: EmbeddingCacheOptions;
  private initPromise: Promise<void> | null = null;

  constructor(
    private tools: ToolDescription[],
    model: EmbeddingModel,
    cache?: EmbeddingCacheOptions,
  ) {
    this.model = model;
    this.cache = cache;
    this.toolNames = tools.map((t) => t.name);
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.cache) {
        const cached = await this.cache.load();
        if (cached && cached.length === this.tools.length) {
          this.embeddings = cached;
          return;
        }
      }

      const values = this.tools.map((t) => `${t.name}: ${t.text}`);

      const { embeddings } = await embedMany({
        model: this.model,
        values,
      });

      this.embeddings = embeddings;

      if (this.cache) {
        await this.cache.save(embeddings);
      }
    })().catch((err) => {
      this.initPromise = null;
      throw err;
    });

    return this.initPromise;
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    await this.init();

    const { embedding: queryEmbedding } = await embed({
      model: this.model,
      value: query,
    });

    const scores: SearchResult[] = [];

    for (let i = 0; i < this.embeddings.length; i++) {
      const score = cosineSimilarity(queryEmbedding, this.embeddings[i]);
      scores.push({ name: this.toolNames[i], score });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, maxResults);
  }
}

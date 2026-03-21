import type { EmbeddingModel, LanguageModel } from "ai";

export type SearchStrategy = "hybrid" | "semantic" | "combined";

export interface SelectOptions {
  maxTools?: number;
  alwaysActive?: string[];
  threshold?: number;
  /** When true, returns fewer than maxTools if there's a large score gap. Default: true */
  adaptive?: boolean;
}

export interface SearchResult {
  name: string;
  score: number;
}

export interface SearchEngine {
  search(query: string, maxResults: number): SearchResult[] | Promise<SearchResult[]>;
  init?(): Promise<void>;
}

export interface EmbeddingCacheOptions {
  load(): Promise<number[][] | null>;
  save(embeddings: number[][]): Promise<void>;
}

export interface ToolIndexOptions {
  strategy?: SearchStrategy;
  embeddingModel?: EmbeddingModel;
  embeddingCache?: EmbeddingCacheOptions;
  rerankerModel?: LanguageModel;
  enrichDescriptions?: boolean;
}

export interface ToolDescription {
  name: string;
  text: string;
}

export interface EvalTestCase {
  query: string;
  expected: string;
  alternatives?: string[];
}

export interface EvalResult {
  top1: number;
  top3: number;
  top5: number;
  avgLatencyMs: number;
  total: number;
  misses: Array<{
    query: string;
    expected: string;
    got: string[];
  }>;
}

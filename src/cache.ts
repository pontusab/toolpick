import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { EmbeddingCacheOptions } from "./search/types.ts";

/**
 * File-based embedding cache. Saves/loads tool embeddings as JSON
 * so they survive restarts without re-calling the embedding API.
 *
 * @example
 * ```ts
 * import { createToolIndex, fileCache } from "toolpick";
 *
 * const index = createToolIndex(tools, {
 *   embeddingModel: openai.embeddingModel("text-embedding-3-small"),
 *   embeddingCache: fileCache(".toolpick-cache.json"),
 * });
 * await index.warmUp();
 * ```
 */
export function fileCache(path: string): EmbeddingCacheOptions {
  return {
    async load(): Promise<number[][] | null> {
      try {
        const data = await readFile(path, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.every(Array.isArray)) {
          return parsed as number[][];
        }
        return null;
      } catch {
        return null;
      }
    },

    async save(embeddings: number[][]): Promise<void> {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(embeddings), "utf-8");
    },
  };
}

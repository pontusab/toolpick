import type { SearchResult } from "./types.ts";

/**
 * Normalizes two scored result sets to [0,1] and fuses them
 * with a weighted sum. Used by both HybridSearch (BM25 + TF-IDF)
 * and CombinedSearch (hybrid + semantic).
 */
export function fuseResults(
  resultsA: SearchResult[],
  resultsB: SearchResult[],
  weightA: number,
  weightB: number,
  maxResults: number,
): SearchResult[] {
  const maxA = resultsA[0]?.score ?? 1;
  const maxB = resultsB[0]?.score ?? 1;

  const scoreMap = new Map<string, { a: number; b: number }>();

  for (const r of resultsA) {
    const entry = scoreMap.get(r.name) ?? { a: 0, b: 0 };
    entry.a = maxA > 0 ? r.score / maxA : 0;
    scoreMap.set(r.name, entry);
  }

  for (const r of resultsB) {
    const entry = scoreMap.get(r.name) ?? { a: 0, b: 0 };
    entry.b = maxB > 0 ? r.score / maxB : 0;
    scoreMap.set(r.name, entry);
  }

  const fused: SearchResult[] = [];
  for (const [name, scores] of scoreMap) {
    fused.push({ name, score: weightA * scores.a + weightB * scores.b });
  }

  fused.sort((a, b) => b.score - a.score);
  return fused.slice(0, maxResults);
}

import type { SearchEngine, SearchResult, ToolDescription } from "./types";
import { tokenize } from "../utils";
import { fuseResults } from "./fusion";

// ── BM25 ────────────────────────────────────────────────────────

const BM25_K1 = 1.2;
const BM25_B = 0.75;

interface BM25Doc {
  name: string;
  tokens: string[];
  length: number;
  tf: Map<string, number>;
}

class BM25Index {
  private docs: BM25Doc[] = [];
  private df: Map<string, number> = new Map();
  private avgDl = 0;
  private totalLength = 0;
  private n = 0;

  add(name: string, text: string): void {
    const tokens = tokenize(text);
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    const seen = new Set(tokens);
    for (const t of seen) {
      this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }

    this.docs.push({ name, tokens, length: tokens.length, tf });
    this.n++;
    this.totalLength += tokens.length;
    this.avgDl = this.totalLength / this.n;
  }

  search(query: string, maxResults: number): SearchResult[] {
    const queryTokens = tokenize(query);
    const scores: SearchResult[] = [];

    for (const doc of this.docs) {
      let score = 0;
      for (const qt of queryTokens) {
        const dfVal = this.df.get(qt) ?? 0;
        const idf = Math.log(1 + (this.n - dfVal + 0.5) / (dfVal + 0.5));
        const tfVal = doc.tf.get(qt) ?? 0;
        const num = tfVal * (BM25_K1 + 1);
        const denom = tfVal + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / this.avgDl));
        score += idf * (num / denom);
      }
      if (score > 0) {
        scores.push({ name: doc.name, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, maxResults);
  }
}

// ── TF-IDF with cosine similarity ───────────────────────────────

class TfidfIndex {
  private termToId: Map<string, number> = new Map();
  private nextTermId = 0;
  private docVectors: Array<{ name: string; vector: Map<number, number> }> = [];
  private df: Map<number, number> = new Map();
  private n = 0;

  private getTermId(term: string): number {
    let id = this.termToId.get(term);
    if (id === undefined) {
      id = this.nextTermId++;
      this.termToId.set(term, id);
    }
    return id;
  }

  add(name: string, text: string): void {
    const tokens = tokenize(text);
    const tf = new Map<number, number>();
    const seen = new Set<number>();

    for (const t of tokens) {
      const id = this.getTermId(t);
      tf.set(id, (tf.get(id) ?? 0) + 1);
      if (!seen.has(id)) {
        seen.add(id);
        this.df.set(id, (this.df.get(id) ?? 0) + 1);
      }
    }

    const vector = new Map<number, number>();
    const len = tokens.length || 1;
    for (const [termId, count] of tf) {
      vector.set(termId, count / len);
    }

    this.docVectors.push({ name, vector });
    this.n++;
  }

  search(query: string, maxResults: number): SearchResult[] {
    const tokens = tokenize(query);
    const queryTf = new Map<number, number>();

    for (const t of tokens) {
      const id = this.termToId.get(t);
      if (id !== undefined) {
        queryTf.set(id, (queryTf.get(id) ?? 0) + 1);
      }
    }

    if (queryTf.size === 0) return [];

    // Build query TF-IDF vector
    const queryVector = new Map<number, number>();
    const qLen = tokens.length || 1;
    for (const [termId, count] of queryTf) {
      const dfVal = this.df.get(termId) ?? 0;
      const idf = Math.log((this.n + 1) / (dfVal + 1)) + 1;
      queryVector.set(termId, (count / qLen) * idf);
    }

    const scores: SearchResult[] = [];

    for (const doc of this.docVectors) {
      // Apply IDF to doc vector on the fly and compute cosine similarity
      let dot = 0;
      let docMag = 0;

      for (const [termId, tfVal] of doc.vector) {
        const dfVal = this.df.get(termId) ?? 0;
        const idf = Math.log((this.n + 1) / (dfVal + 1)) + 1;
        const tfidf = tfVal * idf;
        docMag += tfidf * tfidf;

        const qVal = queryVector.get(termId);
        if (qVal !== undefined) {
          dot += tfidf * qVal;
        }
      }

      if (dot <= 0) continue;

      let queryMag = 0;
      for (const v of queryVector.values()) {
        queryMag += v * v;
      }

      const magnitude = Math.sqrt(docMag) * Math.sqrt(queryMag);
      if (magnitude === 0) continue;

      scores.push({ name: doc.name, score: dot / magnitude });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, maxResults);
  }
}

// ── Hybrid (BM25 + TF-IDF) ─────────────────────────────────────

const HYBRID_ALPHA = 0.2; // 20% BM25, 80% TF-IDF
const NAME_BOOST_REPEAT = 3;

export class HybridSearch implements SearchEngine {
  private bm25 = new BM25Index();
  private tfidf = new TfidfIndex();

  constructor(tools: ToolDescription[]) {
    for (const t of tools) {
      const boosted = `${Array(NAME_BOOST_REPEAT).fill(t.name).join(" ")} ${t.text}`;
      this.bm25.add(t.name, boosted);
      this.tfidf.add(t.name, boosted);
    }
  }

  search(query: string, maxResults: number) {
    const bm25Results = this.bm25.search(query, maxResults * 3);
    const tfidfResults = this.tfidf.search(query, maxResults * 3);
    return fuseResults(bm25Results, tfidfResults, HYBRID_ALPHA, 1 - HYBRID_ALPHA, maxResults);
  }
}

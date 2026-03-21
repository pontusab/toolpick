const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else",
  "for", "of", "in", "on", "to", "from", "by", "with", "as",
  "at", "is", "are", "was", "were", "be", "been", "it", "this",
  "that", "these", "those", "not", "no", "can", "could", "should",
  "would", "may", "might", "do", "does", "did", "have", "has",
  "had", "you", "your",
]);

export function splitCompound(word: string): string[] {
  if (word.includes("_")) {
    return word.split("_").filter((s) => s.length > 0).map((s) => s.toLowerCase());
  }
  const parts = word.replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .filter((s) => s.length > 0);
  return parts.length > 1 ? parts : [word.toLowerCase()];
}

export function tokenize(text: string): string[] {
  const raw = text
    .replace(/[^\p{L}\p{N}_\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const tokens: string[] = [];
  for (const t of raw) {
    for (const part of splitCompound(t)) {
      const lower = part.toLowerCase();
      if (!STOPWORDS.has(lower)) {
        tokens.push(lower);
      }
    }
  }
  return tokens;
}

import type { ToolIndex } from "../tool-index.ts";
import type { EvalTestCase, EvalResult } from "../search/types.ts";

/**
 * Evaluates a ToolIndex against test cases.
 *
 * Measures Top-1, Top-3, Top-5 accuracy and average latency.
 * Returns misses for debugging.
 *
 * @example
 * ```ts
 * import { evalToolIndex } from "toolpick/eval";
 *
 * const result = evalToolIndex(index, [
 *   { query: "create a ticket", expected: "createJiraTicket" },
 *   { query: "send an email", expected: "sendEmail" },
 * ]);
 * console.log(`Top-1: ${result.top1}%, Top-3: ${result.top3}%`);
 * ```
 */
export async function evalToolIndex(
  index: ToolIndex,
  testCases: EvalTestCase[],
  options: { maxTools?: number } = {},
): Promise<EvalResult> {
  const { maxTools = 5 } = options;

  let top1 = 0;
  let top3 = 0;
  let top5 = 0;
  let totalLatency = 0;
  const misses: EvalResult["misses"] = [];

  for (const tc of testCases) {
    const start = performance.now();
    const results = await index.select(tc.query, { maxTools: Math.max(maxTools, 5) });
    const elapsed = performance.now() - start;
    totalLatency += elapsed;

    const accepted = new Set([tc.expected, ...(tc.alternatives ?? [])]);

    const isHit = (slice: string[]) => slice.some((name) => accepted.has(name));

    if (isHit(results.slice(0, 1))) top1++;
    if (isHit(results.slice(0, 3))) top3++;
    if (isHit(results.slice(0, 5))) top5++;

    if (!isHit(results.slice(0, 5))) {
      misses.push({
        query: tc.query,
        expected: tc.expected,
        got: results.slice(0, 5),
      });
    }
  }

  const total = testCases.length;
  if (total === 0) {
    return { top1: 0, top3: 0, top5: 0, avgLatencyMs: 0, total: 0, misses: [] };
  }

  const pct = (n: number) => Math.round((n / total) * 100);

  return {
    top1: pct(top1),
    top3: pct(top3),
    top5: pct(top5),
    avgLatencyMs: Math.round(totalLatency / total * 100) / 100,
    total,
    misses,
  };
}

export type { EvalTestCase, EvalResult } from "../search/types.ts";

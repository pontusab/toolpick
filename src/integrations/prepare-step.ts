import type { PrepareStepFunction, ToolSet } from "ai";
import type { SearchEngine, SelectOptions } from "../search/types";
import { extractQuery } from "../query-extractor";

function asActiveTools<TOOLS extends ToolSet>(names: string[]): Array<keyof TOOLS> {
  return names as Array<keyof TOOLS>;
}

/**
 * Creates a prepareStep function that dynamically selects tools per step.
 * Returns `{ activeTools }` to limit which tools the model sees.
 *
 * Includes automatic escalation: if the model produced no tool calls in the
 * previous step, the next step shifts to the *next page* of ranked tools
 * (positions maxTools+1 through maxTools*2) instead of repeating the same set.
 * After two consecutive misses, all tools are exposed.
 */
export function createPrepareStep<TOOLS extends ToolSet>(
  engine: SearchEngine,
  toolNames: (keyof TOOLS & string)[],
  options: SelectOptions = {},
): PrepareStepFunction<TOOLS> {
  const { maxTools = 5, alwaysActive = [] } = options;
  const toolNameSet = new Set<string>(toolNames);

  return async ({ messages, steps, stepNumber }) => {
    const query = extractQuery<TOOLS>(messages, steps, stepNumber);

    if (!query) {
      return alwaysActive.length > 0
        ? { activeTools: asActiveTools<TOOLS>(alwaysActive) }
        : undefined;
    }

    let consecutiveFailures = 0;
    if (stepNumber > 0 && steps.length > 0) {
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].toolCalls.length === 0) {
          consecutiveFailures++;
        } else {
          break;
        }
      }
    }

    if (consecutiveFailures >= 2) {
      const activeTools = [...new Set([...toolNames, ...alwaysActive])];
      return { activeTools: asActiveTools<TOOLS>(activeTools) };
    }

    const page = consecutiveFailures;
    const windowSize = maxTools * (page + 1);
    const results = await engine.search(query, windowSize);

    const offset = page * maxTools;
    const pageResults = results.slice(offset, offset + maxTools);
    const selected = pageResults.map((r) => r.name);

    const merged = [...new Set([...selected, ...alwaysActive])];
    const activeTools = merged.filter((name) => toolNameSet.has(name));

    return { activeTools: asActiveTools<TOOLS>(activeTools) };
  };
}

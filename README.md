# toolpick

Your agent has 30 tools. The model sees all of them on every step — tool definitions eat thousands of tokens, the model picks the wrong one, and you're paying for context it doesn't need.

toolpick fixes this. It picks the right 5 tools per step so the model only sees what matters.

## Install

```bash
npm install toolpick
```

## Usage

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createToolIndex } from "toolpick";

const index = createToolIndex(allTools, {
  embeddingModel: openai.embeddingModel("text-embedding-3-small"),
});

const result = await generateText({
  model: openai("gpt-4o"),
  tools: allTools,
  prepareStep: index.prepareStep(),
  prompt: "ship it to prod",
  maxSteps: 10,
});
```

Every step, toolpick selects the most relevant tools and sets `activeTools` automatically. The model only sees what it needs. All tools remain available for execution.

Works with `generateText`, `streamText`, and `Experimental_Agent`.

## How it works

Pass an embedding model and toolpick indexes your tool names, descriptions, and parameters. On each step it runs a combined search — fast keyword matching plus semantic embeddings — and returns the best matches.

If the model can't find a useful tool, the next step automatically pages to a fresh set it hasn't seen yet. Two misses in a row? All tools get exposed as a fallback. Your agent never gets stuck.

If the embedding API goes down, it silently falls back to keyword-only search. No crashes.

## LLM re-ranking

For maximum accuracy, add a `rerankerModel`. The combined search fetches candidates, then a cheap LLM picks the best ones using reasoning — handling slang, abbreviations, and context that embeddings alone miss.

```ts
const index = createToolIndex(allTools, {
  embeddingModel: openai.embeddingModel("text-embedding-3-small"),
  rerankerModel: openai("gpt-4o-mini"),
});
```

This takes accuracy from 84% to 100% on blind user queries. Cost: ~$0.0001 per step (gpt-4o-mini).

### Description enrichment

For an extra boost, `enrichDescriptions` expands your tool descriptions with synonyms and alternative phrasings at startup. This is a one-time LLM call during `warmUp()`:

```ts
const index = createToolIndex(allTools, {
  embeddingModel: openai.embeddingModel("text-embedding-3-small"),
  rerankerModel: openai("gpt-4o-mini"),
  enrichDescriptions: true,
});

await index.warmUp();
```

## Model-driven discovery

For agents that need to discover tools outside the current selection, expose the built-in search tool:

```ts
const result = await generateText({
  model: openai("gpt-4o"),
  tools: {
    ...allTools,
    search_tools: index.searchTool(),
  },
  prepareStep: index.prepareStep({ alwaysActive: ["search_tools"] }),
  maxSteps: 10,
  prompt: "find and use the right tool",
});
```

The model can call `search_tools` to browse the full catalog and request specific tools be activated. This mirrors how Anthropic's tool search works — but for any model.

## Caching

Tool description embeddings are computed once at startup. Cache them to skip the API call on restarts:

```ts
import { createToolIndex, fileCache } from "toolpick";

const index = createToolIndex(allTools, {
  embeddingModel: openai.embeddingModel("text-embedding-3-small"),
  embeddingCache: fileCache(".toolpick-cache.json"),
});

await index.warmUp();
```

## Accuracy

Tested with 19 blind user queries — slang, vague language, no keyword overlap — against 30 real SaaS tools:

| Strategy | Top-5 accuracy | Cost per query |
|---|---|---|
| Keyword only | 31% | Free |
| Embeddings only | 79% | ~$0.00002 |
| Combined (default) | 84% | ~$0.00002 |
| **Combined + LLM re-ranking** | **100%** | **~$0.0001** |

Queries like "ship it", "ping the team", "file a bug", "get the CI running", and "compress this photo" all resolve to the correct tool.

## Options

```ts
const index = createToolIndex(tools, {
  embeddingModel: model,          // enables combined search (recommended)
  rerankerModel: model,           // LLM re-ranking for max accuracy
  enrichDescriptions: true,       // expand descriptions with synonyms at warmUp
  embeddingCache: fileCache(path), // persist embeddings to disk
  strategy: "hybrid",             // force keyword-only (free, no API calls)
});

await index.select(query, {
  maxTools: 5,                    // ceiling, not fixed count
  adaptive: true,                 // cut early when scores drop off
  alwaysActive: ["search_tools"], // always include these
  threshold: 0.3,                 // minimum relevance score
});
```

## License

MIT
